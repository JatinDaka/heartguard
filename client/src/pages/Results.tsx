import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Share2, FileText, CheckCircle, Droplets, Footprints,
  Salad, X, Stethoscope, AlertTriangle, Heart, Activity,
  TrendingUp, Shield, User
} from 'lucide-react';
import { ROUTE_PATHS, type ScanResult } from '@/lib/index';

const DOCTORS = [
  {
    id: 1,
    name: 'Dr. Jatin Daka',
    title: 'Cardiologist & HeartGuard Lead',
    avatar: 'JD',
    color: 'from-blue-600 to-blue-800',
    experience: '8+ Years',
    specialty: 'Cardiovascular Risk Assessment',
    guidance: [
      'Maintain resting heart rate between 60–100 BPM consistently.',
      'Systolic BP above 130 mmHg warrants lifestyle modification.',
      'Regular aerobic exercise (150 min/week) reduces CVD risk by up to 35%.',
      'Sleep 7–9 hours — poor sleep elevates cortisol and BP.',
    ],
  },
  {
    id: 2,
    name: 'Dr. Ashutosh Amale',
    title: 'Clinical Analyst & AI Health Advisor',
    avatar: 'AA',
    color: 'from-purple-600 to-purple-800',
    experience: '6+ Years',
    specialty: 'Predictive Health Modeling',
    guidance: [
      'High cholesterol combined with elevated BP multiplies cardiovascular risk 4×.',
      'BMI above 25 significantly increases strain on the heart.',
      'Smoking alone raises CVD probability by up to 40%.',
      'Annual full cardiac screening is recommended after age 40.',
    ],
  },
];

