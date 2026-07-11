import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ChevronRight, User, Save, CheckCircle2 } from 'lucide-react';
import { getUserProfile, saveUserProfile, type UserProfile } from '@/lib/userProfile';
import { clearScanHistory } from '@/lib/scanHistory';

export default function Settings() {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceSensitivity, setVoiceSensitivity] = useState([50]);
  const [voiceConfirmation, setVoiceConfirmation] = useState(true);
  const [dailyReminders, setDailyReminders] = useState(true);
  const [scanAlerts, setScanAlerts] = useState(false);

  // ── Health Profile state ──
  const [profile, setProfile] = useState<UserProfile>(getUserProfile);
  const [profileSaved, setProfileSaved] = useState(false);

  const updateProfile = (patch: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...patch }));
    setProfileSaved(false);
  };

  const handleSaveProfile = () => {
    saveUserProfile(profile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const handleSaveContact = () => {
    console.log('Saving contact:', { contactName, contactPhone });
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear all scan history? This action cannot be undone.')) {
      clearScanHistory();
    }
  };

  const getSensitivityLabel = (value: number) => {
    if (value < 33) return 'Low';
    if (value < 67) return 'Medium';
    return 'High';
  };

  const bmi = profile.weight / Math.pow(profile.height / 100, 2);

  return (
    <Layout>
      <div className="min-h-screen bg-background pb-24">
        <div className="max-w-lg mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold mb-8">Settings</h1>

          <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Guest User</h2>
                <p className="text-sm text-muted-foreground">guest@heartguard.app</p>
              </div>
            </div>
          </div>

          {/* ── HEALTH PROFILE ── */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-1">Health Profile</h3>
            <p className="text-sm text-muted-foreground mb-5">
              This data is used by the AI models during Active Scan for personalised risk prediction.
            </p>

            {/* Age */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Age</label>
                <span className="text-sm font-semibold text-primary">{profile.age} years</span>
              </div>
              <input
                type="range" min={18} max={90} value={profile.age}
                onChange={e => updateProfile({ age: +e.target.value })}
                className="w-full accent-primary"
              />
            </div>

            {/* Height & Weight side-by-side */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium mb-2">Height (cm)</label>
                <Input
                  type="number" min={100} max={230}
                  value={profile.height}
                  onChange={e => updateProfile({ height: +e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Weight (kg)</label>
                <Input
                  type="number" min={30} max={250}
                  value={profile.weight}
                  onChange={e => updateProfile({ weight: +e.target.value })}
                />
              </div>
            </div>

            {/* BMI display */}
            <div className="bg-muted/40 rounded-lg px-4 py-2 mb-5 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Calculated BMI</span>
              <span className={`text-sm font-bold ${bmi >= 30 ? 'text-destructive' : bmi >= 25 ? 'text-yellow-600' : 'text-green-600'}`}>
                {bmi.toFixed(1)}
              </span>
            </div>

            {/* Gender */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2">Gender</label>
              <div className="flex gap-2">
                <button
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${profile.gender === 0 ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
                  onClick={() => updateProfile({ gender: 0 })}
                >Female</button>
                <button
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${profile.gender === 1 ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
                  onClick={() => updateProfile({ gender: 1 })}
                >Male</button>
              </div>
            </div>

            {/* Cholesterol */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2">Cholesterol Level</label>
              <div className="flex gap-2">
                {([1, 2, 3] as const).map(v => (
                  <button key={v}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${profile.cholesterol === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
                    onClick={() => updateProfile({ cholesterol: v })}
                  >{v === 1 ? 'Normal' : v === 2 ? 'Above' : 'High'}</button>
                ))}
              </div>
            </div>

            {/* Glucose */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2">Glucose Level</label>
              <div className="flex gap-2">
                {([1, 2, 3] as const).map(v => (
                  <button key={v}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${profile.glucose === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
                    onClick={() => updateProfile({ glucose: v })}
                  >{v === 1 ? 'Normal' : v === 2 ? 'Above' : 'High'}</button>
                ))}
              </div>
            </div>

            {/* Lifestyle toggles */}
            <div className="space-y-4 mb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Smoking</p>
                  <p className="text-xs text-muted-foreground">Do you currently smoke?</p>
                </div>
                <Switch checked={profile.smoking === 1} onCheckedChange={v => updateProfile({ smoking: v ? 1 : 0 })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Physically Active</p>
                  <p className="text-xs text-muted-foreground">Regular exercise or physical activity</p>
                </div>
                <Switch checked={profile.active === 1} onCheckedChange={v => updateProfile({ active: v ? 1 : 0 })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Alcohol Consumption</p>
                  <p className="text-xs text-muted-foreground">Regular alcohol intake</p>
                </div>
                <Switch checked={profile.alcohol === 1} onCheckedChange={v => updateProfile({ alcohol: v ? 1 : 0 })} />
              </div>
            </div>

            {/* Save button */}
            <Button onClick={handleSaveProfile} className="w-full gap-2">
              {profileSaved ? (
                <><CheckCircle2 className="w-4 h-4" /> Profile Saved!</>
              ) : (
                <><Save className="w-4 h-4" /> Save Health Profile</>
              )}
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Voice Control</h3>
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium">Enable Voice Commands</p>
                <p className="text-sm text-muted-foreground">Activate voice-based controls</p>
              </div>
              <Switch checked={voiceEnabled} onCheckedChange={setVoiceEnabled} />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">Voice Sensitivity</p>
                <span className="text-sm text-muted-foreground">{getSensitivityLabel(voiceSensitivity[0])}</span>
              </div>
              <Slider
                value={voiceSensitivity}
                onValueChange={setVoiceSensitivity}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Voice Confirmation Sounds</p>
                <p className="text-sm text-muted-foreground">Audio feedback for commands</p>
              </div>
              <Switch checked={voiceConfirmation} onCheckedChange={setVoiceConfirmation} />
            </div>
          </div>


          <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Notifications</h3>
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium">Daily Reminders</p>
                <p className="text-sm text-muted-foreground">Get daily health check reminders</p>
              </div>
              <Switch checked={dailyReminders} onCheckedChange={setDailyReminders} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Scan Alerts</p>
                <p className="text-sm text-muted-foreground">Notifications for scan results</p>
              </div>
              <Switch checked={scanAlerts} onCheckedChange={setScanAlerts} />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">About</h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <p className="font-medium">App Version</p>
                <p className="text-muted-foreground">1.0.0</p>
              </div>

              <button className="w-full flex items-center justify-between py-2 hover:bg-accent/50 rounded-lg px-2 transition-colors">
                <p className="font-medium">Privacy Policy</p>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>

              <button className="w-full flex items-center justify-between py-2 hover:bg-accent/50 rounded-lg px-2 transition-colors">
                <p className="font-medium">Terms of Service</p>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 text-destructive">Danger Zone</h3>
            
            <Button
              variant="outline"
              onClick={handleClearHistory}
              className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              Clear All History
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
