import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, Heart, Wallet, Activity, Wind, X, CheckCircle2, Clock, AlertCircle, Plus, Target, BookOpen, ShieldAlert, Award, Medal, Trophy, Star, Crown, MessageCircle, Send, Loader2, BarChart2, TrendingUp, LayoutDashboard, Moon, Sun, Scale, Brain, Dna, Mic, Download, Sparkles, Coffee, Wine, Utensils, Users, Zap, Battery, HelpCircle, ActivitySquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { differenceInSeconds, addHours, isBefore, addMinutes, addMonths, differenceInMonths, addYears, addDays, differenceInDays, startOfDay, getHours } from 'date-fns';
import { GoogleGenAI, Type } from '@google/genai';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import Markdown from 'react-markdown';

type Reward = {
  id: string;
  name: string;
  price: number;
};

type UserData = {
  name: string;
  yearsSmoked: number;
  quitDate: string | null;
  isReduceMode: boolean;
  reduceStartDate: string | null;
  cigsPerDay: number;
  pricePerPack: number;
  cigsInPack: number;
  currency: string;
  rewardName: string; // Deprecated, kept for backwards compatibility
  rewardPrice: number; // Deprecated, kept for backwards compatibility
  rewards: Reward[];
  personalAnchor: string;
  isDarkMode: boolean;
  sosCount: number;
  aiMessageCount: number;
  therapistPersonality: 'empathetic' | 'strict' | 'rational';
  age: number | null;
  height: number | null;
  weight: number | null;
  geminiApiKey?: string;
  isDefumoxanMode?: boolean;
  defumoxanStartDate?: string | null;
  defumoxanPillsTaken?: string[];
};

type CravingLog = {
  id: string;
  timestamp: string;
  intensity: number; // 1-10
  trigger: string;
  mood?: string;
  note?: string;
};

const DEFAULT_USER_DATA: UserData = {
  name: '',
  yearsSmoked: 10,
  quitDate: null,
  isReduceMode: false,
  reduceStartDate: null,
  cigsPerDay: 20,
  pricePerPack: 150,
  cigsInPack: 20,
  currency: 'Kč',
  rewardName: 'Nové boty',
  rewardPrice: 2500,
  rewards: [{ id: '1', name: 'Nové boty', price: 2500 }],
  personalAnchor: 'Chci být zdravý a mít více energie do života.',
  isDarkMode: false,
  sosCount: 0,
  aiMessageCount: 0,
  therapistPersonality: 'empathetic',
  age: null,
  height: null,
  weight: null,
  geminiApiKey: '',
  isDefumoxanMode: false,
  defumoxanStartDate: null,
  defumoxanPillsTaken: [],
};

// Aktualizováno podle lékařské tabulky v dokumentu a dalších vědeckých poznatků
const MILESTONES = [
  { id: 'bp', label: 'Krevní tlak a tep se vrací k normálu', dateFn: (d: Date) => addMinutes(d, 20) },
  { id: 'co', label: 'Hladina oxidu uhelnatého klesá o 50 %', dateFn: (d: Date) => addHours(d, 8) },
  { id: 'co_normal', label: 'Hladina oxidu uhelnatého se vrací k normálu', dateFn: (d: Date) => addHours(d, 12) },
  { id: 'nicotine', label: 'Nikotin je finálně eliminován z těla', dateFn: (d: Date) => addHours(d, 48) },
  { id: 'senses', label: 'Zlepšuje se vnímání chuti a čichu', dateFn: (d: Date) => addHours(d, 48) },
  { id: 'breathing', label: 'Dýchání se stává snazším', dateFn: (d: Date) => addHours(d, 72) },
  { id: 'circulation', label: 'Zlepšuje se krevní oběh', dateFn: (d: Date) => addDays(d, 14) },
  { id: 'erectile', label: 'Zlepšení prokrvení a erektilní funkce', dateFn: (d: Date) => addMonths(d, 1) },
  { id: 'lungs', label: 'Zmírňování kašle, dýchací funkce se posilují', dateFn: (d: Date) => addMonths(d, 3) },
  { id: 'metabolism_3m', label: 'Konec metabolické bouře (stabilizace hmotnosti)', dateFn: (d: Date) => addMonths(d, 3) },
  { id: 'microbiome_6m', label: 'Stabilizace střevního mikrobiomu a trávení', dateFn: (d: Date) => addMonths(d, 6) },
  { id: 'heart', label: 'Riziko infarktu klesá na polovinu', dateFn: (d: Date) => addYears(d, 1) },
  { id: 'metabolism_1y', label: 'Kompletní reset metabolismu na úroveň nekuřáka', dateFn: (d: Date) => addYears(d, 1) },
  { id: 'stroke', label: 'Riziko mrtvice klesá na úroveň nekuřáka', dateFn: (d: Date) => addYears(d, 5) },
  { id: 'cancer', label: 'Riziko karcinomu plic klesá o 50 %', dateFn: (d: Date) => addYears(d, 10) },
  { id: 'heart_normal', label: 'Riziko srdečních onemocnění je stejné jako u nekuřáka', dateFn: (d: Date) => addYears(d, 15) },
];

const TRIGGERS = ['Stres', 'Nuda', 'Káva', 'Alkohol', 'Po jídle', 'Společnost kuřáků', 'Únava', 'Jiné'];

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl max-w-md w-full border border-rose-100 dark:border-rose-900/30">
            <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Jejda, něco se pokazilo</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm">
              Aplikace narazila na neočekávanou chybu. Omlouváme se za komplikace.
            </p>
            <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl text-left overflow-auto max-h-32 mb-6">
              <code className="text-xs text-rose-600 dark:text-rose-400 font-mono">
                {this.state.error?.message || "Neznámá chyba"}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold py-3 px-4 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
            >
              Znovu načíst aplikaci
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

