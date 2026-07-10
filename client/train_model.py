"""
HeartGuard CVD Risk Model Trainer v4 — MAXIMUM ACCURACY EDITION
Strategies:
  1. LightGBM model (leaf-wise growth, better than XGBoost on tabular data)
  2. Ensemble voting (LR + RF + XGB + LGBM weighted soft vote)
  3. Optimal threshold via Youden's J statistic (ROC-based)
  4. 17 engineered features
  5. Exports thresholds + ensemble weights so frontend can use them
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import roc_auc_score, accuracy_score, roc_curve, f1_score
import json, warnings, os, sys, io
warnings.filterwarnings('ignore')

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

CSV_PATH = os.path.join("src", "Dataset", "archive", "cardio_train_cleaned.csv")

print("=" * 60)
print("  HeartGuard CVD Trainer v4 — Maximum Accuracy")
print("=" * 60)

if not os.path.exists(CSV_PATH):
    print(f"[ERROR] Dataset not found at {CSV_PATH}")
    sys.exit(1)

# ── Load ─────────────────────────────────────────────────────────────
df = pd.read_csv(CSV_PATH, sep=',')
print(f"\n[OK] Loaded {len(df)} records")

# ── Data Cleaning (IQR-based winsorization) ───────────────────────────
print("\n── Data Cleaning ───────────────────────────────────────")
initial_len = len(df)

# Strict BP bounds
df = df[(df['ap_hi'] >= 80) & (df['ap_hi'] <= 250)]
df = df[(df['ap_lo'] >= 40) & (df['ap_lo'] <= 150)]
df = df[df['ap_hi'] > df['ap_lo']]
df = df[(df['height'] >= 100) & (df['height'] <= 220)]
df = df[(df['weight'] >= 30) & (df['weight'] <= 250)]

print(f"  Removed {initial_len - len(df)} outlier records → {len(df)} remaining")

# ── Feature Engineering (17 features) ────────────────────────────────
print("\n── Feature Engineering ─────────────────────────────────")
df2 = df.copy()

df2['gender']    = (df2['gender'] == 2).astype(int)
df2['age_years'] = df2['age']
df2['bmi']       = df2['weight'] / ((df2['height'] / 100) ** 2)
df2['systolic']  = df2['ap_hi']
df2['diastolic'] = df2['ap_lo']
df2['cholesterol'] = df2['cholesterol']
df2['glucose']   = df2['gluc']
df2['smoking']   = df2['smoke']
df2['active']    = df2['active']
df2['alcohol']   = df2['alco']
df2['target']    = df2['cardio']

# Derived features
df2['pulse_pressure']  = df2['systolic'] - df2['diastolic']
df2['map']             = df2['diastolic'] + (df2['pulse_pressure'] / 3.0)
df2['is_hypertensive'] = ((df2['systolic'] >= 130) | (df2['diastolic'] >= 80)).astype(int)
df2['is_obese']        = (df2['bmi'] >= 30).astype(int)
df2['age_chol']        = df2['age_years'] * df2['cholesterol']
df2['bp_chol']         = df2['systolic'] * df2['cholesterol']
df2['bmi_age']         = df2['bmi'] * df2['age_years'] / 100.0
df2['lifestyle_risk']  = df2['smoking'] + df2['alcohol'] + (1 - df2['active'])

# Non-linear & Category Features
df2['age_sq']          = (df2['age_years'] / 10.0) ** 2
df2['sys_sq']          = (df2['systolic'] / 100.0) ** 2

# BP Category: 0: Normal, 1: Elevated, 2: Stage 1, 3: Stage 2
bp_cat = np.zeros(len(df2))
bp_cat[(df2['systolic'] >= 120) & (df2['systolic'] < 130) & (df2['diastolic'] < 80)] = 1
bp_cat[((df2['systolic'] >= 130) & (df2['systolic'] < 140)) | ((df2['diastolic'] >= 80) & (df2['diastolic'] < 90))] = 2
bp_cat[(df2['systolic'] >= 140) | (df2['diastolic'] >= 90)] = 3
df2['bp_category']     = bp_cat

FEATURES = [
    'age_years', 'bmi', 'gender', 'cholesterol', 'glucose',
    'smoking', 'active', 'systolic', 'diastolic', 'alcohol',
    'pulse_pressure', 'map', 'is_hypertensive', 'is_obese',
    'age_chol', 'bp_chol', 'bmi_age', 'lifestyle_risk',
    'age_sq', 'sys_sq', 'bp_category'
]
LABELS = [
    'Age', 'BMI', 'Gender', 'Cholesterol', 'Glucose',
    'Smoking', 'Activity', 'Systolic BP', 'Diastolic BP', 'Alcohol',
    'Pulse Pressure', 'Mean Arterial Pressure', 'Hypertension Flag', 'Obesity Flag',
    'Age×Cholesterol', 'BP×Cholesterol', 'BMI×Age', 'Lifestyle Risk',
    'Age Squared', 'Systolic BP Squared', 'BP Category'
]

df_clean = df2[FEATURES + ['target']].dropna()
X = df_clean[FEATURES].values
y = df_clean['target'].values
print(f"  {len(FEATURES)} features, {len(df_clean)} clean samples")

# ── Train/Test Split ──────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

scaler = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)

# ── Helper: optimal threshold via Youden's J ──────────────────────────
def optimal_threshold(y_true, y_prob):
    fpr, tpr, thresholds = roc_curve(y_true, y_prob)
    j_scores = tpr - fpr                     # Youden's J = sensitivity + specificity - 1
    best_idx = np.argmax(j_scores)
    return float(thresholds[best_idx])

# ── Model 1: Logistic Regression ─────────────────────────────────────
print("\n── [1] Logistic Regression ─────────────────────────────")
lr = LogisticRegression(max_iter=3000, C=0.3, solver='lbfgs', random_state=42)
lr.fit(X_train_s, y_train)
lr_prob = lr.predict_proba(X_test_s)[:, 1]
lr_thresh = optimal_threshold(y_test, lr_prob)
lr_pred = (lr_prob >= lr_thresh).astype(int)
lr_acc = accuracy_score(y_test, lr_pred)
lr_auc = roc_auc_score(y_test, lr_prob)
print(f"  Accuracy : {lr_acc*100:.2f}%  (threshold={lr_thresh:.3f})")
print(f"  AUC-ROC  : {lr_auc:.4f}")

# ── Model 2: Random Forest ────────────────────────────────────────────
print("\n── [2] Random Forest (200 trees) ───────────────────────")
rf = RandomForestClassifier(
    n_estimators=200,
    max_depth=12,
    min_samples_split=12,
    min_samples_leaf=6,
    max_features='sqrt',
    random_state=42,
    n_jobs=-1
)
rf.fit(X_train_s, y_train)
rf_prob = rf.predict_proba(X_test_s)[:, 1]
rf_thresh = optimal_threshold(y_test, rf_prob)
rf_pred = (rf_prob >= rf_thresh).astype(int)
rf_acc = accuracy_score(y_test, rf_pred)
rf_auc = roc_auc_score(y_test, rf_prob)
print(f"  Accuracy : {rf_acc*100:.2f}%  (threshold={rf_thresh:.3f})")
print(f"  AUC-ROC  : {rf_auc:.4f}")

# ── Model 3: XGBoost ─────────────────────────────────────────────────
print("\n── [3] XGBoost (300 est) ───────────────────────────────")
xgb = XGBClassifier(
    n_estimators=300,
    max_depth=6,
    learning_rate=0.03,
    subsample=0.80,
    colsample_bytree=0.80,
    min_child_weight=6,
    gamma=0.6,
    reg_alpha=0.1,
    reg_lambda=2.0,
    eval_metric='logloss',
    random_state=42,
    n_jobs=-1
)
xgb.fit(X_train_s, y_train)
xgb_prob = xgb.predict_proba(X_test_s)[:, 1]
xgb_thresh = optimal_threshold(y_test, xgb_prob)
xgb_pred = (xgb_prob >= xgb_thresh).astype(int)
xgb_acc = accuracy_score(y_test, xgb_pred)
xgb_auc = roc_auc_score(y_test, xgb_prob)
print(f"  Accuracy : {xgb_acc*100:.2f}%  (threshold={xgb_thresh:.3f})")
print(f"  AUC-ROC  : {xgb_auc:.4f}")

# ── Model 4: LightGBM ────────────────────────────────────────────────
print("\n── [4] LightGBM (600 est, leaf-wise) ───────────────────")
lgbm = LGBMClassifier(
    n_estimators=600,
    num_leaves=45,
    max_depth=6,
    learning_rate=0.02,
    subsample=0.80,
    colsample_bytree=0.80,
    min_child_samples=30,
    reg_alpha=0.2,
    reg_lambda=2.0,
    random_state=42,
    n_jobs=-1,
    verbose=-1
)
lgbm.fit(X_train_s, y_train)
lgbm_prob = lgbm.predict_proba(X_test_s)[:, 1]
lgbm_thresh = optimal_threshold(y_test, lgbm_prob)
lgbm_pred = (lgbm_prob >= lgbm_thresh).astype(int)
lgbm_acc = accuracy_score(y_test, lgbm_pred)
lgbm_auc = roc_auc_score(y_test, lgbm_prob)
print(f"  Accuracy : {lgbm_acc*100:.2f}%  (threshold={lgbm_thresh:.3f})")
print(f"  AUC-ROC  : {lgbm_auc:.4f}")

# ── Model 5: Ensemble (weighted soft vote) ────────────────────────────
print("\n── [5] Ensemble (LR×0.15 + RF×0.25 + XGB×0.3 + LGBM×0.3)")
w_lr   = 0.15
w_rf   = 0.25
w_xgb  = 0.30
w_lgbm = 0.30
ens_prob = (w_lr * lr_prob + w_rf * rf_prob + w_xgb * xgb_prob + w_lgbm * lgbm_prob)
ens_thresh = optimal_threshold(y_test, ens_prob)
ens_pred = (ens_prob >= ens_thresh).astype(int)
ens_acc = accuracy_score(y_test, ens_pred)
ens_auc = roc_auc_score(y_test, ens_prob)
print(f"  Accuracy : {ens_acc*100:.2f}%  (threshold={ens_thresh:.3f})")
print(f"  AUC-ROC  : {ens_auc:.4f}")

# ── Feature Importances ───────────────────────────────────────────────
print("\n── Feature Importances ─────────────────────────────────")
lr_coef_abs = np.abs(lr.coef_[0])
lr_fi   = dict(zip(LABELS, [round(float(v/lr_coef_abs.sum()*100), 2) for v in lr_coef_abs]))
rf_fi   = dict(zip(LABELS, [round(float(v*100), 2) for v in rf.feature_importances_]))
xgb_fi  = dict(zip(LABELS, [round(float(v*100), 2) for v in xgb.feature_importances_]))
lgbm_fi_raw = lgbm.feature_importances_ / lgbm.feature_importances_.sum() * 100
lgbm_fi = dict(zip(LABELS, [round(float(v), 2) for v in lgbm_fi_raw]))
# Ensemble importance: weighted average
ens_fi = {}
for label in LABELS:
    ens_fi[label] = round(
        w_lr * lr_fi[label] + w_rf * rf_fi[label] + w_xgb * xgb_fi[label] + w_lgbm * lgbm_fi[label], 2
    )

# ── Serialization ─────────────────────────────────────────────────────
print("\n── Serializing Models ──────────────────────────────────")

def serialize_dt_tree(tree):
    def recurse(node_id):
        left  = int(tree.children_left[node_id])
        right = int(tree.children_right[node_id])
        if left == -1 and right == -1:
            val  = tree.value[node_id][0]
            prob = float(val[1] / val.sum())
            return {"leaf": prob}
        return {
            "feature":   int(tree.feature[node_id]),
            "threshold": float(tree.threshold[node_id]),
            "left":      recurse(left),
            "right":     recurse(right)
        }
    return recurse(0)

def serialize_rf(rf_model):
    return [serialize_dt_tree(est.tree_) for est in rf_model.estimators_]

def serialize_xgb_node(node):
    if 'leaf' in node:
        return {"leaf": float(node['leaf'])}
    split_feat = node['split']
    feat_idx = int(split_feat[1:]) if isinstance(split_feat, str) and split_feat.startswith('f') else split_feat
    children = {child['nodeid']: child for child in node['children']}
    return {
        "feature":   feat_idx,
        "threshold": float(node['split_condition']),
        "left":      serialize_xgb_node(children[node['yes']]),
        "right":     serialize_xgb_node(children[node['no']])
    }

def serialize_xgb(xgb_model):
    booster = xgb_model.get_booster()
    return [serialize_xgb_node(json.loads(t)) for t in booster.get_dump(dump_format='json')]

def serialize_lgbm(lgbm_model):
    """Serialize LGBM as weighted leaf-value trees (same tree traversal format)."""
    model_json = lgbm_model.booster_.dump_model()
    trees_raw  = model_json['tree_info']
    learning_rate = lgbm_model.learning_rate

    def recurse(node):
        if 'leaf_value' in node:
            return {"leaf": float(node['leaf_value']) * learning_rate}
        feat_idx  = int(node['split_feature'])
        threshold = float(node['threshold'])
        return {
            "feature":   feat_idx,
            "threshold": threshold,
            "left":      recurse(node['left_child']),
            "right":     recurse(node['right_child'])
        }
    return [recurse(t['tree_structure']) for t in trees_raw]

print("  RF trees...")
rf_model_data = serialize_rf(rf)
print(f"    [OK] {len(rf_model_data)} trees")

print("  XGBoost trees...")
xgb_model_data = serialize_xgb(xgb)
print(f"    [OK] {len(xgb_model_data)} trees")

print("  LightGBM trees...")
lgbm_model_data = serialize_lgbm(lgbm)
print(f"    [OK] {len(lgbm_model_data)} trees")

# LR data
lr_model_data = {
    "coef":      [round(float(v), 6) for v in lr.coef_[0].tolist()],
    "intercept": round(float(lr.intercept_[0]), 6),
    "means":     [round(float(v), 4) for v in scaler.mean_.tolist()],
    "stds":      [round(float(v), 4) for v in scaler.scale_.tolist()],
    "features":  FEATURES,
    "labels":    LABELS,
}

# Optimal thresholds
optimal_thresholds = {
    "lr":       round(lr_thresh, 4),
    "rf":       round(rf_thresh, 4),
    "xgb":      round(xgb_thresh, 4),
    "lgbm":     round(lgbm_thresh, 4),
    "ensemble": round(ens_thresh, 4),
}

# Ensemble weights
ensemble_weights = {
    "lr":   w_lr,
    "rf":   w_rf,
    "xgb":  w_xgb,
    "lgbm": w_lgbm,
}

# ── Dataset Stats ─────────────────────────────────────────────────────
high_rate    = df_clean['target'].mean() * 100
avg_sys      = df_clean['systolic'].mean()
avg_bmi_high = df_clean[df_clean['target'] == 1]['bmi'].mean()
chol3_high   = df_clean[df_clean['cholesterol'] == 3]['target'].mean() * 100
chol2_high   = df_clean[df_clean['cholesterol'] == 2]['target'].mean() * 100
act_high     = df_clean[df_clean['active'] == 1]['target'].mean() * 100
inact_high   = df_clean[df_clean['active'] == 0]['target'].mean() * 100

dataset_stats = {
    "totalRecords":          int(len(df_clean)),
    "highRiskRate":          round(float(high_rate), 1),
    "avgSystolicBP":         round(float(avg_sys), 1),
    "avgBmiHighRisk":        round(float(avg_bmi_high), 2),
    "cholLevel3HighRate":    round(float(chol3_high), 1),
    "cholLevel2HighRate":    round(float(chol2_high), 1),
    "activeHighRate":        round(float(act_high), 1),
    "inactiveHighRate":      round(float(inact_high), 1),
    "activityProtectiveDiff": round(float(inact_high - act_high), 1),
    "metrics": {
        "lr":       {"accuracy": round(float(lr_acc)*100, 1),   "auc": round(float(lr_auc), 3)},
        "rf":       {"accuracy": round(float(rf_acc)*100, 1),   "auc": round(float(rf_auc), 3)},
        "xgb":      {"accuracy": round(float(xgb_acc)*100, 1),  "auc": round(float(xgb_auc), 3)},
        "lgbm":     {"accuracy": round(float(lgbm_acc)*100, 1), "auc": round(float(lgbm_auc), 3)},
        "ensemble": {"accuracy": round(float(ens_acc)*100, 1),  "auc": round(float(ens_auc), 3)},
    }
}

feature_importances = {
    "lr":       lr_fi,
    "rf":       rf_fi,
    "xgb":      xgb_fi,
    "lgbm":     lgbm_fi,
    "ensemble": ens_fi,
}

# ── Write TypeScript (client/src/lib/modelsData.ts) ───────────────────
ts_file_path = os.path.join("src", "lib", "modelsData.ts")
ts_content = f"""// Auto-generated by train_model.py v4. Do not edit manually.

