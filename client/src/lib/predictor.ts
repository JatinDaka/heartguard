// client/src/lib/predictor.ts
import {
  LOGISTIC_REGRESSION_MODEL as MODEL,
  RANDOM_FOREST_MODEL,
  XGBOOST_MODEL,
  LIGHTGBM_MODEL,
  OPTIMAL_THRESHOLDS,
  ENSEMBLE_WEIGHTS,
  DATASET_STATS
} from './modelsData';
import { getUserProfile } from './userProfile';

export interface TreeNode {
  leaf?: number;
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

function predictTree(node: TreeNode, features: number[]): number {
  if (node.leaf !== undefined) return node.leaf;
  return features[node.feature!] <= node.threshold!
    ? predictTree(node.left!, features)
    : predictTree(node.right!, features);
}

function predictForest(forest: TreeNode[], features: number[]): number {
  let sum = 0;
  for (const tree of forest) {
    sum += predictTree(tree, features);
  }
  return sum / forest.length;
}

function predictXGBoostTrees(forest: TreeNode[], features: number[]): number {
  let score = 0;
  for (const tree of forest) {
    score += predictTree(tree, features);
  }
  return sigmoid(score);
}

function predictLightGBM(forest: TreeNode[], features: number[]): number {
  let score = 0;
  for (const tree of forest) {
    score += predictTree(tree, features);
  }
  return sigmoid(score);
}

// Build 21-feature vector matching train_model.py v4 optimized
export function buildFeatureVector(
  age: number,
  bmi: number,
  gender: number,
  chol: number,
  gluc: number,
  smoke: number,
  active: number,
  sys: number,
  dia: number,
  alcohol: number
): number[] {
  const pulse = sys - dia;
  const map = dia + pulse / 3.0;
  const isHypertensive = (sys >= 130 || dia >= 80) ? 1 : 0;
  const isObese = bmi >= 30 ? 1 : 0;
  const ageChol = age * chol;
  const bpChol = sys * chol;
  const bmiAge = (bmi * age) / 100.0;
  const lifestyleRisk = smoke + alcohol + (1 - active);
  const ageSq = Math.pow(age / 10.0, 2);
  const sysSq = Math.pow(sys / 100.0, 2);

  let bpCat = 0;
  if (sys >= 140 || dia >= 90) {
    bpCat = 3;
  } else if ((sys >= 130 && sys < 140) || (dia >= 80 && dia < 90)) {
    bpCat = 2;
  } else if (sys >= 120 && sys < 130 && dia < 80) {
    bpCat = 1;
  }

  return [
    age,
    bmi,
    gender,
    chol,
    gluc,
    smoke,
    active,
    sys,
    dia,
    alcohol,
    pulse,
    map,
    isHypertensive,
    isObese,
    ageChol,
    bpChol,
    bmiAge,
    lifestyleRisk,
    ageSq,
    sysSq,
    bpCat
  ];
}

// Merged ensemble prediction — all 4 models combined
export function mergedPredict(raw: number[]) {
  const z = raw.map((v, i) => (v - MODEL.means[i]) / MODEL.stds[i]);
  const w = ENSEMBLE_WEIGHTS as Record<string, number>;
  const th = OPTIMAL_THRESHOLDS as Record<string, number>;

  const lrLogit = z.reduce((s, v, i) => s + v * MODEL.coef[i], MODEL.intercept);
  const lrProb = sigmoid(lrLogit);
  const rfProb = predictForest(RANDOM_FOREST_MODEL as TreeNode[], z);
  const xgbProb = predictXGBoostTrees(XGBOOST_MODEL as TreeNode[], z);
  const lgbmProb = predictLightGBM(LIGHTGBM_MODEL as TreeNode[], z);

  const ensProb = w.lr * lrProb + w.rf * rfProb + w.xgb * xgbProb + w.lgbm * lgbmProb;
  const ensThresh = th.ensemble ?? 0.5;
  const isHighRisk = ensProb >= ensThresh;

  return {
    prob: ensProb,
    isHighRisk,
    breakdown: {
      lr: { prob: lrProb, name: 'Logistic Regression', acc: (DATASET_STATS as any).metrics.lr.accuracy },
      rf: { prob: rfProb, name: 'Random Forest', acc: (DATASET_STATS as any).metrics.rf.accuracy },
      xgb: { prob: xgbProb, name: 'XGBoost', acc: (DATASET_STATS as any).metrics.xgb.accuracy },
      lgbm: { prob: lgbmProb, name: 'LightGBM', acc: (DATASET_STATS as any).metrics.lgbm.accuracy },
    },
    z,
  };
}

// Predict from Active Scan results — uses the user's saved health profile
export function predictFromScan(bpm: number, systolic: number, diastolic: number) {
  const profile = getUserProfile();
  const bmi = profile.weight / Math.pow(profile.height / 100, 2);
  console.log('[HeartGuard] predictFromScan using profile:', profile, 'BMI:', bmi.toFixed(1), 'Vitals:', { bpm, systolic, diastolic });

  const rawFeatures = buildFeatureVector(
    profile.age,
    bmi,
    profile.gender,
    profile.cholesterol,
    profile.glucose,
    profile.smoking,
    profile.active,
    systolic,
    diastolic,
    profile.alcohol
  );

  const prediction = mergedPredict(rawFeatures);

  // Health Score Calculation based on probability & vitals
  let healthScore = Math.round((1 - prediction.prob) * 100);

  // Abnormal heart rate penalties
  if (bpm < 60 || bpm > 100) healthScore -= 10;
  else if (bpm < 65 || bpm > 90) healthScore -= 4;

  // Abnormal blood pressure penalties
  if (systolic >= 140 || diastolic >= 90) healthScore -= 15;
  else if (systolic >= 130 || diastolic >= 80) healthScore -= 7;

  healthScore = Math.max(5, Math.min(100, healthScore));

  return {
    cvdProbability: prediction.prob,
    healthScore,
    aiConfidence: 95
  };
}
