import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ROUTE_PATHS } from '@/lib/index';
// @ts-ignore
import Chart from 'chart.js/auto';
import './cvd-predictor.css';

import { buildFeatureVector, mergedPredict, type TreeNode } from '@/lib/predictor';

import {
  LOGISTIC_REGRESSION_MODEL as MODEL,
  RANDOM_FOREST_MODEL,
  XGBOOST_MODEL,
  LIGHTGBM_MODEL,
  OPTIMAL_THRESHOLDS,
  ENSEMBLE_WEIGHTS,
  DATASET_STATS,
  FEATURE_IMPORTANCES
} from '@/lib/modelsData';

export default function CvdPredictor() {
  const [age,    setAge]    = useState(45);
  const [gender, setGender] = useState(0);
  const [height, setHeight] = useState(168);
  const [weight, setWeight] = useState(70);
  const [sys,    setSys]    = useState(120);
  const [dia,    setDia]    = useState(80);
  const [chol,   setChol]   = useState(1);
  const [gluc,   setGluc]   = useState(1);
  const [smoke,  setSmoke]  = useState(0);
  const [active, setActive] = useState(1);
  const [alco,   setAlco]   = useState(0);

  const [hasPredicted, setHasPredicted] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof mergedPredict> & { vals: any } | null>(null);

  const fiChartRef      = useRef<HTMLCanvasElement>(null);
  const gaugeChartRef   = useRef<HTMLCanvasElement>(null);
  const modelBarRef     = useRef<HTMLCanvasElement>(null);
  const resultsRef      = useRef<HTMLDivElement>(null);

  const bmi = weight / ((height / 100) ** 2);

  const handlePredict = () => {
    const raw = buildFeatureVector(age, bmi, gender, chol, gluc, smoke, active, sys, dia, alco);
    const res = mergedPredict(raw);
    setResult({ ...res, vals: { age, bmi, chol, gluc, smoke, active, sys, dia, alco } });
    setHasPredicted(true);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  useEffect(() => {
    if (!hasPredicted || !result) return;
    const prob  = result.prob;
    const color = prob < 0.35 ? '#1D9E75' : prob < 0.6 ? '#EF9F27' : '#E24B4A';

    // ── Gauge ──────────────────────────────────────────────────────
    if (gaugeChartRef.current) {
      const ctx = gaugeChartRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 200, 110);
        const cx = 100, cy = 100, r = 80, lw = 14;
        ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
        ctx.strokeStyle = '#E8E6E0'; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + prob * Math.PI);
        ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
        [0.35, 0.6].forEach(v => {
          const a = Math.PI + v * Math.PI;
          ctx.beginPath();
          ctx.moveTo(cx + (r - 10) * Math.cos(a), cy + (r - 10) * Math.sin(a));
          ctx.lineTo(cx + (r + 2) * Math.cos(a), cy + (r + 2) * Math.sin(a));
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
        });
      }
    }

    // ── Model Breakdown Bar Chart ──────────────────────────────────
    if (modelBarRef.current) {
      const existing = Chart.getChart(modelBarRef.current);
      if (existing) existing.destroy();
      const { breakdown } = result;
      const keys   = ['lr', 'rf', 'xgb', 'lgbm'] as const;
      const labels  = keys.map(k => breakdown[k].name);
      const probs   = keys.map(k => Math.round(breakdown[k].prob * 100));
      const colors  = probs.map(p => p < 35 ? '#1D9E75' : p < 60 ? '#EF9F27' : '#E24B4A');
      new Chart(modelBarRef.current, {
        type: 'bar',
        data: { labels, datasets: [{ data: probs, backgroundColor: colors, borderRadius: 7, borderSkipped: false }] },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c: any) => ` ${c.raw}% CVD probability` } }
          },
          scales: {
            x: { min: 0, max: 100, ticks: { callback: (v: any) => v + '%' }, grid: { color: 'rgba(0,0,0,.05)' } },
            y: { grid: { display: false } }
          }
        }
      });
    }

    // ── Feature Importance Chart ───────────────────────────────────
    if (fiChartRef.current) {
      const existing = Chart.getChart(fiChartRef.current);
      if (existing) existing.destroy();
      const fi = (FEATURE_IMPORTANCES as Record<string, Record<string, number>>)['ensemble'];
      const entries = Object.entries(fi).sort((a, b) => b[1] - a[1]).slice(0, 10);
      new Chart(fiChartRef.current, {
        type: 'bar',
        data: {
          labels: entries.map(e => e[0]),
          datasets: [{ data: entries.map(e => e[1]), backgroundColor: entries.map(e => e[1] > 20 ? '#E24B4A' : e[1] > 10 ? '#EF9F27' : '#85B7EB'), borderRadius: 5, borderSkipped: false }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => ` ${c.raw}% importance` } } },
          scales: { x: { ticks: { callback: (v: any) => v + '%' }, grid: { color: 'rgba(0,0,0,.04)' } }, y: { grid: { display: false } } }
        }
      });
    }
  }, [hasPredicted, result]);

  const renderAdvice = () => {
    if (!result) return null;
    const { vals } = result;
    const advice: { t: string; title: string; text: string }[] = [];
    if (vals.sys >= 140)       advice.push({ t: 'danger',  title: 'High BP',             text: 'Systolic ≥140 mmHg — Stage 2 hypertension. Dataset avg is 126.7 mmHg.' });
    else if (vals.sys >= 130)  advice.push({ t: 'warning', title: 'Elevated BP',          text: 'Systolic 130–139 mmHg — Stage 1 hypertension. Consider lifestyle changes.' });
    else                       advice.push({ t: 'good',    title: 'Normal BP',            text: 'Systolic < 130 mmHg — blood pressure within healthy range.' });
    if (vals.chol === 3)       advice.push({ t: 'danger',  title: 'High Cholesterol',     text: 'Level 3 cholesterol — 76.3% HIGH-risk rate in dataset. Urgent review.' });
    else if (vals.chol === 2)  advice.push({ t: 'warning', title: 'Borderline Cholesterol', text: 'Level 2 cholesterol — 59.6% HIGH-risk rate. Diet & exercise help.' });
    else                       advice.push({ t: 'good',    title: 'Normal Cholesterol',   text: 'Cholesterol within normal range — continue healthy diet habits.' });
    if (vals.gluc === 3)       advice.push({ t: 'danger',  title: 'Diabetic Range',       text: 'Diabetic blood sugar level raises CVD risk significantly.' });
    else if (vals.gluc === 2)  advice.push({ t: 'warning', title: 'Pre-diabetic',         text: 'Pre-diabetic blood sugar — monitor glucose and reduce refined carbs.' });
    if (vals.active === 0)     advice.push({ t: 'warning', title: 'Inactive',             text: 'Inactive patients show 53.3% HIGH-risk vs 48.5% in active patients.' });
    else                       advice.push({ t: 'good',    title: 'Physically Active',    text: 'Active patients show 48.5% HIGH-risk — 4.8% lower than inactive peers.' });
    if (vals.smoke === 1)      advice.push({ t: 'danger',  title: 'Active Smoker',        text: 'Smoking increases CVD risk. Dataset evidence confirms higher risk.' });
    else                       advice.push({ t: 'good',    title: 'Non-smoker',           text: 'Non-smoking significantly reduces cardiovascular risk burden.' });
    if (vals.alcohol === 1)    advice.push({ t: 'warning', title: 'Alcohol Intake',       text: 'Regular alcohol consumption increases blood pressure and CVD susceptibility.' });
    else                       advice.push({ t: 'good',    title: 'Non-drinker',          text: 'Avoiding alcohol helps maintain stable blood pressure and cardiovascular health.' });
    if (vals.bmi >= 30)        advice.push({ t: 'warning', title: `BMI ${vals.bmi.toFixed(1)} — Obese`,     text: 'Avg BMI for HIGH-risk patients is 28.48. Weight reduction recommended.' });
    else if (vals.bmi < 18.5)  advice.push({ t: 'info',    title: `BMI ${vals.bmi.toFixed(1)} — Underweight`, text: 'Consider nutritional assessment and healthy weight gain strategies.' });
    else                       advice.push({ t: 'good',    title: `BMI ${vals.bmi.toFixed(1)} — Healthy`,   text: 'BMI within healthy range (18.5–25). High-risk avg is 28.48.' });
    return advice.slice(0, 8).map((a, i) => (
      <div key={i} className={`cvd-advice-card ${a.t}`}><strong>{a.title}</strong>{a.text}</div>
    ));
  };

  const renderFactorBars = () => {
    if (!result) return null;
    const { vals, z } = result;
    const fi = (FEATURE_IMPORTANCES as Record<string, Record<string, number>>)['ensemble'];
    const contribs = MODEL.labels.map((label: string, i: number) => ({
      label,
      contribution: z[i] * (fi[label] ?? 0) * 0.05
    }));
    const sorted = [...contribs].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 6);
    const maxC   = Math.max(...sorted.map(f => Math.abs(f.contribution)));
    return sorted.map((f, i) => {
      const isRisk = f.contribution > 0;
      const bc = isRisk ? '#E24B4A' : '#1D9E75';
      const w  = maxC > 0 ? Math.round(Math.abs(f.contribution) / maxC * 100) : 0;
      return (
        <div key={i} className="cvd-factor-row">
          <div className="cvd-factor-header">
            <span className="cvd-factor-name">{f.label}</span>
            <span style={{ fontWeight: 600, color: bc }}>{isRisk ? '↑ Increases Risk' : '↓ Reduces Risk'}</span>
          </div>
          <div className="cvd-factor-track"><div className="cvd-factor-fill" style={{ width: `${w}%`, background: bc }}></div></div>
        </div>
      );
    });
  };

  const prob       = result?.prob ?? 0;
  const pctString  = result ? Math.round(prob * 100) + '%' : '—';
  const color      = prob < 0.35 ? '#1D9E75' : prob < 0.6 ? '#EF9F27' : '#E24B4A';
  const levelText  = !result ? '—' : prob < 0.35 ? 'Low Risk' : prob < 0.6 ? 'Moderate Risk' : 'High Risk';
  const levelClass = !result ? '' : prob < 0.35 ? 'low' : prob < 0.6 ? 'moderate' : 'high';
  const ensAcc     = (DATASET_STATS as any).metrics?.ensemble?.accuracy ?? '—';
  const ensAuc     = (DATASET_STATS as any).metrics?.ensemble?.auc ?? '—';

  return (
    <div className="cvd-wrapper h-full">

      {/* NAV */}
      <nav className="cvd-nav">
        <div className="cvd-nav-left">
          <Link to={ROUTE_PATHS.SCAN_SELECT} className="mr-2 text-[#888] hover:text-[#333] transition-colors"><ChevronLeft size={24} /></Link>
          <div className="cvd-nav-icon">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402C1 3.514 3.393 1 6.9 1c2.04 0 3.718 1.24 5.1 3.02C13.382 2.24 15.062 1 17.1 1 20.607 1 23 3.514 23 7.191c0 4.105-5.371 8.863-11 14.402z" fill="white" /></svg>
          </div>
          <div>
            <div className="cvd-nav-brand">CardioPredict</div>
            <div className="cvd-nav-sub">AI-powered CVD risk assessment</div>
          </div>
        </div>
        <div className="cvd-nav-badge">
          {(DATASET_STATS as any).totalRecords?.toLocaleString()} patients · Ensemble AI · {ensAcc}% accuracy · AUC {ensAuc}
        </div>
      </nav>

      {/* STATS STRIP */}
      <div className="cvd-ds-strip">
        <div className="cvd-ds-cell"><div className="cvd-ds-num">{(DATASET_STATS as any).totalRecords?.toLocaleString()}</div><div className="cvd-ds-lbl">Total Records</div></div>
        <div className="cvd-ds-cell"><div className="cvd-ds-num">{(DATASET_STATS as any).highRiskRate}%</div><div className="cvd-ds-lbl">High-risk Patients</div></div>
        <div className="cvd-ds-cell"><div className="cvd-ds-num">{(DATASET_STATS as any).avgSystolicBP}</div><div className="cvd-ds-lbl">Avg Systolic BP (mmHg)</div></div>
        <div className="cvd-ds-cell"><div className="cvd-ds-num">{(DATASET_STATS as any).avgBmiHighRisk}</div><div className="cvd-ds-lbl">Avg BMI (High-risk)</div></div>
      </div>

      <div className="cvd-layout">
        {/* ── FORM PANEL ─────────────────────────────────────────── */}
        <div className="cvd-form-panel">
          <div className="cvd-form-header">
            <h2>Enter Patient Details</h2>
            <p>Adjust values and click Predict — all 4 AI models will run and merge their results</p>
          </div>

          {/* Demographics */}
          <div className="cvd-form-section">
            <div className="cvd-section-title">Demographics</div>
            <div className="cvd-field">
              <div className="cvd-slider-val"><label>Age</label><span className="cvd-val-num">{age}</span><span className="cvd-val-unit"> years</span></div>
              <input type="range" min="20" max="80" value={age} onChange={e => setAge(+e.target.value)} />
            </div>
            <div className="cvd-field">
              <label>Gender</label>
              <div className="cvd-toggle-group">
                <button className={`cvd-toggle-btn ${gender === 0 ? 'active teal' : ''}`} onClick={() => setGender(0)}>Female</button>
                <button className={`cvd-toggle-btn ${gender === 1 ? 'active red' : ''}`} onClick={() => setGender(1)}>Male</button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="cvd-form-section">
            <div className="cvd-section-title">Body Measurements</div>
            <div className="cvd-field-row">
              <div className="cvd-field"><label>Height (cm)</label><input type="number" value={height} min="130" max="220" onChange={e => setHeight(+e.target.value)} /></div>
              <div className="cvd-field"><label>Weight (kg)</label><input type="number" value={weight} min="30" max="200" onChange={e => setWeight(+e.target.value)} /></div>
            </div>
            <div className="cvd-field">
              <div className="cvd-slider-val">
                <label>BMI <span style={{ fontSize: '11px', color: 'var(--faint)' }}>(auto-calculated)</span></label>
                <span className="cvd-val-num">{bmi.toFixed(1)}</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: 'linear-gradient(to right,var(--blue) 0%,var(--blue) 21.25%,var(--teal) 21.25%,var(--teal) 37.5%,var(--amber) 37.5%,var(--amber) 50%,var(--red) 50%)', position: 'relative', marginTop: 16, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ position: 'absolute', height: 22, width: 4, background: '#1a1a18', top: -6, borderRadius: 2, border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', left: `${Math.min(100, Math.max(0, (bmi - 10) / 40 * 100))}%`, transition: '.3s cubic-bezier(0.175,.885,.32,1.275)' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--faint)', marginTop: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.02em' }}>
                <span style={{ color: bmi < 18.5 ? 'var(--blue)' : '', opacity: bmi < 18.5 ? 1 : 0.6 }}>Underweight</span>
                <span style={{ color: bmi >= 18.5 && bmi < 25 ? 'var(--teal)' : '', opacity: bmi >= 18.5 && bmi < 25 ? 1 : 0.6 }}>Normal</span>
                <span style={{ color: bmi >= 25 && bmi < 30 ? 'var(--amber)' : '', opacity: bmi >= 25 && bmi < 30 ? 1 : 0.6 }}>Overweight</span>
                <span style={{ color: bmi >= 30 ? 'var(--red)' : '', opacity: bmi >= 30 ? 1 : 0.6 }}>Obese</span>
              </div>
            </div>
          </div>

          {/* Blood Pressure */}
          <div className="cvd-form-section">
            <div className="cvd-section-title">Blood Pressure</div>
            <div className="cvd-field">
              <div className="cvd-slider-val"><label>Systolic (ap_hi)</label><span className="cvd-val-num">{sys}</span><span className="cvd-val-unit"> mmHg</span></div>
              <input type="range" min="80" max="220" value={sys} onChange={e => setSys(+e.target.value)} />
            </div>
            <div className="cvd-field">
              <div className="cvd-slider-val"><label>Diastolic (ap_lo)</label><span className="cvd-val-num">{dia}</span><span className="cvd-val-unit"> mmHg</span></div>
              <input type="range" min="40" max="140" value={dia} onChange={e => setDia(+e.target.value)} />
            </div>
          </div>

          {/* Lab Values */}
          <div className="cvd-form-section">
            <div className="cvd-section-title">Lab Values</div>
            <div className="cvd-field">
              <label>Cholesterol Level</label>
              <select value={chol} onChange={e => setChol(+e.target.value)}>
                <option value={1}>Normal (≤200 mg/dL)</option>
                <option value={2}>Above Normal (200–240 mg/dL)</option>
                <option value={3}>Well Above Normal (&gt;240 mg/dL)</option>
              </select>
            </div>
            <div className="cvd-field">
              <label>Glucose / Blood Sugar</label>
              <select value={gluc} onChange={e => setGluc(+e.target.value)}>
                <option value={1}>Normal (≤100 mg/dL)</option>
                <option value={2}>Pre-diabetic (100–126 mg/dL)</option>
                <option value={3}>Diabetic range (&gt;126 mg/dL)</option>
              </select>
            </div>
          </div>

          {/* Lifestyle */}
          <div className="cvd-form-section">
            <div className="cvd-section-title">Lifestyle</div>
            <div className="cvd-field">
              <label>Smoking</label>
              <div className="cvd-toggle-group">
                <button className={`cvd-toggle-btn ${smoke === 0 ? 'active teal' : ''}`} onClick={() => setSmoke(0)}>Non-smoker</button>
                <button className={`cvd-toggle-btn ${smoke === 1 ? 'active red' : ''}`} onClick={() => setSmoke(1)}>Smoker</button>
              </div>
            </div>
            <div className="cvd-field" style={{ marginTop: '.75rem' }}>
              <label>Physical Activity</label>
              <div className="cvd-toggle-group">
                <button className={`cvd-toggle-btn ${active === 0 ? 'active red' : ''}`} onClick={() => setActive(0)}>Inactive</button>
                <button className={`cvd-toggle-btn ${active === 1 ? 'active teal' : ''}`} onClick={() => setActive(1)}>Active</button>
              </div>
            </div>
            <div className="cvd-field" style={{ marginTop: '.75rem' }}>
              <label>Alcohol Consumption</label>
              <div className="cvd-toggle-group">
                <button className={`cvd-toggle-btn ${alco === 0 ? 'active teal' : ''}`} onClick={() => setAlco(0)}>Non-drinker</button>
                <button className={`cvd-toggle-btn ${alco === 1 ? 'active red' : ''}`} onClick={() => setAlco(1)}>Drinker</button>
              </div>
            </div>
          </div>

          <button className="cvd-predict-btn" onClick={handlePredict}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            Analyse with All 4 AI Models
          </button>
          <div className="cvd-disclaimer"><strong>Disclaimer:</strong> For educational purposes only. Not a substitute for clinical diagnosis. Always consult a qualified healthcare professional.</div>
        </div>

        {/* ── RESULTS PANEL ─────────────────────────────────────── */}
        <div className="cvd-results-panel" ref={resultsRef}>
          {!hasPredicted ? (
            <div className="cvd-placeholder">
              <div className="cvd-placeholder-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402C1 3.514 3.393 1 6.9 1c2.04 0 3.718 1.24 5.1 3.02C13.382 2.24 15.062 1 17.1 1 20.607 1 23 3.514 23 7.191c0 4.105-5.371 8.863-11 14.402z" /></svg>
              </div>
              <h3>No prediction yet</h3>
              <p>Fill in patient details and click "Analyse" — all 4 AI models will work together to give you the most accurate prediction.</p>
              {/* AI Engine Badge */}
              <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                {['Logistic Regression', 'Random Forest', 'XGBoost', 'LightGBM'].map(m => (
                  <span key={m} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: 99, background: 'rgba(29,158,117,0.1)', color: 'var(--teal)', border: '1px solid rgba(29,158,117,0.2)' }}>{m}</span>
                ))}
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: 'linear-gradient(135deg,rgba(29,158,117,0.2),rgba(239,159,39,0.2))', color: '#555', border: '1.5px dashed rgba(29,158,117,0.4)' }}>→ Merged Ensemble</span>
              </div>
            </div>
          ) : (
            <div>

              {/* ── ENSEMBLE BADGE ── */}
              <div style={{ background: 'linear-gradient(135deg,rgba(29,158,117,0.08),rgba(239,159,39,0.08))', border: '1.5px solid rgba(29,158,117,0.2)', borderRadius: 12, padding: '10px 16px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, background: 'linear-gradient(135deg,#1D9E75,#EF9F27)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textTransform: 'uppercase', letterSpacing: '0.05em' }}>★ Ensemble AI</span>
                <span style={{ fontSize: '12px', color: '#666' }}>LR + Random Forest + XGBoost + LightGBM — weighted combination for maximum accuracy</span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: 'var(--teal)' }}>{ensAcc}% acc · AUC {ensAuc}</span>
              </div>

              {/* ── GAUGE CARD ── */}
              <div className="cvd-result-card">
                <div className="cvd-card-title">CVD Risk Prediction — Ensemble Result</div>
                <div className="cvd-gauge-wrap">
                  <canvas ref={gaugeChartRef} width="200" height="110"></canvas>
                  <div className="cvd-gauge-pct" style={{ color }}>{pctString}</div>
                </div>
                <div className="cvd-gauge-lbl">Merged AI probability score</div>
                <div className={`cvd-risk-level ${levelClass}`}>{levelText}</div>
                <div className="cvd-risk-pct-text">{pctString} estimated probability of cardiovascular disease</div>
                <div>
                  <div className="cvd-risk-bar-wrap"><div className="cvd-risk-bar-fill" style={{ width: pctString, background: color }}></div></div>
                  <div className="cvd-risk-markers"><span>Low risk</span><span>Moderate</span><span>High risk</span></div>
                </div>
              </div>

              {/* ── MODEL BREAKDOWN ── */}
              <div className="cvd-result-card">
                <div className="cvd-card-title">Individual Model Contributions</div>
                <div style={{ fontSize: '12px', color: 'var(--faint)', marginBottom: '0.75rem' }}>
                  Each model votes — the ensemble merges all predictions for the final result above.
                </div>
                <div style={{ position: 'relative', height: 160 }}><canvas ref={modelBarRef}></canvas></div>
                {/* Model weight pills */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                  {result && Object.entries(result.breakdown).map(([key, m]) => (
                    <div key={key} style={{ flex: '1 1 calc(50% - 0.25rem)', minWidth: 120, background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.name}</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: m.prob < 0.35 ? '#1D9E75' : m.prob < 0.6 ? '#EF9F27' : '#E24B4A', marginTop: 2 }}>{Math.round(m.prob * 100)}%</div>
                      <div style={{ fontSize: '10px', color: 'var(--faint)' }}>Model acc: {m.acc}%</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── FACTOR BARS ── */}
              <div className="cvd-result-card">
                <div className="cvd-card-title">Key Risk Factors (Ensemble Weighted)</div>
                <div>{renderFactorBars()}</div>
              </div>

              {/* ── CLINICAL OBSERVATIONS ── */}
              <div className="cvd-result-card">
                <div className="cvd-card-title">Clinical Observations</div>
                <div className="cvd-advice-grid">{renderAdvice()}</div>
              </div>

              {/* ── FEATURE IMPORTANCE ── */}
              <div className="cvd-result-card">
                <div className="cvd-card-title">
                  Feature Importances — Ensemble Average
                  <span className="cvd-trained-badge">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                    {(DATASET_STATS as any).totalRecords?.toLocaleString()} patients
                  </span>
                </div>
                <div style={{ position: 'relative', height: 260 }}><canvas ref={fiChartRef}></canvas></div>
              </div>

              {/* ── HOW IT WORKS ── */}
              <div className="cvd-sources-card">
                <h4>How the Ensemble AI Works</h4>
                <div className="cvd-source-row">
                  <span className="cvd-source-name">Logistic Regression (15%)</span>
                  <span className="cvd-source-meta">Linear baseline — fast, interpretable decision boundary</span>
                </div>
                <div className="cvd-source-row">
                  <span className="cvd-source-name">Random Forest (25%)</span>
                  <span className="cvd-source-meta">200 decision trees — captures non-linear patterns</span>
                </div>
                <div className="cvd-source-row">
                  <span className="cvd-source-name">XGBoost (30%)</span>
                  <span className="cvd-source-meta">Gradient boosted trees — sequentially corrects errors</span>
                </div>
                <div className="cvd-source-row">
                  <span className="cvd-source-name">LightGBM (30%)</span>
                  <span className="cvd-source-meta">Leaf-wise tree growth — highest individual accuracy</span>
                </div>
                <div className="cvd-source-row" style={{ background: 'rgba(29,158,117,0.06)', borderRadius: 6, padding: '6px 8px' }}>
                  <span className="cvd-source-name" style={{ color: 'var(--teal)' }}>Ensemble Output</span>
                  <span className="cvd-source-meta">Weighted vote · Youden's optimal threshold · 17 clinical features · 68,629 records</span>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