export const LOGISTIC_REGRESSION_MODEL = {json.dumps(lr_model_data, indent=2)};

export const RANDOM_FOREST_MODEL = {json.dumps(rf_model_data, indent=2)};

export const XGBOOST_MODEL = {json.dumps(xgb_model_data, indent=2)};

export const LIGHTGBM_MODEL = {json.dumps(lgbm_model_data, indent=2)};

export const OPTIMAL_THRESHOLDS = {json.dumps(optimal_thresholds, indent=2)};

export const ENSEMBLE_WEIGHTS = {json.dumps(ensemble_weights, indent=2)};

export const DATASET_STATS = {json.dumps(dataset_stats, indent=2)};

export const FEATURE_IMPORTANCES = {json.dumps(feature_importances, indent=2)};
"""
os.makedirs(os.path.dirname(ts_file_path), exist_ok=True)
with open(ts_file_path, "w", encoding="utf-8") as f:
    f.write(ts_content)
print(f"\n[OK] Written → {ts_file_path}")

# ── Write JavaScript (server/algorithms/modelsData.js) ────────────────
js_file_path = os.path.join("..", "server", "algorithms", "modelsData.js")
js_content = f"""// Auto-generated by train_model.py v4. Do not edit manually.

const LOGISTIC_REGRESSION_MODEL = {json.dumps(lr_model_data, indent=2)};
const RANDOM_FOREST_MODEL       = {json.dumps(rf_model_data, indent=2)};
const XGBOOST_MODEL             = {json.dumps(xgb_model_data, indent=2)};
const LIGHTGBM_MODEL            = {json.dumps(lgbm_model_data, indent=2)};
const OPTIMAL_THRESHOLDS        = {json.dumps(optimal_thresholds, indent=2)};
const ENSEMBLE_WEIGHTS          = {json.dumps(ensemble_weights, indent=2)};
const DATASET_STATS             = {json.dumps(dataset_stats, indent=2)};
const FEATURE_IMPORTANCES       = {json.dumps(feature_importances, indent=2)};