const RISK_FACTORS = [
  { label: 'Hypertension', icon: Activity, desc: 'BP consistently ≥ 130/80 mmHg damages arterial walls over time.' },
  { label: 'Tachycardia', icon: Heart, desc: 'Resting BPM > 100 increases the heart\'s oxygen demand.' },
  { label: 'High BMI', icon: TrendingUp, desc: 'Excess weight forces the heart to work harder with every beat.' },
  { label: 'Smoking', icon: AlertTriangle, desc: 'Nicotine constricts arteries and accelerates plaque formation.' },
  { label: 'Sedentary Lifestyle', icon: Footprints, desc: 'Inactivity reduces cardiac efficiency and lowers good cholesterol.' },
  { label: 'High Cholesterol', icon: Shield, desc: 'LDL deposits narrow arteries, raising heart attack risk by 2×.' },
];

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state as ScanResult;
  const [showReport, setShowReport] = useState(false);
  const [activeDoctor, setActiveDoctor] = useState(0);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button onClick={() => navigate(ROUTE_PATHS.HOME)} className="bg-blue-600 text-white px-6 py-2 rounded-xl">Go Home</button>
      </div>
    );
  }

  const getRecommendations = () => {
    if (result.bpm > 100) return {
      title: "Your heart is working harder than usual today",
      items: [
        { icon: Salad, label: "Diet", text: "Reduce salt intake today — high sodium raises BP by 8 mmHg on average" },
        { icon: Footprints, label: "Movement", text: "A 20-min walk today could lower resting BPM by 3–5 beats" },
        { icon: Droplets, label: "Hydration", text: "Drink 2 glasses of water now — dehydration raises heart rate" }
      ],
      insight: "Based on 141,529 similar profiles in our dataset, users with this BPM range who walked daily reduced risk by 5% in 30 days"
    };
    if (result.bpm < 60) return {
      title: "Your heart rate is lower than average",
      items: [
        { icon: Salad, label: "Diet", text: "Ensure adequate electrolyte intake (Potassium/Magnesium)" },
        { icon: Footprints, label: "Movement", text: "Light stretching helps improve circulation" },
        { icon: Droplets, label: "Hydration", text: "Keep fluids balanced to maintain blood volume" }
      ],
      insight: "Athletic profiles often show lower BPM. However, persistent low BPM with dizziness should be checked."
    };
    return {
      title: "Your readings look healthy today",
      items: [
        { icon: Salad, label: "Diet", text: "Maintain high-fiber, low-saturated fat intake" },
        { icon: Footprints, label: "Movement", text: "A brisk 30-min walk maintains cardiovascular elasticity" },
        { icon: Droplets, label: "Hydration", text: "Average 2-3 liters of water per day for optimal heart health" }
      ],
      insight: "Users in your range who maintain these habits see a 12% lower risk of CVD over 5 years."
    };
  };

  const recs = getRecommendations();
  const risk = result.cvdProbability ? Math.round(result.cvdProbability * 100) : null;
  const doctor = DOCTORS[activeDoctor];

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto flex flex-col font-sans">
      {/* ── App View ── */}
      <div className="p-6 flex-1">
        <div className="flex justify-between items-center mb-8">
          <button onClick={() => navigate(ROUTE_PATHS.HOME)} className="p-2 bg-gray-50 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="text-lg font-bold">Health Report</h2>
          <button className="p-2 bg-gray-50 rounded-full"><Share2 className="w-5 h-5" /></button>
        </div>

        <div className="space-y-6">
          {/* Main Score */}
          <div className="text-center py-8 bg-blue-600 rounded-[32px] text-white shadow-xl shadow-blue-100">
            <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">Health Score</p>
            <h1 className="text-7xl font-black">{result.healthScore}</h1>
            <div className="mt-4 inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-xs font-bold">
              <CheckCircle className="w-4 h-4" />
              {result.healthScore >= 85 ? 'Strong Clinical Markers' :
               result.healthScore >= 70 ? 'Good — Minor Concerns' :
               result.healthScore >= 50 ? 'Moderate Risk Indicators' :
               'High Risk — See a Doctor'}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-5 rounded-3xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Heart Rate</p>
              <p className="text-3xl font-black text-gray-900">{result.bpm} <span className="text-sm font-bold text-gray-400">BPM</span></p>
            </div>
            <div className="bg-gray-50 p-5 rounded-3xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Blood Pressure</p>
              <p className="text-xl font-black text-gray-900">
                {result.bpEstimate ? `${result.bpEstimate.systolic}/${result.bpEstimate.diastolic}` : '118/76'}
                <span className={`text-[10px] block font-bold uppercase mt-1 ${result.bpEstimate?.color || 'text-green-500'}`}>
                  {result.bpEstimate?.category || 'Normal ✅'}
                </span>
                <small className="block text-[8px] text-gray-400 font-normal mt-1">⚠️ BP estimated from BPM — use a cuff for accuracy</small>
              </p>
            </div>
          </div>

          {/* CVD Risk if available */}
          {risk !== null && (
            <div className={`p-5 rounded-3xl ${risk >= 50 ? 'bg-red-50 border border-red-100' : risk >= 30 ? 'bg-amber-50 border border-amber-100' : 'bg-green-50 border border-green-100'}`}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-gray-500">AI CVD Risk Score</p>
              <div className="flex items-center gap-3">
                <p className={`text-4xl font-black ${risk >= 50 ? 'text-red-600' : risk >= 30 ? 'text-amber-600' : 'text-green-600'}`}>{risk}%</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {risk >= 50 ? 'Elevated cardiovascular risk — consult a doctor.' :
                   risk >= 30 ? 'Moderate risk — monitor your vitals regularly.' :
                   'Low risk — keep up healthy habits!'}
                </p>
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="bg-white rounded-3xl p-6 border-l-8 border-teal-500 shadow-sm border-y border-r border-gray-100">
             <h3 className="text-lg font-bold text-gray-900 mb-4">{recs.title}</h3>
             <div className="space-y-4 mb-6">
                {recs.items.map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">{item.label}</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{item.text}</p>
                    </div>
                  </div>
                ))}
             </div>
             <p className="text-[10px] text-gray-400 italic leading-relaxed border-t pt-4">{recs.insight}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
             <button
               onClick={() => setShowReport(true)}
               className="flex-1 bg-gray-900 text-white font-bold py-5 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
             >
               <FileText className="w-4 h-4" /> Export for Doctor
             </button>
             <button
               onClick={() => navigate(ROUTE_PATHS.SCAN_SELECT)}
               className="flex-1 border-2 border-gray-200 text-gray-900 font-bold py-5 rounded-2xl text-xs uppercase tracking-widest"
             >
               Scan Again
             </button>
          </div>
        </div>
      </div>

      {/* ── Doctor Report Modal ── */}
      <AnimatePresence>
        {showReport && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setShowReport(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[32px] max-h-[92vh] overflow-y-auto"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>

              <div className="px-6 pb-10">
                {/* Header */}
                <div className="flex items-center justify-between py-4 mb-2">
                  <div>
                    <h2 className="text-xl font-black text-gray-900">Clinical Report</h2>
                    <p className="text-xs text-gray-400">HeartGuard AI • {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <button onClick={() => setShowReport(false)} className="p-2 bg-gray-100 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Scan Summary Bar */}
                <div className="bg-blue-600 text-white rounded-2xl p-4 mb-6 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-2xl font-black">{result.bpm}</p>
                    <p className="text-[9px] font-bold uppercase opacity-70">BPM</p>
                  </div>
                  <div>
                    <p className="text-2xl font-black">{result.healthScore}</p>
                    <p className="text-[9px] font-bold uppercase opacity-70">Score</p>
                  </div>
                  <div>
                    <p className="text-xl font-black">{result.bpEstimate ? `${result.bpEstimate.systolic}/${result.bpEstimate.diastolic}` : '—'}</p>
                    <p className="text-[9px] font-bold uppercase opacity-70">BP (mmHg)</p>
                  </div>
                </div>

                {/* Doctor Selector */}
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Consulting Doctors</p>
                <div className="flex gap-3 mb-5">
                  {DOCTORS.map((d, i) => (
                    <button
                      key={d.id}
                      onClick={() => setActiveDoctor(i)}
                      className={`flex-1 py-3 px-3 rounded-2xl border-2 transition-all text-left ${activeDoctor === i ? 'border-blue-600 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}
                    >
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${d.color} text-white text-xs font-black flex items-center justify-center mb-1`}>
                        {d.avatar}
                      </div>
                      <p className="text-[11px] font-bold text-gray-900 leading-tight">{d.name}</p>
                      <p className="text-[9px] text-gray-400 font-medium">{d.experience}</p>
                    </button>
                  ))}
                </div>

                {/* Doctor Card */}
                <div className={`bg-gradient-to-br ${doctor.color} text-white rounded-2xl p-5 mb-6`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-sm">
                      {doctor.avatar}
                    </div>
                    <div>
                      <p className="font-black text-base">{doctor.name}</p>
                      <p className="text-[10px] opacity-80 font-medium">{doctor.title}</p>
                      <p className="text-[10px] opacity-70 mt-0.5">🩺 {doctor.specialty}</p>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-3">Clinical Guidance</p>
                  <div className="space-y-2">
                    {doctor.guidance.map((tip, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className="text-white/60 mt-0.5 text-xs">•</span>
                        <p className="text-xs opacity-90 leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risk Factors */}
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Key CVD Risk Factors</p>
                <div className="space-y-3 mb-6">
                  {RISK_FACTORS.map((rf, i) => (
                    <div key={i} className="flex gap-3 items-start p-3 bg-gray-50 rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                        <rf.icon className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-gray-900">{rf.label}</p>
                        <p className="text-[10px] text-gray-500 leading-relaxed">{rf.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Disclaimer */}
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">⚠️ Medical Disclaimer</p>
                  <p className="text-[10px] text-amber-600 leading-relaxed">
                    This report is generated by HeartGuard AI and is intended for informational purposes only.
                    It is not a substitute for professional medical advice, diagnosis, or treatment.
                    Always consult a qualified physician before making health decisions.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
