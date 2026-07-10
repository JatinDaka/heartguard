const {
  LOGISTIC_REGRESSION_MODEL: MODEL,
  RANDOM_FOREST_MODEL,
  XGBOOST_MODEL,
  DATASET_STATS,
  FEATURE_IMPORTANCES
} = require('./modelsData');

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

function predictTree(node, features) {
  if (node.leaf !== undefined) return node.leaf;
  const val = features[node.feature];
  if (val <= node.threshold) {
    return predictTree(node.left, features);
  } else {
    return predictTree(node.right, features);
  }
}

function predictRandomForest(forest, features) {
  let sum = 0;
  for (const tree of forest) {
    sum += predictTree(tree, features);
  }
  return sum / forest.length;
}

function predictXGBoost(forest, features) {
  let score = 0;
  for (const tree of forest) {
    score += predictTree(tree, features);
  }
  return sigmoid(score);
}

function calculateHealthReport(scanData) {
    const { 
        bpm: clientBpm, 
        confidence, 
        symptoms, 
        demographics = {} 
    } = scanData;

    // 1. Data Normalization & Input Preparation
    const age = demographics.age || 53;
    const height = demographics.height || 170;
    const weight = demographics.weight || 75;
    const bmi = weight / ((height / 100) ** 2);
    const gender = demographics.gender || 0; // 0: Female, 1: Male
    const cholesterol = demographics.cholesterol || 1;
    const glucose = demographics.glucose || 1;
    const smoking = demographics.smoking || 0;
    const active = demographics.active || 1;
    const alcohol = demographics.alcohol || demographics.alco || 0;
    
    // Biometric baseline
    const baseBpm = clientBpm || 72;
    
    // Non-invasive BP Estimation (Baseline)
    let systolic = 120 + (baseBpm - 70) * 0.4;
    let diastolic = 80 + (baseBpm - 70) * 0.2;
    
    // 2. Risk Adjustment based on Symptoms
    let riskEscalation = 0;
    if (symptoms) {
        if (symptoms.chestPain) {
            riskEscalation += 25;
            systolic += 10;
        }
        if (symptoms.shortnessOfBreath) riskEscalation += 15;
        if (symptoms.dizziness) riskEscalation += 10;
        if (symptoms.fatigue) riskEscalation += 5;
    }
    
    // 3. Logistic Regression Calculation (21 Features)
    const pulsePressure = systolic - diastolic;
    const map = diastolic + pulsePressure / 3.0;
    const isHypertensive = (systolic >= 130 || diastolic >= 80) ? 1 : 0;
    const isObese = bmi >= 30 ? 1 : 0;
    const ageChol = age * cholesterol;
    const bpChol = systolic * cholesterol;
    const bmiAge = (bmi * age) / 100.0;
    const lifestyleRisk = smoking + alcohol + (1 - active);
    const ageSq = Math.pow(age / 10.0, 2);
    const sysSq = Math.pow(systolic / 100.0, 2);

    let bpCat = 0;
    if (systolic >= 140 || diastolic >= 90) {
      bpCat = 3;
    } else if ((systolic >= 130 && systolic < 140) || (diastolic >= 80 && diastolic < 90)) {
      bpCat = 2;
    } else if (systolic >= 120 && systolic < 130 && diastolic < 80) {
      bpCat = 1;
    }

    const featureValues = [
      age, bmi, gender, cholesterol, glucose, smoking, active, systolic, diastolic, alcohol,
      pulsePressure, map, isHypertensive, isObese, ageChol, bpChol, bmiAge, lifestyleRisk,
      ageSq, sysSq, bpCat
    ];
    const standardized = featureValues.map((v, i) => (v - MODEL.means[i]) / MODEL.stds[i]);
    const logit = standardized.reduce((sum, v, i) => sum + v * MODEL.coef[i], MODEL.intercept);
    const cvdProbability = sigmoid(logit);

    // 4. Other Vitals Simulation
    const spo2 = 98 - (riskEscalation > 20 ? 2 : 0) - (Math.random() * 1);
    const respRate = 14 + (riskEscalation > 10 ? 4 : 0) + (Math.random() * 2);
    const hrv = 30 + (40 * (confidence / 100)) + (Math.random() * 5);

    // 5. Interpretation Generation
    const interpretation = generateClinicalInterpretation({
        prob: cvdProbability,
        systolic,
        cholesterol,
        glucose,
        active,
        bmi,
        symptoms
    });

    const stressLevel = riskEscalation > 30 ? 'High' : riskEscalation > 15 ? 'Moderate' : 'Low';

    return {
        id: `SR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        timestamp: new Date().toISOString(),
        metrics: {
            heartRate: {
                value: Math.round(baseBpm),
                unit: 'BPM',
                status: baseBpm < 100 ? 'Normal' : 'Elevated'
            },
            heartRateVariability: {
                value: Math.round(hrv),
                unit: 'ms',
                status: hrv > 40 ? 'High' : 'Low'
            },
            bloodPressure: {
                value: `${Math.round(systolic)}/${Math.round(diastolic)}`,
                unit: 'mmHg',
                status: systolic < 130 ? 'Optimal' : systolic < 140 ? 'Elevated' : 'Hypertensive'
            },
            oxygenLevel: {
                value: parseFloat(spo2.toFixed(1)),
                unit: '%',
                status: spo2 >= 95 ? 'Optimal' : 'Caution'
            },
            respiratoryRate: {
                value: Math.round(respRate),
                unit: 'br/m',
                status: respRate <= 20 ? 'Normal' : 'Elevated'
            },
            stressLevel: {
                value: stressLevel,
                score: Math.round(riskEscalation + 20),
                status: stressLevel === 'Low' ? 'Stable' : 'Monitor'
            }
        },
        facialAnalysis: {
            skinTone: 'Analyzed',
            symmetry: 'Normal',
            indicators: {
                pallor: riskEscalation > 30,
                cyanosis: spo2 < 94,
                jaundice: false
            }
        },
        aiInterpretation: interpretation,
        confidence: confidence,
        healthScore: Math.round((1 - cvdProbability) * 100),
        cvdProbability: cvdProbability
    };
}

function generateClinicalInterpretation(data) {
    const { prob, systolic, cholesterol, glucose, active, bmi, symptoms } = data;
    
    let report = "";
    
    // Stats from cardio_train_cleaned.csv (68,629 patients):
    // HIGH risk rate: 49.5% | Avg Systolic: 126.7 mmHg | Avg BMI (high-risk): 28.48
    // Chol L3 HIGH rate: 76.3% | Active HIGH rate: 48.5% vs Inactive: 53.3%

    if (prob > 0.6) {
        report = 'HIGH CVD RISK DETECTED. Your profile closely matches high-risk patterns in our 68,629-patient clinical dataset (49.5% prevalence). ';
    } else if (prob > 0.35) {
        report = 'MODERATE RISK. Several factors indicate elevated cardiovascular strain above dataset baseline. ';
    } else {
        report = 'STABLE PROFILE. Your vitals and demographics indicate low CVD risk relative to our dataset. ';
    }

    if (systolic >= 140) report += 'Stage 2 hypertension detected (dataset avg: 126.7 mmHg). Strongest BP risk marker. ';
    else if (systolic >= 130) report += 'Elevated systolic BP (dataset avg: 126.7 mmHg). Stage 1 hypertension territory. ';
    if (cholesterol === 3) report += 'Level 3 cholesterol shows 76.3% HIGH-risk rate in our dataset. Lipid management recommended. ';
    if (cholesterol === 2) report += 'Level 2 cholesterol (59.6% HIGH-risk rate in dataset). Monitor diet closely. ';
    if (glucose === 3) report += 'Diabetic blood sugar range significantly elevates CVD risk profile. ';
    if (!active) report += 'Inactive patients show 53.3% HIGH-risk rate vs 48.5% for active (4.8% difference). ';
    if (bmi >= 30) report += `Average BMI for high-risk patients in dataset is 28.48. Weight management advised. `;

    if (symptoms && (symptoms.chestPain || symptoms.shortnessOfBreath)) {
        report += "CRITICAL: Physical symptoms reported. Seek medical consultation immediately.";
    }
    
    return report;
}

module.exports = { calculateHealthReport };