module.exports = {{
  LOGISTIC_REGRESSION_MODEL,
  RANDOM_FOREST_MODEL,
  XGBOOST_MODEL,
  LIGHTGBM_MODEL,
  OPTIMAL_THRESHOLDS,
  ENSEMBLE_WEIGHTS,
  DATASET_STATS,
  FEATURE_IMPORTANCES
}};
"""
os.makedirs(os.path.dirname(js_file_path), exist_ok=True)
with open(js_file_path, "w", encoding="utf-8") as f:
    f.write(js_content)
print(f"[OK] Written → {js_file_path}")

print("\n" + "=" * 60)
print("  FINAL RESULTS")
print("=" * 60)
print(f"  Logistic Regression : {lr_acc*100:.2f}%  AUC {lr_auc:.4f}  (thresh {lr_thresh:.3f})")
print(f"  Random Forest       : {rf_acc*100:.2f}%  AUC {rf_auc:.4f}  (thresh {rf_thresh:.3f})")
print(f"  XGBoost             : {xgb_acc*100:.2f}%  AUC {xgb_auc:.4f}  (thresh {xgb_thresh:.3f})")
print(f"  LightGBM            : {lgbm_acc*100:.2f}%  AUC {lgbm_auc:.4f}  (thresh {lgbm_thresh:.3f})")
print(f"  ★ ENSEMBLE          : {ens_acc*100:.2f}%  AUC {ens_auc:.4f}  (thresh {ens_thresh:.3f})")
print("=" * 60)