function App() {
  const [userData, setUserData] = useState<UserData>(() => {
    try {
      const saved = localStorage.getItem('quitSmokingData');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migration for old data structure
        if (!parsed.rewards || parsed.rewards.length === 0) {
          parsed.rewards = [{ 
            id: Date.now().toString(), 
            name: parsed.rewardName || 'Odměna', 
            price: parsed.rewardPrice || 2500 
          }];
        }
        return { ...DEFAULT_USER_DATA, ...parsed };
      }
    } catch (e) {
      console.error('Failed to parse userData from localStorage', e);
    }
    return DEFAULT_USER_DATA;
  });

  const [cravings, setCravings] = useState<CravingLog[]>(() => {
    try {
      const saved = localStorage.getItem('quitSmokingCravings');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse cravings from localStorage', e);
      return [];
    }
  });

  const [smokedLogs, setSmokedLogs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('quitSmokingSmokedLogs');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse smokedLogs from localStorage', e);
      return [];
    }
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(!userData.quitDate);
  const [isCravingMode, setIsCravingMode] = useState(false);
  const [isLogCravingOpen, setIsLogCravingOpen] = useState(false);
  const [isLapsModalOpen, setIsLapsModalOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'home' | 'health' | 'achievements' | 'diary'>('home');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  useEffect(() => {
    localStorage.setItem('quitSmokingData', JSON.stringify(userData));
  }, [userData]);

  useEffect(() => {
    localStorage.setItem('quitSmokingCravings', JSON.stringify(cravings));
  }, [cravings]);

  useEffect(() => {
    localStorage.setItem('quitSmokingSmokedLogs', JSON.stringify(smokedLogs));
  }, [smokedLogs]);

  useEffect(() => {
    if (userData.isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [userData.isDarkMode]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); // Aktualizace každou minutu místo vteřiny pro lepší výkon
    return () => clearInterval(timer);
  }, []);

  const handleSaveSettings = (newData: UserData) => {
    setUserData(newData);
    setIsSettingsOpen(false);
  };

  const handleLogCraving = (intensity: number, trigger: string, mood?: string, note?: string) => {
    const newLog: CravingLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      intensity,
      trigger,
      mood,
      note
    };
    setCravings([newLog, ...cravings]);
    setIsLogCravingOpen(false);
  };

  const handleTakeDefumoxanPill = () => {
    setUserData(prev => ({
      ...prev,
      defumoxanPillsTaken: [...(prev.defumoxanPillsTaken || []), new Date().toISOString()]
    }));
  };

  const handleLogSmoke = () => {
    setSmokedLogs([...smokedLogs, new Date().toISOString()]);
  };

  const handleSwitchToQuit = () => {
    setUserData({
      ...userData,
      isReduceMode: false,
      quitDate: new Date().toISOString()
    });
  };

  const handleLaps = () => {
    // Neanulujeme progres úplně, jen upravíme datum, aby to nebyl demotivační šok (abstinence violation effect)
    // V reálné aplikaci by se laps logoval odděleně od relapsu. Pro jednoduchost zde posuneme datum o 1 den dopředu,
    // čímž se sníží skóre, ale nesmaže se úplně, pokud uživatel nekouřil dlouho.
    if (userData.quitDate) {
      const currentQuit = new Date(userData.quitDate);
      const penalty = addHours(currentQuit, 24); 
      setUserData({ ...userData, quitDate: isBefore(penalty, new Date()) ? penalty.toISOString() : new Date().toISOString() });
    }
    setIsLapsModalOpen(false);
  };

  const handleCloseCravingHelper = () => {
    setIsCravingMode(false);
    setUserData(prev => ({ ...prev, sosCount: prev.sosCount + 1 }));
  };

  if (isSettingsOpen) {
    return <SettingsModal initialData={userData} onSave={handleSaveSettings} onClose={() => userData.quitDate && setIsSettingsOpen(false)} />;
  }

  if (isCravingMode) {
    return <CravingHelper personalAnchor={userData.personalAnchor} onClose={handleCloseCravingHelper} />;
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${userData.isDarkMode ? 'dark' : ''}`}>
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
              <Wind className="w-5 h-5" />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">
              {userData.name ? `Ahoj, ${userData.name}` : 'Nekouřím'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {deferredPrompt && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleInstall}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-full transition-colors mr-2"
                aria-label="Instalovat aplikaci"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Instalovat</span>
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              aria-label="Nastavení"
            >
              <Settings className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 space-y-6">
        {userData.isReduceMode ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <ReduceModeDashboard 
                userData={userData} 
                now={now} 
                smokedLogs={smokedLogs} 
                onLogSmoke={handleLogSmoke}
                onSwitchToQuit={handleSwitchToQuit}
              />
            </div>
            <div className="space-y-6">
              <CravingCard 
                onStart={() => setIsCravingMode(true)} 
                onLog={() => setIsLogCravingOpen(true)} 
              />
              <MotivationCard userData={userData} now={now} />
            </div>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              {activeTab === 'home' && (
                <motion.div 
                  key="home" 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }} 
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <DefumoxanTracker userData={userData} now={now} onTakePill={handleTakeDefumoxanPill} />
                  <DashboardStats userData={userData} now={now} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <CravingCard 
                      onStart={() => setIsCravingMode(true)} 
                      onLog={() => setIsLogCravingOpen(true)} 
                    />
                    <MotivationCard userData={userData} now={now} />
                  </div>
                  <RewardCard userData={userData} now={now} />
                  <motion.button 
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setIsLapsModalOpen(true)}
                    className="w-full py-4 px-4 text-sm text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-dashed border-slate-300 rounded-2xl transition-all"
                  >
                    Uklouzl/a jsem a zapálil/a si...
                  </motion.button>
                </motion.div>
              )}
              
              {activeTab === 'health' && (
                <motion.div 
                  key="health" 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }} 
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <MetabolismCard userData={userData} />
                  <HealthTimeline userData={userData} now={now} />
                </motion.div>
              )}
              
              {activeTab === 'achievements' && (
                <motion.div 
                  key="achievements" 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }} 
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <BadgesCard userData={userData} now={now} cravings={cravings} />
                </motion.div>
              )}
              
              {activeTab === 'diary' && (
                <motion.div 
                  key="diary" 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }} 
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <CravingInsights cravings={cravings} />
                  <CravingHistory cravings={cravings} userData={userData} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Navigation Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-2 py-2 pb-safe z-30">
              <div className="max-w-lg mx-auto flex justify-around items-center">
                <button 
                  onClick={() => setActiveTab('home')} 
                  className={`flex flex-col items-center gap-1 p-2 min-w-[4.5rem] transition-all ${activeTab === 'home' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <LayoutDashboard className="w-6 h-6" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">Domů</span>
                </button>
                <button 
                  onClick={() => setActiveTab('health')} 
                  className={`flex flex-col items-center gap-1 p-2 min-w-[4.5rem] transition-all ${activeTab === 'health' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Heart className="w-6 h-6" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">Zdraví</span>
                </button>
                <button 
                  onClick={() => setActiveTab('achievements')} 
                  className={`flex flex-col items-center gap-1 p-2 min-w-[4.5rem] transition-all ${activeTab === 'achievements' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Award className="w-6 h-6" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">Úspěchy</span>
                </button>
                <button 
                  onClick={() => setActiveTab('diary')} 
                  className={`flex flex-col items-center gap-1 p-2 min-w-[4.5rem] transition-all ${activeTab === 'diary' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <BarChart2 className="w-6 h-6" />
                  <span className="text-[10px] font-medium uppercase tracking-wider">Deník</span>
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {isLogCravingOpen && (
        <LogCravingModal 
          onClose={() => setIsLogCravingOpen(false)} 
          onSave={handleLogCraving} 
        />
      )}

      {isLapsModalOpen && (
        <LapsModal 
          onClose={() => setIsLapsModalOpen(false)} 
          onConfirm={handleLaps} 
        />
      )}

      <AICoach 
        userData={userData} 
        cravings={cravings}
        onMessageSent={() => setUserData(prev => ({ ...prev, aiMessageCount: prev.aiMessageCount + 1 }))} 
        onTriggerSOS={() => setIsCravingMode(true)}
        onTriggerLogCraving={() => setIsLogCravingOpen(true)}
        onLogCraving={handleLogCraving}
      />
    </div>
  );
}

function DefumoxanTracker({ userData, now, onTakePill }: { userData: UserData; now: Date; onTakePill: () => void }) {
  if (!userData.isDefumoxanMode || !userData.defumoxanStartDate) return null;

  const startDate = new Date(userData.defumoxanStartDate);
  const dayOfTreatment = Math.max(1, Math.floor(differenceInDays(now, startDate)) + 1);
  
  if (dayOfTreatment > 25) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-800/50 shadow-sm mb-6">
        <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-2">
          <CheckCircle2 className="w-6 h-6" />
          <h2 className="font-semibold text-lg">25denní kúra dokončena!</h2>
        </div>
        <p className="text-emerald-700 dark:text-emerald-300 text-sm">Gratulujeme! Úspěšně jsi dokončil/a celou farmakoterapii s Defumoxanem. Tvé tělo je nyní připraveno fungovat bez nikotinu i cytisinu.</p>
      </div>
    );
  }

  let maxPills = 0;
  let intervalHours = 0;
  if (dayOfTreatment >= 1 && dayOfTreatment <= 3) { maxPills = 6; intervalHours = 2; }
  else if (dayOfTreatment >= 4 && dayOfTreatment <= 12) { maxPills = 5; intervalHours = 2.5; }
  else if (dayOfTreatment >= 13 && dayOfTreatment <= 16) { maxPills = 4; intervalHours = 3; }
  else if (dayOfTreatment >= 17 && dayOfTreatment <= 20) { maxPills = 3; intervalHours = 5; }
  else if (dayOfTreatment >= 21 && dayOfTreatment <= 25) { maxPills = 2; intervalHours = 12; }

  const todayStart = startOfDay(now);
  const pillsTakenToday = (userData.defumoxanPillsTaken || []).filter(dateStr => {
    const d = new Date(dateStr);
    return d >= todayStart && d <= now;
  });

  const lastPillDate = userData.defumoxanPillsTaken && userData.defumoxanPillsTaken.length > 0 
    ? new Date(userData.defumoxanPillsTaken[userData.defumoxanPillsTaken.length - 1]) 
    : null;

  let nextPillDate = null;
  if (lastPillDate) {
    nextPillDate = addMinutes(lastPillDate, intervalHours * 60);
  }

  const canTakePill = pillsTakenToday.length < maxPills;
  const isTimeForNextPill = !nextPillDate || isBefore(nextPillDate, now);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-slate-900 dark:text-white">Léčebný plán (Defumoxan)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Den {dayOfTreatment} z 25</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{pillsTakenToday.length} / {maxPills}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">pilulek dnes</p>
        </div>
      </div>

      {dayOfTreatment <= 5 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">Kritický milník se blíží</h3>
              <p className="text-xs text-amber-700 dark:text-amber-400/80 mt-1">Nejpozději 5. den léčby musíš zcela přestat kouřit. Jinak hrozí nežádoucí účinky z předávkování (nikotin + cytisin).</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <motion.button
          whileHover={canTakePill ? { scale: 1.02 } : {}}
          whileTap={canTakePill ? { scale: 0.98 } : {}}
          onClick={onTakePill}
          disabled={!canTakePill}
          className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
            !canTakePill 
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed' 
              : isTimeForNextPill 
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 dark:shadow-none' 
                : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 hover:bg-blue-100 dark:hover:bg-blue-900/50'
          }`}
        >
          <Plus className="w-5 h-5" />
          {canTakePill ? 'Vzít pilulku' : 'Dnes máš splněno'}
        </motion.button>

        {canTakePill && nextPillDate && !isTimeForNextPill && (
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs text-slate-500 dark:text-slate-400">Další pilulka za:</p>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {Math.floor(Math.max(0, differenceInSeconds(nextPillDate, now)) / 3600)}h {Math.floor((Math.max(0, differenceInSeconds(nextPillDate, now)) % 3600) / 60)}m
            </p>
          </div>
        )}
        {canTakePill && (!nextPillDate || isTimeForNextPill) && (
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Je čas na další pilulku!</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Doporučený rozestup: {intervalHours}h</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardStats({ userData, now }: { userData: UserData; now: Date }) {
  const [localNow, setLocalNow] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setLocalNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!userData.quitDate) return null;

  const quitDate = new Date(userData.quitDate);
  const isPreparing = isBefore(localNow, quitDate);
  
  const secondsDiff = Math.abs(differenceInSeconds(localNow, quitDate));
  
  const days = Math.floor(secondsDiff / (24 * 3600));
  const hours = Math.floor((secondsDiff % (24 * 3600)) / 3600);
  const minutes = Math.floor((secondsDiff % 3600) / 60);
  const seconds = secondsDiff % 60;

  const m = isPreparing ? 0 : differenceInMonths(localNow, quitDate);
  const quitDatePlusMonths = isPreparing ? quitDate : addMonths(quitDate, m);
  const remainingDays = isPreparing ? 0 : differenceInDays(localNow, quitDatePlusMonths);
  const w = isPreparing ? 0 : Math.floor(remainingDays / 7);
  const d = isPreparing ? days : remainingDays % 7;

  const cigsAvoided = isPreparing ? 0 : (secondsDiff / (24 * 3600)) * userData.cigsPerDay;
  const moneySaved = isPreparing ? 0 : (cigsAvoided / userData.cigsInPack) * userData.pricePerPack;

  if (isPreparing) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mb-4">
          <Clock className="w-5 h-5 text-blue-500" />
          <h2 className="font-medium text-sm uppercase tracking-wider">Příprava na Den D</h2>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{days}</span>
          <span className="text-slate-500 dark:text-slate-400 font-medium">dní zbývá</span>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-mono">
          {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-4">
          Zatím můžeš kouřit, ale připravuj se na úplné odložení cigaret. Tvůj Den D nastane {quitDate.toLocaleDateString('cs-CZ')} v {quitDate.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm"
      >
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mb-4">
          <Clock className="w-5 h-5 text-blue-500" />
          <h2 className="font-medium text-sm uppercase tracking-wider">Čas bez cigarety</h2>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {m > 0 && (
            <><span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{m}</span><span className="text-sm font-medium text-slate-500 dark:text-slate-400">{m === 1 ? 'měsíc' : m >= 2 && m <= 4 ? 'měsíce' : 'měsíců'}</span></>
          )}
          {w > 0 && (
            <><span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{w}</span><span className="text-sm font-medium text-slate-500 dark:text-slate-400">{w === 1 ? 'týden' : w >= 2 && w <= 4 ? 'týdny' : 'týdnů'}</span></>
          )}
          {(d > 0 || (m === 0 && w === 0)) && (
            <><span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{d}</span><span className="text-sm font-medium text-slate-500 dark:text-slate-400">{d === 1 ? 'den' : d >= 2 && d <= 4 ? 'dny' : 'dní'}</span></>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="text-sm text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-900/50 px-2 rounded">
            {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </div>
          {(m > 0 || w > 0) && (
            <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Celkem {days} dní
            </div>
          )}
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm"
      >
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mb-4">
          <Wallet className="w-5 h-5 text-emerald-500" />
          <h2 className="font-medium text-sm uppercase tracking-wider">Ušetřeno</h2>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{moneySaved.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className="text-slate-500 dark:text-slate-400 font-medium">{userData.currency}</span>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Za {Math.floor(cigsAvoided)} nevykouřených cigaret
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm"
      >
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mb-4">
          <Activity className="w-5 h-5 text-purple-500" />
          <h2 className="font-medium text-sm uppercase tracking-wider">Zdraví</h2>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            {isPreparing ? 0 : Math.min(100, Math.floor((secondsDiff / (24 * 3600 * 365)) * 100))}%
          </span>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Cesta k úplné regeneraci těla (1 rok)
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm"
      >
        <div className="flex items-center gap-3 text-slate-500 mb-4">
          <Wind className="w-5 h-5 text-sky-500" />
          <h2 className="font-medium text-sm uppercase tracking-wider">Bývalý zvyk</h2>
        </div>
        <ul className="space-y-3 text-sm text-slate-600">
          <li className="flex justify-between items-center">
            <span>Denně:</span>
            <span className="font-medium text-slate-900">{userData.cigsPerDay} ks</span>
          </li>
          <li className="flex justify-between items-center">
            <span>Týdně:</span>
            <span className="font-medium text-slate-900">{userData.cigsPerDay * 7} ks</span>
          </li>
          <li className="flex justify-between items-center">
            <span>Měsíčně:</span>
            <span className="font-medium text-slate-900">{userData.cigsPerDay * 30} ks</span>
          </li>
        </ul>
      </motion.div>
    </div>
  );
}

function RewardCard({ userData, now }: { userData: UserData; now: Date }) {
  if (!userData.quitDate || !userData.rewards || userData.rewards.length === 0) return null;

  const quitDate = new Date(userData.quitDate);
  const secondsQuit = Math.max(0, differenceInSeconds(now, quitDate));
  const cigsAvoided = (secondsQuit / (24 * 3600)) * userData.cigsPerDay;
  const moneySaved = (cigsAvoided / userData.cigsInPack) * userData.pricePerPack;
  const moneySavedPerDay = Math.max(0.01, (userData.cigsPerDay / userData.cigsInPack) * userData.pricePerPack);

  const sortedRewards = [...userData.rewards].sort((a, b) => a.price - b.price);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Target className="w-5 h-5" />
          </div>
          <h2 className="font-semibold text-lg text-slate-900 dark:text-white">Nástěnka snů</h2>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {Math.floor(moneySaved).toLocaleString('cs-CZ')} {userData.currency}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Celkem ušetřeno</p>
        </div>
      </div>
      
      <div className="space-y-5">
        {sortedRewards.map((reward) => {
          const progress = Math.min(100, (moneySaved / reward.price) * 100);
          const isAchieved = progress >= 100;
          const remainingMoney = Math.max(0, reward.price - moneySaved);
          const remainingDays = Math.ceil(remainingMoney / moneySavedPerDay);
          const estimatedDate = addDays(now, Math.max(1, remainingDays));
          const formattedProgress = progress < 100 ? progress.toFixed(1) : '100';

          return (
            <div key={reward.id} className="relative">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <p className={`font-medium ${isAchieved ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {reward.name} {isAchieved && '🎉'}
                  </p>
                  {!isAchieved && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Zbývá {remainingDays} dní (cca {estimatedDate.toLocaleDateString('cs-CZ')})
                    </p>
                  )}
                </div>
                <div className="text-right flex flex-col items-end">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {reward.price.toLocaleString('cs-CZ')} {userData.currency}
                  </p>
                  {!isAchieved && (
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                      {formattedProgress} %
                    </p>
                  )}
                </div>
              </div>
              
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden relative">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full rounded-full ${isAchieved ? 'bg-emerald-500' : 'bg-emerald-400 dark:bg-emerald-500'}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BadgesCard({ userData, now, cravings }: { userData: UserData; now: Date; cravings: CravingLog[] }) {
  if (!userData.quitDate) return null;

  const quitDate = new Date(userData.quitDate);
  const secondsQuit = Math.max(0, differenceInSeconds(now, quitDate));
  const daysQuit = secondsQuit / (24 * 3600);
  const cigsAvoided = daysQuit * userData.cigsPerDay;
  const moneySaved = (cigsAvoided / userData.cigsInPack) * userData.pricePerPack;

  const badges = [
    { id: '24h', title: 'První den', desc: '24 hodin čistoty', icon: Star, current: daysQuit, target: 1, color: 'text-amber-500', bg: 'bg-amber-100' },
    { id: '1w', title: 'Týden', desc: '7 dní bez cigarety', icon: Award, current: daysQuit, target: 7, color: 'text-emerald-500', bg: 'bg-emerald-100' },
    { id: '1m', title: 'Měsíc', desc: '30 dní svobody', icon: Trophy, current: daysQuit, target: 30, color: 'text-purple-500', bg: 'bg-purple-100' },
    { id: 'dopamine', title: 'Mistr dopaminu', desc: 'Překonán hypodopaminergní stav', icon: Brain, current: daysQuit, target: 30, color: 'text-pink-500', bg: 'bg-pink-100' },
    { id: '3m', title: 'Čistý dech', desc: '90 dní bez kouření', icon: Activity, current: daysQuit, target: 90, color: 'text-cyan-600', bg: 'bg-cyan-100' },
    { id: '100d', title: '100 dní', desc: 'Dlouhodobý nekuřák', icon: Medal, current: daysQuit, target: 100, color: 'text-blue-500', bg: 'bg-blue-100' },
    { id: 'microbiome', title: 'Hrdina mikrobiomu', desc: 'Plná regenerace střevní mikroflóry', icon: Dna, current: daysQuit, target: 180, color: 'text-lime-600', bg: 'bg-lime-100' },
    { id: '1y', title: 'Rok', desc: '365 dní čistoty', icon: Crown, current: daysQuit, target: 365, color: 'text-rose-600', bg: 'bg-rose-100' },
    { id: 'heart_protector', title: 'Ochránce srdce', desc: 'Riziko infarktu kleslo o 50 %', icon: Heart, current: daysQuit, target: 365, color: 'text-red-500', bg: 'bg-red-100' },
    { id: '1000cigs', title: 'Železné zdraví', desc: '1000 nevykouřených cigaret', icon: ShieldAlert, current: cigsAvoided, target: 1000, color: 'text-rose-500', bg: 'bg-rose-100' },
    { id: '1000czk', title: 'Tisícovka', desc: `Ušetřeno 1000 ${userData.currency}`, icon: Wallet, current: moneySaved, target: 1000, color: 'text-indigo-500', bg: 'bg-indigo-100' },
    { id: '5000czk', title: 'Bohatý nekuřák', desc: `Ušetřeno 5000 ${userData.currency}`, icon: Wallet, current: moneySaved, target: 5000, color: 'text-emerald-700', bg: 'bg-emerald-200' },
    { id: 'reward', title: 'První cíl', desc: 'Našetřeno na první odměnu', icon: Target, current: moneySaved, target: userData.rewards?.[0]?.price || 2500, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { id: 'sos', title: 'Zkrotitel 4D', desc: '10x použito SOS dýchání', icon: Wind, current: userData.sosCount, target: 10, color: 'text-cyan-500', bg: 'bg-cyan-100' },
    { id: 'analyst', title: 'Analytik', desc: 'Zapsáno 5 spouštěčů', icon: BarChart2, current: cravings.length, target: 5, color: 'text-violet-500', bg: 'bg-violet-100' },
    { id: 'ai_fan', title: 'Komunikátor', desc: '10 zpráv s terapeutem', icon: MessageCircle, current: userData.aiMessageCount, target: 10, color: 'text-blue-600', bg: 'bg-blue-100' },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <Award className="w-5 h-5 text-amber-500" />
        <h2 className="font-semibold text-lg">Získané odznaky</h2>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {badges.map((badge) => {
          const Icon = badge.icon;
          const achieved = badge.current >= badge.target;
          const progress = badge.target > 0 ? Math.min(100, (badge.current / badge.target) * 100) : 100;

          return (
            <div 
              key={badge.id} 
              className={`relative p-4 pt-6 rounded-2xl border flex flex-col items-center text-center transition-all ${
                achieved 
                  ? 'border-slate-200 bg-white shadow-sm' 
                  : 'border-slate-100 bg-slate-50 opacity-70'
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${achieved ? badge.bg : 'bg-slate-200'}`}>
                <Icon className={`w-6 h-6 ${achieved ? badge.color : 'text-slate-400'}`} />
              </div>
              <h3 className="font-semibold text-sm text-slate-900">{badge.title}</h3>
              <p className="text-[10px] leading-tight text-slate-500 mt-1 mb-3">{badge.desc}</p>
              
              {!achieved && (
                <div className="w-full mt-auto">
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-slate-400 rounded-full"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 uppercase tracking-tighter">
                    {Math.floor(progress)}% hotovo
                  </p>
                </div>
              )}

              {achieved && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-1 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetabolismCard({ userData }: { userData: UserData }) {
  if (!userData.height || !userData.weight) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Scale className="w-5 h-5" />
          </div>
          <h2 className="font-semibold text-lg text-slate-900 dark:text-white">Metabolismus a hmotnost</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Zadej svou výšku a váhu v nastavení (ikona ozubeného kola), abychom ti mohli zobrazit personalizované tipy ohledně změn metabolismu při odvykání.
        </p>
      </div>
    );
  }

  const heightM = userData.height / 100;
  const bmi = userData.weight / (heightM * heightM);
  
  let category = '';
  let colorClass = '';
  let bgClass = '';
  let description = '';
  let tips: string[] = [];

  if (bmi < 18.5) {
    category = 'Podváha';
    colorClass = 'text-blue-600 dark:text-blue-400';
    bgClass = 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50';
    description = 'Skvělá zpráva! Odvykání kouření často vede k mírnému nárůstu hmotnosti, což je ve tvém případě velmi žádoucí. Tvůj metabolismus se vrací do normálu a tělo začíná efektivněji vstřebávat živiny.';
    tips = [
      'Využij zvýšenou chuť k jídlu k budování zdravé hmoty.',
      'Jez nutričně bohatá jídla (ořechy, avokádo, kvalitní bílkoviny).',
      'Každé kilo navíc je teď tvůj obrovský úspěch a krok ke zdraví!'
    ];
  } else if (bmi < 25) {
    category = 'Normální váha';
    colorClass = 'text-emerald-600 dark:text-emerald-400';
    bgClass = 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50';
    description = 'Při odvykání se bazální metabolismus mírně zpomalí (o cca 800 kJ/den). Mírný nárůst váhy (2–4 kg) je zcela fyziologický a představuje přirozený proces uzdravování těla.';
    tips = [
      'Udržuj vyváženou stravu a přidej trochu pohybu navíc.',
      'Pokud tě přepadne chuť na cigaretu, zkus se napít vody nebo se projít.',
      'Zdravotní benefity nekouření dalece převažují nad mírným nárůstem váhy.'
    ];
  } else {
    category = 'Nadváha / Obezita';
    colorClass = 'text-orange-600 dark:text-orange-400';
    bgClass = 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/50';
    description = 'Po vysazení nikotinu se tělo snaží nahradit chybějící dopamin jídlem, zejména sladkostmi. Je důležité mít se na pozoru, abys cigarety nenahradil/a nezdravým jídlem.';
    tips = [
      'Při chuti na cigaretu využij metodu 4D (Napij se, Dýchej, Zabav se, Odlož to).',
      'Měj po ruce nakrájenou zeleninu (mrkev, celer) pro případ "mlsných" chvilek.',
      'Zvyš příjem vlákniny pro rychlejší obnovu střevního mikrobiomu.'
    ];
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Scale className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-lg text-slate-900 dark:text-white">Metabolismus a hmotnost</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Personalizované tipy pro tvé tělo</p>
        </div>
      </div>

      <div className={`p-5 rounded-2xl border ${bgClass} mb-6`}>
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Tvůj BMI Index</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold tracking-tight ${colorClass}`}>{bmi.toFixed(1)}</span>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg font-semibold text-sm bg-white dark:bg-slate-800 shadow-sm ${colorClass}`}>
            {category}
          </div>
        </div>
        
        <div className="relative pt-2 pb-5">
          <div className="h-2.5 w-full rounded-full overflow-hidden flex opacity-80">
            <div className="h-full bg-blue-400" style={{ width: '17.5%' }} title="Podváha (< 18.5)"></div>
            <div className="h-full bg-emerald-400" style={{ width: '32.5%' }} title="Normální váha (18.5 - 24.9)"></div>
            <div className="h-full bg-orange-400" style={{ width: '50%' }} title="Nadváha (25+)"></div>
          </div>
          
          <div 
            className="absolute top-0 w-4 h-4 bg-white dark:bg-slate-200 border-2 border-slate-800 dark:border-slate-900 rounded-full shadow-md transform -translate-x-1/2 transition-all duration-500"
            style={{ left: `${Math.min(Math.max(((bmi - 15) / 20) * 100, 0), 100)}%`, marginTop: '5px' }}
          ></div>
          
          <div className="absolute w-full top-6 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            <span className="absolute left-0">15</span>
            <span className="absolute left-[17.5%] transform -translate-x-1/2">18.5</span>
            <span className="absolute left-[50%] transform -translate-x-1/2">25</span>
            <span className="absolute right-0">35</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-6">
        {description}
      </p>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Doporučení pro tebe:</h3>
        <ul className="space-y-2">
          {tips.map((tip, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
              <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${colorClass}`} />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function HealthTimeline({ userData, now }: { userData: UserData; now: Date }) {
  if (!userData.quitDate) return null;
  const quitDate = new Date(userData.quitDate);

  let activeMilestones = [...MILESTONES];
  
  if (userData.isDefumoxanMode && userData.defumoxanStartDate) {
    const defumoxanStart = new Date(userData.defumoxanStartDate);
    activeMilestones = [
      { id: 'def_5', label: 'Plná blokáda receptorů (Nutnost přestat kouřit)', dateFn: () => addDays(defumoxanStart, 4) },
      { id: 'def_25', label: 'Konec farmakoterapie (Mozek je připraven)', dateFn: () => addDays(defumoxanStart, 24) },
      ...activeMilestones
    ].sort((a, b) => a.dateFn(quitDate).getTime() - b.dateFn(quitDate).getTime());
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <Heart className="w-5 h-5 text-rose-500" />
        <h2 className="font-semibold text-lg">Fyziologická obnova</h2>
      </div>
      
      <div className="space-y-6">
        {activeMilestones.map((milestone) => {
          const targetDate = milestone.dateFn(quitDate);
          const isAchieved = isBefore(targetDate, now);
          
          // Pro Defumoxan milníky počítáme progress od začátku léčby, pro ostatní od quitDate
          const startDate = milestone.id.startsWith('def_') ? new Date(userData.defumoxanStartDate!) : quitDate;
          const totalSeconds = Math.max(1, differenceInSeconds(targetDate, startDate));
          const elapsedSeconds = Math.max(0, differenceInSeconds(now, startDate));
          const progress = isAchieved ? 100 : Math.max(0, Math.min(100, (elapsedSeconds / totalSeconds) * 100));
          const formattedProgress = progress < 100 ? progress.toFixed(1) : '100';

          return (
            <div key={milestone.id} className="relative">
              <div className="flex justify-between items-end mb-2">
                <span className={`text-sm font-medium ${isAchieved ? 'text-slate-900' : 'text-slate-500'}`}>
                  {milestone.label}
                </span>
                <div className="flex items-center gap-2">
                  {!isAchieved && (
                    <span className="text-xs font-mono text-slate-400">
                      {formattedProgress} %
                    </span>
                  )}
                  {isAchieved && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", bounce: 0.6 }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </motion.div>
                  )}
                </div>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={`h-full rounded-full ${isAchieved ? 'bg-emerald-500' : 'bg-blue-500'}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CravingHistory({ cravings, userData }: { cravings: CravingLog[], userData: UserData }) {
  const [insights, setInsights] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cravings.length === 0) return null;

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const apiKeyToUse = userData.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKeyToUse) {
        throw new Error("Chybí API klíč pro Gemini.");
      }
      const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
      
      const cravingsData = cravings.map(c => 
        `- ${new Date(c.timestamp).toLocaleString('cs-CZ')}: Síla ${c.intensity}/10, Spouštěč: ${c.trigger}, Nálada: ${c.mood || 'neuvedena'}, Poznámka: ${c.note ? `"${c.note}"` : 'žádná'}`
      ).join('\n');

      const prompt = `Jsi expert na odvykání kouření a psychologii závislostí. Zanalyzuj následující deník bažení (chutí na cigaretu) uživatele a napiš mu krátké, povzbudivé a personalizované shrnutí (max 3-4 odstavce).
      
Zaměř se na:
1. Nejčastější spouštěče a nálady.
2. V jakých situacích má největší krize (vysoká intenzita).
3. Dej mu 1-2 konkrétní, praktické rady, jak těmto situacím předcházet nebo je lépe zvládat.
4. Buď empatický, ale věcný. Nepoužívej markdown nadpisy (###), jen tučný text pro zvýraznění.

Deník uživatele:
${cravingsData}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      if (response.text) {
        setInsights(response.text);
      } else {
        throw new Error("Nepodařilo se vygenerovat analýzu.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Došlo k chybě při analýze.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-lg">Deník bažení</h2>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="flex items-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {isAnalyzing ? 'Analyzuji...' : 'AI Analýza'}
        </motion.button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm rounded-xl border border-rose-100">
          {error}
        </div>
      )}

      {insights && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3 text-emerald-800 font-medium border-b border-emerald-200/50 pb-2">
            <Brain className="w-5 h-5" />
            <span>AI Postřehy a vzorce</span>
          </div>
          <div className="text-sm text-emerald-900 leading-relaxed space-y-3">
            <Markdown>{insights}</Markdown>
          </div>
        </motion.div>
      )}
      
      <div className="space-y-4">
        {cravings.slice(0, 5).map(log => {
          const date = new Date(log.timestamp);
          
          const getTriggerIcon = (trigger: string) => {
            switch(trigger) {
              case 'Stres': return <Zap className="w-4 h-4 text-rose-500" />;
              case 'Nuda': return <Battery className="w-4 h-4 text-slate-500" />;
              case 'Káva': return <Coffee className="w-4 h-4 text-amber-700" />;
              case 'Alkohol': return <Wine className="w-4 h-4 text-purple-600" />;
              case 'Po jídle': return <Utensils className="w-4 h-4 text-orange-500" />;
              case 'Společnost kuřáků': return <Users className="w-4 h-4 text-blue-500" />;
              case 'Únava': return <Moon className="w-4 h-4 text-indigo-500" />;
              default: return <HelpCircle className="w-4 h-4 text-slate-400" />;
            }
          };

          const intensityColor = log.intensity > 7 ? 'bg-rose-500' : 
                                 log.intensity > 4 ? 'bg-amber-500' : 
                                 'bg-emerald-500';

          return (
            <motion.div 
              key={log.id} 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="group flex flex-col p-4 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-sm transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-slate-100 p-2 rounded-lg border border-slate-200">
                    {getTriggerIcon(log.trigger)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                       <p className="font-semibold text-slate-900">{log.trigger}</p>
                       {log.mood && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium border border-slate-200">
                          {log.mood}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {date.toLocaleDateString('cs-CZ')} {date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 sm:w-1/3">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium uppercase tracking-widest text-[10px]">Intenzita</span>
                      <span className={`font-bold ${log.intensity > 7 ? 'text-rose-600' : log.intensity > 4 ? 'text-amber-600' : 'text-emerald-600'}`}>{log.intensity}/10</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                      {[...Array(10)].map((_, i) => (
                        <div 
                           key={i} 
                           className={`h-full flex-1 border-r border-white/50 last:border-0 ${i < log.intensity ? intensityColor : 'bg-transparent'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              {log.note && (
                <div className="mt-4 text-sm text-slate-700 bg-slate-50 border border-slate-200/60 p-3 rounded-lg flex items-start gap-2">
                  <div className="text-slate-400 mt-0.5">"</div>
                  <div className="italic flex-1">{log.note}</div>
                  <div className="text-slate-400 mt-auto rotate-180 mb-0.5">"</div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      
      {cravings.length > 5 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
            Zobrazeno posledních 5 záznamů (celkem {cravings.length})
          </p>
        </div>
      )}
    </div>
  );
}

function CravingCard({ onStart, onLog }: { onStart: () => void, onLog: () => void }) {
  return (
    <div className="bg-gradient-to-br from-rose-500 to-orange-500 rounded-2xl p-6 text-white shadow-md">
      <div className="flex items-start gap-4 mb-6">
        <div className="bg-white/20 p-3 rounded-xl">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">Mám chuť na cigaretu</h2>
          <p className="text-white/80 text-sm mt-1 leading-relaxed">
            Chuť obvykle trvá jen 3-5 minut. Zvládneš to.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onStart}
          className="w-full bg-white text-rose-600 font-semibold py-3 px-4 rounded-xl hover:bg-rose-50 transition-colors"
        >
          Spustit první pomoc (dýchání)
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onLog}
          className="w-full bg-rose-600/30 text-white font-medium py-3 px-4 rounded-xl hover:bg-rose-600/40 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Zaznamenat do deníku
        </motion.button>
      </div>
    </div>
  );
}

function MotivationCard({ userData, now }: { userData: UserData; now: Date }) {
  const getTipForCurrentPhase = () => {
    if (!userData.quitDate) return "Připrav se na svůj Den D. Sepiš si důvody, proč chceš přestat.";

    const quitDate = new Date(userData.quitDate);
    const daysQuit = Math.floor(Math.max(0, differenceInSeconds(now, quitDate)) / (24 * 3600));

    if (daysQuit === 0) {
      return "První den je nejtěžší. Pij hodně vody, pomáhá to vyplavovat toxiny a zaměstná to ruce i ústa.";
    } else if (daysQuit <= 3) {
      return "Fyzický absťák vrcholí. Zhluboka dýchej. Kyslík je tvůj nový přítel. Zvládneš to!";
    } else if (daysQuit <= 7) {
      return "Nejhorší fyzické příznaky by měly ustupovat. Odměň se za první týden něčím malým!";
    } else if (daysQuit <= 14) {
      return "Pozor na psychologické spouštěče (káva, stres). Měj po ruce žvýkačku nebo jablko.";
    } else if (daysQuit <= 30) {
      return "Tvoje plíce se čistí a energie roste. Zkus přidat lehký pohyb, pomůže to s produkcí endorfinů.";
    } else if (daysQuit <= 90) {
      return "Už jsi zažil/a spoustu situací jako nekuřák. Buduj si nové, zdravé rituály.";
    } else {
      return "Jsi inspirací pro ostatní! Nezapomínej ale, že i jediná cigareta (laps) může vést zpět k závislosti.";
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
      <h2 className="font-semibold text-slate-900 mb-3">Tip pro dnešní den</h2>
      <p className="text-slate-600 text-sm leading-relaxed">{getTipForCurrentPhase()}</p>
    </div>
  );
}

const MOODS = [
  { emoji: '😊', label: 'V pohodě' },
  { emoji: '😐', label: 'Neutrální' },
  { emoji: '😫', label: 'Ve stresu' },
  { emoji: '😠', label: 'Naštvaný' },
  { emoji: '😢', label: 'Smutný' }
];

function LogCravingModal({ onClose, onSave }: { onClose: () => void, onSave: (intensity: number, trigger: string, mood?: string, note?: string) => void }) {
  const [intensity, setIntensity] = useState(5);
  const [trigger, setTrigger] = useState(TRIGGERS[0]);
  const [mood, setMood] = useState(MOODS[2].label);
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Záznam bažení</h2>
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Jak silná je chuť? ({intensity}/10)
            </label>
            <input 
              type="range" 
              min="1" max="10" 
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Slabá</span>
              <span>Nesnesitelná</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Co chuť vyvolalo? (Spouštěč)
            </label>
            <div className="flex flex-wrap gap-2">
              {TRIGGERS.map(t => (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  key={t}
                  onClick={() => setTrigger(t)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    trigger === t 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t}
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Jak se cítíš?
            </label>
            <div className="flex justify-between gap-2">
              {MOODS.map(m => (
                <button
                  key={m.label}
                  onClick={() => setMood(m.label)}
                  className={`flex flex-col items-center p-2 rounded-xl transition-all ${
                    mood === m.label 
                      ? 'bg-emerald-50 border-2 border-emerald-500 scale-110' 
                      : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100 grayscale opacity-60 hover:grayscale-0 hover:opacity-100'
                  }`}
                >
                  <span className="text-2xl mb-1">{m.emoji}</span>
                  <span className="text-[10px] font-medium text-slate-600">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Poznámka (volitelné)
            </label>
            <textarea
              placeholder="Co se stalo? Jaké máš myšlenky?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm resize-none h-24"
            />
          </div>

          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSave(Math.max(1, Math.min(10, intensity)), trigger || TRIGGERS[0], mood, note.trim())}
            className="w-full bg-slate-900 text-white font-medium py-3 px-4 rounded-xl hover:bg-slate-800 transition-colors"
          >
            Uložit záznam
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function LapsModal({ onClose, onConfirm }: { onClose: () => void, onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden p-6"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        <h2 className="text-xl font-semibold text-slate-900 mb-2">Uklouznutí není prohra</h2>
        <p className="text-slate-600 text-sm leading-relaxed mb-6">
          Zapálil/a sis cigaretu. Tomu se v adiktologii říká <strong>laps</strong> (ojedinělé selhání). 
          Není to důvod k sebeobviňování ani k návratu k pravidelnému kouření (relapsu). 
          Tvůj dosavadní progres není ztracen. Pouč se z toho, co selhání vyvolalo, a pokračuj v abstinenci hned teď.
        </p>

        <div className="space-y-3">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onConfirm}
            className="w-full bg-slate-900 text-white font-medium py-3 px-4 rounded-xl hover:bg-slate-800 transition-colors"
          >
            Rozumím, pokračuji v odvykání
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="w-full bg-slate-100 text-slate-700 font-medium py-3 px-4 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Zrušit
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function CravingHelper({ personalAnchor, onClose }: { personalAnchor: string, onClose: () => void }) {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes

  useEffect(() => {
    if (timeLeft <= 0) {
      onClose();
      return;
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onClose]);

  useEffect(() => {
    // 4-7-8 breathing technique
    let timeout: NodeJS.Timeout;
    if (phase === 'inhale') {
      timeout = setTimeout(() => setPhase('hold'), 4000);
    } else if (phase === 'hold') {
      timeout = setTimeout(() => setPhase('exhale'), 7000);
    } else if (phase === 'exhale') {
      timeout = setTimeout(() => setPhase('inhale'), 8000);
    }
    return () => clearTimeout(timeout);
  }, [phase]);

  const circleVariants = {
    inhale: { scale: 1.5, transition: { duration: 4, ease: "linear" as const } },
    hold: { scale: 1.5, transition: { duration: 7, ease: "linear" as const } },
    exhale: { scale: 1, transition: { duration: 8, ease: "linear" as const } }
  };

  const textMap = {
    inhale: 'Nádech...',
    hold: 'Zadrž dech...',
    exhale: 'Výdech...'
  };

  return (
    <div className="fixed inset-0 bg-slate-900 text-white flex flex-col items-center justify-center z-50">
      <motion.button 
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClose}
        className="absolute top-6 right-6 p-2 text-white/50 hover:text-white transition-colors"
      >
        <X className="w-8 h-8" />
      </motion.button>

      <div className="text-center mb-12">
        <h2 className="text-2xl font-medium mb-2">Překonání chutě</h2>
        <p className="text-white/60">Soustřeď se na kruh a dýchej podle něj.</p>
      </div>

      <div className="relative w-64 h-64 flex items-center justify-center mb-12">
        <motion.div 
          variants={circleVariants}
          animate={phase}
          className="absolute w-32 h-32 bg-emerald-500/20 rounded-full"
        />
        <motion.div 
          variants={circleVariants}
          animate={phase}
          className="absolute w-32 h-32 border-2 border-emerald-500 rounded-full"
        />
        <span className="relative z-10 text-2xl font-medium tracking-wider">
          {textMap[phase]}
        </span>
      </div>

      <div className="text-center mb-8">
        <div className="text-4xl font-mono font-light mb-2">
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
        <p className="text-white/40 text-sm uppercase tracking-widest">Zbývající čas</p>
      </div>

      {personalAnchor && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="max-w-md text-center px-6 py-4 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10"
        >
          <p className="text-xs text-white/50 uppercase tracking-widest mb-2">Tvoje osobní kotva</p>
          <p className="text-lg font-medium text-white italic">"{personalAnchor}"</p>
        </motion.div>
      )}
    </div>
  );
}

function SettingsModal({ initialData, onSave, onClose }: { initialData: UserData, onSave: (data: UserData) => void, onClose: () => void }) {
  const [formData, setFormData] = useState<UserData>(initialData);
  const [mode, setMode] = useState<'immediate' | 'reduce' | 'defumoxan'>(initialData.isDefumoxanMode ? 'defumoxan' : (initialData.isReduceMode ? 'reduce' : 'immediate'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = { 
      ...formData, 
      isReduceMode: mode === 'reduce',
      isDefumoxanMode: mode === 'defumoxan',
      cigsPerDay: Math.max(1, formData.cigsPerDay || 1),
      cigsInPack: Math.max(1, formData.cigsInPack || 20),
      pricePerPack: Math.max(1, formData.pricePerPack || 1),
      yearsSmoked: Math.max(1, formData.yearsSmoked || 1),
      age: formData.age ? Math.max(15, formData.age) : null,
      height: formData.height ? Math.max(100, formData.height) : null,
      weight: formData.weight ? Math.max(30, formData.weight) : null,
      rewards: (formData.rewards || []).map(r => ({
        ...r,
        price: Math.max(1, r.price || 1)
      }))
    };
    if (mode === 'reduce' && !finalData.reduceStartDate) {
      finalData.reduceStartDate = new Date().toISOString();
    }
    if (mode === 'defumoxan' && !finalData.defumoxanStartDate) {
      finalData.defumoxanStartDate = new Date().toISOString();
      // Automaticky nastavíme quitDate na 5. den od začátku užívání
      const targetQuitDate = addDays(new Date(finalData.defumoxanStartDate), 4);
      finalData.quitDate = targetQuitDate.toISOString();
    }
    if (mode === 'immediate' && !finalData.quitDate) {
      finalData.quitDate = new Date().toISOString();
    }
    onSave(finalData);
  };

  const formatDateForInput = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">Nastavení odvykání</h2>
          {initialData.quitDate && (
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="w-5 h-5" />
            </motion.button>
          )}
        </div>

        <div className="overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="pt-2 pb-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Osobní údaje</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="input-name" className="block text-sm font-medium text-slate-700 mb-1">
                    Jak ti máme říkat?
                  </label>
                  <input 
                    id="input-name"
                    type="text" 
                    placeholder="Tvoje jméno nebo přezdívka"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="input-years-smoked" className="block text-sm font-medium text-slate-700 mb-1">
                    Kolik let jsi kouřil/a?
                  </label>
                  <input 
                    id="input-years-smoked"
                    type="number" 
                    min="1"
                    required
                    value={formData.yearsSmoked || ''}
                    onChange={(e) => setFormData({...formData, yearsSmoked: Number(e.target.value)})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <label htmlFor="input-age" className="block text-sm font-medium text-slate-700 mb-1">Věk</label>
                    <input 
                      id="input-age"
                      type="number" 
                      min="15" 
                      value={formData.age || ''} 
                      onChange={(e) => setFormData({...formData, age: e.target.value ? Number(e.target.value) : null})} 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" 
                      placeholder="Např. 42" 
                    />
                  </div>
                  <div>
                    <label htmlFor="input-height" className="block text-sm font-medium text-slate-700 mb-1">Výška (cm)</label>
                    <input 
                      id="input-height"
                      type="number" 
                      min="100" 
                      value={formData.height || ''} 
                      onChange={(e) => setFormData({...formData, height: e.target.value ? Number(e.target.value) : null})} 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" 
                      placeholder="Např. 178" 
                    />
                  </div>
                  <div>
                    <label htmlFor="input-weight" className="block text-sm font-medium text-slate-700 mb-1">Váha (kg)</label>
                    <input 
                      id="input-weight"
                      type="number" 
                      min="30" 
                      value={formData.weight || ''} 
                      onChange={(e) => setFormData({...formData, weight: e.target.value ? Number(e.target.value) : null})} 
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" 
                      placeholder="Např. 51" 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
              <button
                type="button"
                onClick={() => setMode('immediate')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${mode === 'immediate' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}
              >
                <h3 className="font-semibold text-slate-900 text-sm">Ze dne na den</h3>
                <p className="text-xs text-slate-500 mt-1">Už nekouřím nebo přestávám právě teď.</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('reduce')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${mode === 'reduce' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}
              >
                <h3 className="font-semibold text-slate-900 text-sm">Postupně snižovat</h3>
                <p className="text-xs text-slate-500 mt-1">Chci se připravit a snižovat dávky.</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('defumoxan')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${mode === 'defumoxan' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200'}`}
              >
                <h3 className="font-semibold text-slate-900 text-sm">Defumoxan</h3>
                <p className="text-xs text-slate-500 mt-1">25denní kúra (cytisin).</p>
              </button>
            </div>

            <div>
              <label htmlFor="input-quit-date" className="block text-sm font-medium text-slate-700 mb-1">
                {mode === 'immediate' ? 'Kdy jsi přestal/a kouřit?' : (mode === 'defumoxan' ? 'Kdy jsi začal/a užívat Defumoxan?' : 'Kdy bude tvůj Den D (konec kouření)?')}
              </label>
              <input 
                id="input-quit-date"
                type="datetime-local" 
                required
                value={formatDateForInput(mode === 'defumoxan' ? formData.defumoxanStartDate : formData.quitDate)}
                onChange={(e) => {
                  if (mode === 'defumoxan') {
                    const newStartDate = new Date(e.target.value).toISOString();
                    setFormData({...formData, defumoxanStartDate: newStartDate, quitDate: addDays(new Date(newStartDate), 4).toISOString()});
                  } else {
                    setFormData({...formData, quitDate: new Date(e.target.value).toISOString()});
                  }
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
              {mode === 'defumoxan' && (
                <p className="text-xs text-emerald-600 mt-2 font-medium">
                  Den D (úplný konec kouření) bude automaticky nastaven na 5. den léčby.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="input-cigs-per-day" className="block text-sm font-medium text-slate-700 mb-1">
                  Cigaret denně
                </label>
                <input 
                  id="input-cigs-per-day"
                  type="number" 
                  min="1"
                  required
                  value={formData.cigsPerDay || ''}
                  onChange={(e) => setFormData({...formData, cigsPerDay: Number(e.target.value)})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label htmlFor="input-cigs-in-pack" className="block text-sm font-medium text-slate-700 mb-1">
                  Cigaret v krabičce
                </label>
                <input 
                  id="input-cigs-in-pack"
                  type="number" 
                  min="1"
                  required
                  value={formData.cigsInPack || ''}
                  onChange={(e) => setFormData({...formData, cigsInPack: Number(e.target.value)})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="input-price-per-pack" className="block text-sm font-medium text-slate-700 mb-1">
                  Cena za krabičku
                </label>
                <input 
                  id="input-price-per-pack"
                  type="number" 
                  min="1"
                  required
                  value={formData.pricePerPack || ''}
                  onChange={(e) => setFormData({...formData, pricePerPack: Number(e.target.value)})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label htmlFor="input-currency" className="block text-sm font-medium text-slate-700 mb-1">
                  Měna
                </label>
                <input 
                  id="input-currency"
                  type="text" 
                  required
                  value={formData.currency}
                  onChange={(e) => setFormData({...formData, currency: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-slate-900">Nástěnka snů (Finanční cíle)</h3>
                <button 
                  type="button"
                  onClick={() => setFormData({
                    ...formData, 
                    rewards: [...(formData.rewards || []), { id: Date.now().toString(), name: '', price: 0 }]
                  })}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Přidat cíl
                </button>
              </div>
              <div className="space-y-3">
                {(formData.rewards || []).map((reward, index) => (
                  <div key={reward.id} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <input 
                        type="text" 
                        required
                        placeholder="Např. Dovolená, Nové boty..."
                        value={reward.name}
                        onChange={(e) => {
                          const newRewards = [...formData.rewards];
                          newRewards[index].name = e.target.value;
                          setFormData({...formData, rewards: newRewards});
                        }}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm mb-2"
                      />
                      <input 
                        type="number" 
                        min="1"
                        required
                        placeholder="Cena"
                        value={reward.price || ''}
                        onChange={(e) => {
                          const newRewards = [...formData.rewards];
                          newRewards[index].price = Number(e.target.value);
                          setFormData({...formData, rewards: newRewards});
                        }}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
                      />
                    </div>
                    {formData.rewards.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => {
                          const newRewards = formData.rewards.filter(r => r.id !== reward.id);
                          setFormData({...formData, rewards: newRewards});
                        }}
                        className="p-2 text-slate-400 hover:text-rose-500 rounded-lg transition-colors mt-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Osobní kotva (SOS)</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="input-personal-anchor" className="block text-sm font-medium text-slate-700 mb-1">
                    Proč jsi přestal/a? (Zobrazí se při krizi)
                  </label>
                  <textarea 
                    id="input-personal-anchor"
                    required
                    rows={3}
                    placeholder="Např. Chci vidět vyrůstat své děti. Nechci utrácet za jedy..."
                    value={formData.personalAnchor}
                    onChange={(e) => setFormData({...formData, personalAnchor: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                  />
                </div>
                <div>
                  <label htmlFor="input-therapist-personality" className="block text-sm font-medium text-slate-700 mb-1">
                    Osobnost AI Terapeuta
                  </label>
                  <select
                    id="input-therapist-personality"
                    value={formData.therapistPersonality || 'empathetic'}
                    onChange={(e) => setFormData({...formData, therapistPersonality: e.target.value as any})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  >
                    <option value="empathetic">Empatický přítel (Podporující a chápavý)</option>
                    <option value="strict">Přísný kouč (Přímý a nekompromisní)</option>
                    <option value="rational">Racionální lékař (Zaměřený na fakta a zdraví)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Vzhled</h3>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  {formData.isDarkMode ? <Moon className="w-5 h-5 text-indigo-500" /> : <Sun className="w-5 h-5 text-amber-500" />}
                  <div>
                    <p className="text-sm font-medium text-slate-900">Tmavý režim</p>
                    <p className="text-xs text-slate-500">Šetří oči i baterii</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isDarkMode: !formData.isDarkMode })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${formData.isDarkMode ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.isDarkMode ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Pokročilé</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="input-gemini-api-key" className="block text-sm font-medium text-slate-700 mb-1">
                    Vlastní Gemini API Klíč (volitelné)
                  </label>
                  <input
                    id="input-gemini-api-key"
                    type="password"
                    value={formData.geminiApiKey || ''}
                    onChange={(e) => setFormData({...formData, geminiApiKey: e.target.value})}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                  <div className="mt-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs text-slate-600 font-medium mb-2">
                      Jak získat vlastní API klíč zdarma:
                    </p>
                    <ol className="text-xs text-slate-500 list-decimal list-inside space-y-1.5 mb-3">
                      <li>Přejdi na <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 underline">Google AI Studio</a>.</li>
                      <li>Přihlas se svým Google účtem.</li>
                      <li>Klikni na modré tlačítko <strong>"Create API key"</strong>.</li>
                      <li>Vyber existující projekt nebo vytvoř nový (Create API key in new project).</li>
                      <li>Zkopíruj vygenerovaný klíč (začíná na <code>AIzaSy...</code>) a vlož ho sem.</li>
                    </ol>
                    <p className="text-[10px] text-slate-400">
                      Poznámka: Použití je v rámci běžných limitů zcela zdarma. Klíč se ukládá pouze bezpečně u tebe v prohlížeči (localStorage) a nikam se neodesílá. Pokud pole necháš prázdné, použije se výchozí sdílený klíč aplikace (může být pomalejší při velkém vytížení).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col gap-3">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full bg-slate-900 text-white font-medium py-3 px-4 rounded-xl hover:bg-slate-800 transition-colors"
              >
                Uložit a pokračovat
              </motion.button>
              
              {initialData.quitDate && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => {
                    if (window.confirm('Opravdu chcete vymazat všechna svá data, deník, historii chatu a začít úplně znovu? Tato akce je nevratná.')) {
                      localStorage.removeItem('quitSmokingData');
                      localStorage.removeItem('quitSmokingCravings');
                      localStorage.removeItem('quitSmokingSmokedLogs');
                      localStorage.removeItem('quitSmokingChatHistory');
                      window.location.reload();
                    }
                  }}
                  className="w-full bg-rose-50 text-rose-600 font-medium py-3 px-4 rounded-xl hover:bg-rose-100 transition-colors"
                >
                  Vymazat všechna data a začít znovu
                </motion.button>
              )}
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

function ReduceModeDashboard({ userData, now, smokedLogs, onLogSmoke, onSwitchToQuit }: { userData: UserData, now: Date, smokedLogs: string[], onLogSmoke: () => void, onSwitchToQuit: () => void }) {
  const quitDate = new Date(userData.quitDate!);
  const startDate = new Date(userData.reduceStartDate!);
  
  const daysTotal = Math.max(1, differenceInDays(startOfDay(quitDate), startOfDay(startDate)));
  const daysElapsed = Math.max(0, differenceInDays(startOfDay(now), startOfDay(startDate)));
  const daysLeft = Math.max(0, differenceInDays(startOfDay(quitDate), startOfDay(now)));
  
  const progress = Math.min(1, daysElapsed / daysTotal);
  const currentLimit = Math.max(0, Math.round(userData.cigsPerDay * (1 - progress)));

  const todayStr = now.toISOString().split('T')[0];
  const smokedToday = smokedLogs.filter(log => log.startsWith(todayStr)).length;

  if (isBefore(quitDate, now)) {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-8 text-white shadow-md text-center">
        <h2 className="text-2xl font-bold mb-2">Den D je tady!</h2>
        <p className="text-emerald-50 mb-6">Přípravná fáze skončila. Je čas udělat ten nejdůležitější krok a stát se nekuřákem.</p>
        <button onClick={onSwitchToQuit} className="bg-white text-emerald-600 font-bold py-3 px-8 rounded-xl hover:bg-emerald-50 transition-colors">
          Jdu do toho, už nekouřím!
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="font-semibold text-lg text-slate-900">Přípravná fáze</h2>
            <p className="text-sm text-slate-500">Postupné snižování do Dne D</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-indigo-600">{daysLeft}</div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">Dní zbývá</div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-600">Dnešní limit: <strong className="text-slate-900">{currentLimit} ks</strong></span>
            <span className="text-slate-600">Vykouřeno: <strong className={smokedToday > currentLimit ? 'text-rose-600' : 'text-slate-900'}>{smokedToday} ks</strong></span>
          </div>
          <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (smokedToday / Math.max(1, currentLimit)) * 100)}%` }}
              className={`h-full rounded-full ${smokedToday > currentLimit ? 'bg-rose-500' : 'bg-indigo-500'}`}
            />
          </div>
        </div>

        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onLogSmoke}
          className="w-full py-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
        >
          <Wind className="w-5 h-5" />
          Zaznamenat cigaretu
        </motion.button>
      </div>
      
      <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
        <h3 className="font-semibold text-indigo-900 mb-2">Jak to funguje?</h3>
        <p className="text-sm text-indigo-800/80 leading-relaxed">
          Aplikace ti každý den mírně sníží limit povolených cigaret. Snaž se tento limit nepřekročit. 
          Tvé tělo si tak postupně zvykne na nižší přísun nikotinu a abstinenční příznaky v Den D budou mnohem mírnější.
        </p>
      </div>
    </div>
  );
}

function CravingInsights({ cravings }: { cravings: CravingLog[] }) {
  const insights = useMemo(() => {
    if (cravings.length === 0) return null;

    // Analýza podle denní doby
    const timeDistribution = new Array(24).fill(0);
    // Analýza podle spouštěčů
    const triggerCounts: Record<string, number> = {};
    
    cravings.forEach(log => {
      const hour = getHours(new Date(log.timestamp));
      timeDistribution[hour]++;
      
      triggerCounts[log.trigger] = (triggerCounts[log.trigger] || 0) + 1;
    });

    // Formátování pro grafy
    const timeData = timeDistribution.map((count, hour) => ({
      hour: `${hour}:00`,
      count
    })).filter(d => d.count > 0); // Zobrazíme jen hodiny, kdy byla chuť

    const triggerData = Object.entries(triggerCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Nalezení nejrizikovější doby a spouštěče
    const maxTime = [...timeData].sort((a, b) => b.count - a.count)[0];
    const maxTrigger = triggerData[0];

    return { timeData, triggerData, maxTime, maxTrigger };
  }, [cravings]);

  if (!insights) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center">
        <BarChart2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <h2 className="font-semibold text-lg mb-2">Analytika spouštěčů</h2>
        <p className="text-slate-500 text-sm">Zatím nemáš zaznamenané žádné chutě. Až si nějaké zapíšeš, ukážeme ti zde tvé největší slabiny a rizikové situace.</p>
      </div>
    );
  }

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="w-5 h-5 text-indigo-500" />
        <h2 className="font-semibold text-lg">Analytika spouštěčů</h2>
      </div>

      <div className="bg-indigo-50 rounded-xl p-4 mb-6 border border-indigo-100">
        <h3 className="font-semibold text-indigo-900 mb-1 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Tvoje hlavní riziko
        </h3>
        <p className="text-sm text-indigo-800">
          Nejčastěji máš chuť na cigaretu kolem <strong>{insights.maxTime.hour}</strong> a tvým hlavním spouštěčem je <strong>{insights.maxTrigger.name}</strong>. 
          Zkus si na tuto dobu naplánovat jinou aktivitu nebo se předem připravit na zvládnutí stresu.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-4 text-center">Kdy máš největší chutě?</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={insights.timeData}>
                <XAxis dataKey="hour" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-4 text-center">Co tě nejčastěji spouští?</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={insights.triggerData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {insights.triggerData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {insights.triggerData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1 text-xs text-slate-600">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                {entry.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AICoach({ userData, cravings, onMessageSent, onTriggerSOS, onTriggerLogCraving, onLogCraving }: { userData: UserData, cravings: CravingLog[], onMessageSent: () => void, onTriggerSOS: () => void, onTriggerLogCraving: () => void, onLogCraving: (intensity: number, trigger: string, mood?: string, note?: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{id: string, role: 'user'|'model', text: string}[]>(() => {
    const saved = localStorage.getItem('quitSmokingChatHistory');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 'welcome-msg', role: 'model', text: userData.name ? `Ahoj ${userData.name}! Jsem tvůj virtuální terapeut. Jak se dnes cítíš? Máš chuť na cigaretu, nebo se jen chceš podělit o svůj pokrok?` : 'Ahoj! Jsem tvůj virtuální terapeut. Jak se dnes cítíš? Máš chuť na cigaretu, nebo se jen chceš podělit o svůj pokrok?' }
    ];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'cs-CZ';

      recognitionRef.current.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        transcriptRef.current = transcript;
        setInput(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const startListening = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!recognitionRef.current) {
      alert('Váš prohlížeč nepodporuje rozpoznávání hlasu. Zkuste prosím Google Chrome.');
      return;
    }
    setInput('');
    transcriptRef.current = '';
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error(e);
    }
  };

  const stopListening = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      
      // Auto-send after a short delay to allow final transcript to settle
      setTimeout(() => {
        if (transcriptRef.current.trim()) {
          handleSend(undefined, transcriptRef.current);
          transcriptRef.current = '';
        }
      }, 300);
    }
  };

  useEffect(() => {
    localStorage.setItem('quitSmokingChatHistory', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    const apiKeyToUse = userData.geminiApiKey || process.env.GEMINI_API_KEY;
    if (apiKeyToUse) {
      try {
        const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
        
        // Extrakce nejčastějších spouštěčů z deníku
        const triggerCounts = cravings.reduce((acc, curr) => {
          acc[curr.trigger] = (acc[curr.trigger] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const topTriggers = Object.entries(triggerCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(t => t[0])
          .join(', ');

        const recentCravings = cravings.slice(0, 3).map(c => 
          `- ${new Date(c.timestamp).toLocaleString('cs-CZ')}: Síla ${c.intensity}/10, Spouštěč: ${c.trigger}, Nálada: ${c.mood || 'neuvedena'}, Poznámka: ${c.note ? `"${c.note}"` : 'žádná'}`
        ).join('\n');
        const cravingsContext = recentCravings ? `\n- Poslední záznamy v deníku (vezmi je v potaz, pokud si uživatel stěžuje na chuť nebo náladu):\n${recentCravings}` : '';

        // Přesný časový kontext a metoda odvykání
        let exactAbstinenceTime = 'Zatím nepřestal/a úplně, snaží se postupně snižovat dávky.';
        let defumoxanContext = '';
        
        if (userData.isDefumoxanMode && userData.defumoxanStartDate) {
          const startDate = new Date(userData.defumoxanStartDate);
          const dayOfTreatment = Math.max(1, Math.floor(differenceInDays(new Date(), startDate)) + 1);
          exactAbstinenceTime = `Uživatel je ve ${dayOfTreatment}. dni 25denní farmakoterapie lékem Defumoxan (cytisin).`;
          
          defumoxanContext = `
SPECIFIKA LÉČBY DEFUMOXANEM (CYTISIN):
- Uživatel je ve ${dayOfTreatment}. dni 25denní kúry.
- Cytisin se váže na nikotinové receptory, čímž snižuje abstinenční příznaky a blokuje účinek nikotinu.
- PRAVIDLO 5. DNE: Nejpozději 5. den léčby musí uživatel ZCELA PŘESTAT KOUŘIT. Pokud by kouřil dál, hrozí nežádoucí účinky z předávkování (nikotin + cytisin).
- KOFEIN: Po vysazení nikotinu se zpomaluje metabolismus kofeinu. Varuj uživatele, aby snížil příjem kávy/energeťáků na polovinu, jinak hrozí nespavost, úzkost a bušení srdce.
- VEDLEJŠÍ ÚČINKY: Běžné jsou živé sny, sucho v ústech, mírná nevolnost nebo bolesti hlavy. Uklidni uživatele, že jde o normální reakci těla na lék a vysazení nikotinu.
- DÁVKOVÁNÍ: Aplikace uživateli hlídá dávkování (pilulky) sama, ty se soustřeď na psychologickou a zdravotní podporu.`;
        } else if (userData.quitDate && !userData.isReduceMode) {
          const quitDate = new Date(userData.quitDate);
          const now = new Date();
          const secondsQuit = Math.max(0, differenceInSeconds(now, quitDate));
          const days = Math.floor(secondsQuit / (24 * 3600));
          const hours = Math.floor((secondsQuit % (24 * 3600)) / 3600);
          exactAbstinenceTime = `Nekouří přesně ${days} dní a ${hours} hodin.`;
        }

        let personalityPrompt = 'Jsi empatický adiktolog a virtuální terapeut pomáhající uživateli přestat kouřit. Využíváš principy kognitivně-behaviorální terapie (KBT). Tvé odpovědi jsou stručné (max 2-3 odstavce), povzbudivé a zaměřené na řešení.';
        if (userData.therapistPersonality === 'strict') {
          personalityPrompt = 'Jsi přísný, nekompromisní vojenský kouč, který pomáhá uživateli přestat kouřit. Nesnášíš výmluvy. Tvé odpovědi jsou stručné, rázné, motivující tvrdou rukou a zaměřené na disciplínu.';
        } else if (userData.therapistPersonality === 'rational') {
          personalityPrompt = 'Jsi racionální lékař a vědec pomáhající uživateli přestat kouřit. Komunikuješ věcně, bez přehnaných emocí. Opíráš se o biologická fakta, zdravotní rizika a neurovědu závislosti. Tvé odpovědi jsou stručné a logické.';
        }

        let bmiContext = 'Uživatel nezadal svou výšku a váhu, takže neznáme jeho BMI. Pokud zmíní váhu, reaguj neutrálně.';
        if (userData.height && userData.weight) {
          const heightM = userData.height / 100;
          const bmi = userData.weight / (heightM * heightM);
          
          if (bmi < 18.5) {
            bmiContext = `Uživatel má podváhu (BMI ${bmi.toFixed(1)}). Přibírání na váze je pro něj ŽÁDOUCÍ a ZDRAVÉ. Pokud zmíní hlad nebo chutě k jídlu, silně ho povzbuzuj, ať se pořádně a výživně nají. Oslavuj každé kilo navíc jako obrovský úspěch a krok ke zdraví. V žádném případě mu neraď pít vodu na zahnání hladu nebo jíst jen zeleninu.`;
          } else if (bmi >= 18.5 && bmi < 25) {
            bmiContext = `Uživatel má normální váhu (BMI ${bmi.toFixed(1)}). Pokud zmíní hlad nebo chutě, vysvětli mu, že se mu vrací metabolismus do normálu. Doporuč mu vyváženou stravu a pohyb.`;
          } else {
            bmiContext = `Uživatel má nadváhu nebo obezitu (BMI ${bmi.toFixed(1)}). Pokud zmíní hlad nebo chutě, varuj ho před nahrazováním cigaret sladkostmi. Doporuč mu metodu 4D (napít se vody, zhluboka dýchat, zabavit se, odložit chuť) a mít po ruce nízkoenergetické alternativy (např. nakrájenou mrkev).`;
          }
        }

        const goalsList = userData.rewards?.map(r => `${r.name} (${r.price} ${userData.currency})`).join(', ') || 'žádné cíle';

        const systemInstruction = `${personalityPrompt} Komunikuj v češtině.

INFORMACE O UŽIVATELI:
- Jméno: ${userData.name || 'Nezadáno (oslovuj přátelsky)'}
- Věk: ${userData.age ? userData.age + ' let' : 'Nezadáno'}
- Fyzické parametry: ${userData.height ? userData.height + ' cm' : 'Nezadáno'}, ${userData.weight ? userData.weight + ' kg' : 'Nezadáno'}
- Tělesná konstituce a instrukce k váze: ${bmiContext}
- Kuřácká historie: Kouřil/a ${userData.yearsSmoked} let, průměrně ${userData.cigsPerDay} cigaret denně.
- Aktuální fáze: ${exactAbstinenceTime}
- Osobní motivace (kotva): "${userData.personalAnchor}"
- Finanční cíle (Nástěnka snů): Šetří na: ${goalsList}
- Úspěšně překonané krize (SOS dýchání): ${userData.sosCount}x
- Nejčastější spouštěče chutí: ${topTriggers || 'zatím nezaznamenány'}${cravingsContext}
${defumoxanContext}

TVŮJ ÚKOL:
1. Přizpůsob tón své osobnosti (empatický, přísný, nebo racionální).
2. Připomínej mu jeho osobní kotvu a finanční cíle, když ztrácí motivaci.
3. Chval ho za každý úspěch (např. za to, že už ${userData.sosCount}x zvládl krizi pomocí dýchání).
4. Pokud zmíní spouštěč, zkus mu poradit strategii, jak se mu vyhnout nebo ho zvládnout.
5. PŘÍSNĚ DODRŽUJ INSTRUKCE K VÁZE (viz Tělesná konstituce výše).
6. Abys lépe pochopil náladu, aktivně pokládej doplňující otázky (např. "Co přesně v tobě vyvolalo tento pocit?"). Neptej se ale na více než jednu otázku najednou!
7. Pokud uživatel hlásí akutní chuť na cigaretu nebo krizi, OKAMŽITĚ zavolej funkci \`log_craving\`, abys tento stav zaznamenal do jeho deníku. Odhadni intenzitu (1-10), spouštěč, náladu a přidej krátkou poznámku o tom, co se děje. Po zavolání funkce mu doporuč využít SOS tlačítko na hlavní obrazovce a pokračuj v podpoře.`;

        // Příprava historie pro Gemini (musí začínat uživatelem a střídat se)
        let validHistory: any[] = [];
        let lastRole = '';
        for (const msg of messages) {
          if (msg.id === 'welcome-msg') continue;
          if (!msg.text || !msg.text.trim()) continue;
          if (msg.role !== lastRole) {
            validHistory.push({ role: msg.role, parts: [{ text: msg.text }] });
            lastRole = msg.role;
          } else if (validHistory.length > 0) {
            validHistory[validHistory.length - 1].parts[0].text += '\n\n' + msg.text;
          }
        }
        if (validHistory.length > 0 && validHistory[0].role === 'model') {
          validHistory.shift();
        }
        if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
          validHistory.push({ role: 'model', parts: [{ text: 'Rozumím.' }] });
        }

        chatRef.current = ai.chats.create({
          model: "gemini-3-flash-preview",
          config: { 
            systemInstruction,
            tools: [{
              functionDeclarations: [
                {
                  name: "log_craving",
                  description: "Zaznamená do uživatelova deníku chuť na cigaretu (krizi), pokud ji uživatel v chatu zmíní.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      intensity: {
                        type: Type.NUMBER,
                        description: "Intenzita chuti na cigaretu od 1 (slabá) do 10 (nesnesitelná)."
                      },
                      trigger: {
                        type: Type.STRING,
                        description: "Co chuť vyvolalo (např. Stres, Nuda, Káva, Alkohol, Po jídle, Ráno, Únava, Společnost)."
                      },
                      mood: {
                        type: Type.STRING,
                        description: "Nálada uživatele (např. V pohodě, Neutrální, Ve stresu, Naštvaný, Smutný)."
                      },
                      note: {
                        type: Type.STRING,
                        description: "Krátká poznámka nebo myšlenka uživatele."
                      }
                    },
                    required: ["intensity", "trigger"]
                  }
                }
              ]
            }]
          },
          history: validHistory.length > 0 ? validHistory : undefined
        });
      } catch (e) {
        console.error("Failed to initialize AI:", e);
      }
    }
  }, [userData, cravings]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent, textOverride?: string) => {
    e?.preventDefault();
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isLoading) return;
    
    const userText = textToSend.trim();
    setInput('');
    const userMsgId = Math.random().toString(36).substr(2, 9);
    const modelMsgId = Math.random().toString(36).substr(2, 9);

    setMessages(prev => [...prev, { id: userMsgId, role: 'user', text: userText }]);
    setIsLoading(true);
    onMessageSent();

    try {
      if (!chatRef.current) throw new Error("Chat not initialized (missing API key?)");
      
      // Přidáme prázdnou zprávu modelu, kterou budeme postupně plnit
      setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '' }]);
      
      const responseStream = await chatRef.current.sendMessageStream({ message: userText });
      
      let functionCallDetected = false;
      let functionCallName = '';
      let functionCallArgs: any = null;

      for await (const chunk of responseStream) {
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          functionCallDetected = true;
          functionCallName = chunk.functionCalls[0].name;
          functionCallArgs = chunk.functionCalls[0].args;
        }

        let chunkText = '';
        try {
          chunkText = (chunk as any).text || '';
        } catch (e) {
          // Ignore error if text is not available
        }
        
        if (chunkText) {
          setMessages(prev => prev.map(msg => 
            msg.id === modelMsgId 
              ? { ...msg, text: msg.text + chunkText } 
              : msg
          ));
        }
      }

      if (functionCallDetected && functionCallName === 'log_craving' && functionCallArgs) {
        onLogCraving(
          functionCallArgs.intensity || 5, 
          functionCallArgs.trigger || 'Jiné', 
          functionCallArgs.mood, 
          functionCallArgs.note
        );
        
        const followUpStream = await chatRef.current.sendMessageStream([{
          functionResponse: {
            name: 'log_craving',
            response: { success: true, message: "Záznam byl úspěšně uložen do deníku." }
          }
        }]);

        for await (const chunk of followUpStream) {
          let chunkText = '';
          try {
            chunkText = (chunk as any).text || '';
          } catch (e) {
          }
          if (chunkText) {
            setMessages(prev => prev.map(msg => 
              msg.id === modelMsgId 
                ? { ...msg, text: msg.text + chunkText } 
                : msg
            ));
          }
        }
      }

      // Pokud model nevrátil žádný text, přidáme záložní zprávu
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg.id === modelMsgId && lastMsg.text === '') {
          newMessages[newMessages.length - 1] = { ...lastMsg, text: 'Omlouvám se, ale na toto nemohu odpovědět. Zkus to prosím formulovat jinak.' };
          return newMessages;
        }
        return prev;
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg.id === modelMsgId && lastMsg.text === '') {
          newMessages[newMessages.length - 1] = { ...lastMsg, text: 'Omlouvám se, ale došlo k chybě připojení. Zkus to prosím znovu.' };
          return newMessages;
        }
        return [...prev, { id: Math.random().toString(36).substr(2, 9), role: 'model', text: 'Omlouvám se, ale došlo k chybě připojení. Zkus to prosím znovu.' }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 h-[500px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-40 flex flex-col"
          >
            <div className="bg-emerald-600 text-white p-4 flex justify-between items-center shadow-md z-10">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                <h3 className="font-semibold">Virtuální terapeut</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-emerald-500 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm'
                  }`}>
                    {msg.role === 'model' ? (
                      <div className="markdown-body">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'model' && !messages[messages.length - 1]?.text && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm p-3 shadow-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    <span className="text-sm text-slate-500">Přemýšlí...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100 flex gap-2 items-center">
              <button
                type="button"
                onMouseDown={startListening}
                onMouseUp={stopListening}
                onMouseLeave={stopListening}
                onTouchStart={startListening}
                onTouchEnd={stopListening}
                className={`p-2.5 rounded-xl flex-shrink-0 transition-all ${
                  isListening 
                    ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/30' 
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
                title="Podržte pro hlasové zadávání"
              >
                <Mic className="w-5 h-5" />
              </button>
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Poslouchám..." : "Napiš zprávu..."}
                className="flex-1 bg-slate-100 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
              <button 
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            {isListening && (
              <div className="bg-white pb-2 px-3 text-center">
                <p className="text-[10px] text-rose-500 animate-pulse font-medium uppercase tracking-wider">
                  Nyní mluvte. Po uvolnění tlačítka se zpráva odešle.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 right-4 sm:right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-emerald-700 transition-colors z-40"
          >
            <MessageCircle className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
