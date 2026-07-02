import React, { useState, useEffect } from 'react';
import { Plus, MessageSquare, Printer, Trash2, X, GraduationCap, Save, LogIn, LogOut, CheckCircle2, UserPlus, KeyRound } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

interface ProgressLog {
  id: string;
  date: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  text: string;
}

interface Goal {
  id: number;
  skill: string;
  outcome: string;
  method: string;
  targetMonth: string;
  status: 'Not Started' | 'In Progress' | 'Completed';
  logs: ProgressLog[];
  comment: string;
}

interface CustomUser {
  uid: string; // Used as empId
}

export default function App() {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Login / Register Form State
  const [empIdInput, setEmpIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('สัตว์เลี้ยงตัวแรกชื่ออะไร?');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState({ text: '', type: '' });

  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [profile, setProfile] = useState({
    empId: '',
    name: '',
    position: '',
    department: '',
    startDate: '',
    supervisor: ''
  });

  const [goals, setGoals] = useState<Goal[]>([
    { id: Date.now(), skill: '', outcome: '', method: '', targetMonth: '', status: 'Not Started', logs: [], comment: '' }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeGoalId, setActiveGoalId] = useState<number | null>(null);
  const [tempComment, setTempComment] = useState("");

  const [newLogDrafts, setNewLogDrafts] = useState<Record<number, { text: string, status: 'Not Started' | 'In Progress' | 'Completed' }>>({});

  // Robust auto-save
  const [isDataDirty, setIsDataDirty] = useState(false);
  const isDataDirtyRef = React.useRef(isDataDirty);
  const profileRef = React.useRef(profile);
  const goalsRef = React.useRef(goals);

  useEffect(() => { isDataDirtyRef.current = isDataDirty; }, [isDataDirty]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { goalsRef.current = goals; }, [goals]);

  useEffect(() => {
    const initAuth = async () => {
      setIsLoaded(false);
      const savedUid = localStorage.getItem('customUserUid');
      if (savedUid) {
        try {
          const docRef = doc(db, 'idps', savedUid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.general) setProfile(data.general);
            if (data.goals) setGoals(data.goals);
            setIsDataDirty(false);
          }
          setUser({ uid: savedUid });
        } catch (err: any) {
          console.warn("Could not load IDP from cloud:", err.message);
          setUser({ uid: savedUid });
        }
      } else {
        setUser(null);
        setProfile({ empId: '', name: '', position: '', department: '', startDate: '', supervisor: '' });
        setGoals([{ id: Date.now(), skill: '', outcome: '', method: '', targetMonth: '', status: 'Not Started', logs: [], comment: '' }]);
        setIsDataDirty(false);
      }
      setIsLoaded(true);
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (!user || !isLoaded || !isDataDirty) return;
    
    const timeoutId = setTimeout(() => {
      setDoc(doc(db, 'idps', user.uid), {
        uid: user.uid,
        general: profile,
        goals: goals,
        updatedAt: new Date().toISOString()
      }).then(() => {
        setIsDataDirty(false);
      }).catch(e => console.warn('Auto-save err:', e.message));
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [profile, goals, user, isLoaded, isDataDirty]);

  const handleProfileChange = (field: keyof typeof profile, value: string) => {
    setIsDataDirty(true);
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleGoalChange = (id: number, field: keyof Goal, value: string) => {
    setIsDataDirty(true);
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, [field]: value } : g)));
  };

  const addGoal = () => {
    setIsDataDirty(true);
    setGoals(prev => [
      ...prev,
      { id: Date.now(), skill: '', outcome: '', method: '', targetMonth: '', status: 'Not Started', logs: [], comment: '' }
    ]);
  };

  const removeGoal = (id: number) => {
    setIsDataDirty(true);
    if (goals.length > 1) {
      setGoals(prev => prev.filter(g => g.id !== id));
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthMessage({ text: '', type: '' });
    const cleanEmpId = empIdInput.trim();
    if (!cleanEmpId || !passwordInput) {
      setAuthMessage({ text: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน', type: 'error' });
      return;
    }
    setIsAuthLoading(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanEmpId, password: passwordInput })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        localStorage.setItem('customUserUid', cleanEmpId);
        setUser({ uid: cleanEmpId });
        // Load data from Firestore for IDP (temporary fallback)
        try {
          const idpDoc = await getDoc(doc(db, 'idps', cleanEmpId));
          if (idpDoc.exists()) {
            const idpData = idpDoc.data();
            if (idpData.general) setProfile(idpData.general);
            if (idpData.goals) setGoals(idpData.goals);
          } else {
            setProfile({ empId: cleanEmpId, name: data.firstName || '', position: '', department: '', startDate: '', supervisor: '' });
            setGoals([{ id: Date.now(), skill: '', outcome: '', method: '', targetMonth: '', status: 'Not Started', logs: [], comment: '' }]);
          }
        } catch (e: any) {
           console.warn('IDP Load Error:', e.message);
        }
        setIsDataDirty(false);
        setEmpIdInput('');
        setPasswordInput('');
      } else {
        setAuthMessage({ text: data.error || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง', type: 'error' });
      }
    } catch (e: any) {
      console.warn('Login issue:', e.message);
      setAuthMessage({ text: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ (Backend API): ' + e.message, type: 'error' });
    }
    setIsAuthLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage({ text: '', type: '' });
    const cleanEmpId = empIdInput.trim();
    if (!cleanEmpId || !passwordInput || !securityAnswer) {
      setAuthMessage({ text: 'กรุณากรอกข้อมูลให้ครบถ้วน', type: 'error' });
      return;
    }
    setIsAuthLoading(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanEmpId, password: passwordInput, firstName: securityAnswer })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        setAuthMessage({ text: 'ลงทะเบียนสำเร็จ! กรุณาเข้าสู่ระบบ', type: 'success' });
        setAuthMode('login');
        setPasswordInput('');
      } else {
        setAuthMessage({ text: data.error || 'ชื่อผู้ใช้งานนี้มีในระบบแล้ว หรือเกิดข้อผิดพลาด', type: 'error' });
      }
    } catch (e: any) {
      console.warn('Register issue:', e.message);
      setAuthMessage({ text: 'เกิดข้อผิดพลาดในการลงทะเบียน (Backend API): ' + e.message, type: 'error' });
    }
    setIsAuthLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('customUserUid');
    setUser(null);
    setProfile({ empId: '', name: '', position: '', department: '', startDate: '', supervisor: '' });
    setGoals([{ id: Date.now(), skill: '', outcome: '', method: '', targetMonth: '', status: 'Not Started', logs: [], comment: '' }]);
    setIsDataDirty(false);
  };

  const handleSaveToCloud = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'idps', user.uid), {
        uid: user.uid,
        general: profile,
        goals: goals,
        updatedAt: new Date().toISOString()
      });
      setIsDataDirty(false);
      // Force the alert to be clearly visible as a confirmation
      alert('✅ บันทึกข้อมูลส่วนตัวของคุณเข้าสู่ระบบเรียบร้อยแล้ว!');
    } catch (error: any) {
      console.warn("Save warning:", error.message);
      alert('❌ บันทึกไม่สำเร็จ ตรวจสอบสิทธิ์หรืออินเทอร์เน็ต');
    }
    setIsSaving(false);
  };

  const syncLogToSheets = async (log: ProgressLog, currentGoal: Goal, currentProfile: typeof profile, currentUser: CustomUser | null) => {
    try {
      const rowData = [
        log.id,                     
        log.date,                   
        currentProfile.name,        
        currentProfile.empId,       
        currentProfile.position,    
        currentProfile.department,  
        currentProfile.startDate,   
        currentProfile.supervisor,  
        currentGoal.skill,          
        currentGoal.outcome,        
        currentGoal.targetMonth,    
        currentGoal.method,         
        log.status,                 
        log.text,                   
        currentGoal.comment,        
        currentUser?.uid || ''    
      ];
      
      const response = await fetch('/api/savelog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logData: rowData })
      });
      if (!response.ok) {
        throw new Error('Failed to save log to backend');
      }
      return true;
    } catch (e: any) {
      console.error('Save log error:', e.message);
      return false;
    }
  };

  const saveLog = async (goalId: number) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    
    if (!goal.skill.trim()) {
      alert('กรุณาระบุ "ทักษะที่ต้องการพัฒนา" ของหัวข้อนี้ก่อนบันทึกอัพเดท');
      return;
    }
    
    const draft = newLogDrafts[goalId] || { text: '', status: goal.status };
    const logText = draft.text.trim() || 'อัพเดทสถานะการพัฒนา';

    const newLog: ProgressLog = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      status: draft.status,
      text: logText
    };

    const updatedGoals = goals.map(g => {
      if (g.id === goalId) {
        return { ...g, status: draft.status, logs: [newLog, ...(g.logs || [])] };
      }
      return g;
    });
    setGoals(updatedGoals);
    setNewLogDrafts(prev => ({ ...prev, [goalId]: { text: '', status: draft.status } }));
    setIsDataDirty(true);
    
    if (user) {
      setDoc(doc(db, 'idps', user.uid), {
        uid: user.uid,
        general: profile,
        goals: updatedGoals,
        updatedAt: new Date().toISOString()
      }).catch(e => console.warn('Auto-save to firestore failed:', e));
    }

    const success = await syncLogToSheets(newLog, goal, profile, user);
    
    if (success) {
      alert('บันทึกอัพเดทของคุณลงระบบและ Google Sheets เรียบร้อยแล้ว');
    } else {
      alert('บันทึกอัพเดทลงระบบแล้ว แต่พบปัญหาการส่งข้อมูลไปที่ Google Sheets (คุณสามารถตรวจสอบใหม่ภายหลัง)');
    }
  };

  const openCommentModal = (goal: Goal) => {
    setActiveGoalId(goal.id);
    setTempComment(goal.comment);
    setIsModalOpen(true);
  };

  const saveComment = () => {
    if (activeGoalId !== null) {
      setGoals(prev => prev.map(g => (g.id === activeGoalId ? { ...g, comment: tempComment } : g)));
    }
    setIsModalOpen(false);
  };

  const autoResize = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
  };

  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => g.status === 'Completed').length;
  const progressPercent = totalGoals === 0 ? 0 : Math.round((completedGoals / totalGoals) * 100);

  if (!isLoaded) return <div className="min-h-screen bg-slate-100 flex items-center justify-center">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 max-w-md w-full relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-50 p-3 rounded-full text-indigo-600">
              {authMode === 'login' ? <LogIn size={32} /> : <UserPlus size={32} />}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
            {authMode === 'login' ? 'เข้าสู่ระบบ (Sign In)' : 'ลงทะเบียน (Register)'}
          </h2>
          <p className="text-center text-sm text-slate-500 mb-8">
            ระบบจัดเก็บแผนการพัฒนาบุคลากรรายบุคคล
          </p>

          {authMessage.text && (
            <div className={`mb-4 p-3 rounded-md text-sm font-medium ${authMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
              {authMessage.text}
            </div>
          )}

          <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">ชื่อผู้ใช้งาน (Username / รหัสพนักงาน)</label>
              <input
                type="text"
                value={empIdInput}
                onChange={(e) => setEmpIdInput(e.target.value)}
                placeholder="Ex. user1234"
                className="w-full border border-slate-300 rounded-md p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">รหัสผ่าน (Password)</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="กำหนดรหัสผ่านของคุณ"
                className="w-full border border-slate-300 rounded-md p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            {authMode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">ชื่อ-นามสกุล (First Name)</label>
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="ชื่อ-นามสกุลของคุณ"
                    className="w-full border border-slate-300 rounded-md p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isAuthLoading}
              className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 transition-colors mt-6 disabled:opacity-50"
            >
              {isAuthLoading ? 'กำลังโหลด...' : (authMode === 'login' ? 'เข้าสู่ระบบ' : 'ลงทะเบียน')}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            {authMode === 'login' ? (
              <p className="text-slate-600">
                ยังไม่มีบัญชีผู้ใช้?{' '}
                <button onClick={() => { setAuthMode('register'); setAuthMessage({ text: '', type: '' }); }} className="text-indigo-600 font-bold hover:underline">
                  ลงทะเบียนใหม่
                </button>
              </p>
            ) : (
              <p className="text-slate-600">
                มีบัญชีอยู่แล้ว?{' '}
                <button onClick={() => { setAuthMode('login'); setAuthMessage({ text: '', type: '' }); }} className="text-indigo-600 font-bold hover:underline">
                  เข้าสู่ระบบ
                </button>
              </p>
            )}
          </div>
          {authMode === 'login' && (
            <div className="mt-4 text-center">
               <p className="text-xs text-slate-400">
                 หากลืมรหัสผ่าน กรุณาแจ้งผู้ดูแลระบบ (Admin) เพื่อทำการเปลี่ยนรหัสผ่านใหม่
               </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:py-0 px-4 flex justify-center font-sans text-slate-800">

      
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 no-print z-40">
        <button onClick={handleSaveToCloud} disabled={isSaving} className="bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-all transform hover:scale-105 flex items-center justify-center group disabled:opacity-50">
          <Save size={24} />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap group-hover:ml-3 font-semibold text-base">
            {isSaving ? 'Saving...' : 'Save to Cloud'}
          </span>
        </button>
        <button 
          onClick={() => {
            try {
              if (window.self !== window.top) {
                alert('โปรดเปิดแอปในแท็บใหม่ (คลิกไอคอนแท็บใหม่ที่มุมขวาบน) เพื่อเริ่มต้นการปริ้นท์หรือเซฟเป็น PDF');
              } else {
                window.print();
              }
            } catch (e) {
              alert('โปรดเปิดแอปในแท็บใหม่ เพื่อเริ่มต้นการปริ้นท์หรือเซฟเป็น PDF');
            }
          }}
          className="bg-slate-800 text-white p-4 rounded-full shadow-lg hover:bg-slate-900 transition-all transform hover:scale-105 flex items-center justify-center group"
          title="Print to A4 Landscape"
        >
          <Printer size={24} />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap group-hover:ml-3 font-semibold text-base">Print PDF</span>
        </button>
        <button onClick={handleLogout} className="bg-white border border-slate-200 text-slate-500 p-3 rounded-full shadow-lg hover:bg-slate-50 hover:text-red-500 transition-all transform hover:scale-105 flex items-center justify-center group mt-4">
          <LogOut size={20} />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap group-hover:ml-3 font-semibold text-sm">Sign Out</span>
        </button>
      </div>

      <div className="bg-white w-full max-w-[297mm] min-h-[210mm] p-10 rounded-xl shadow-lg border border-slate-200 print:border-none print:shadow-none print:p-0 mx-auto relative overflow-hidden flex flex-col">
        
        <div className="border-b border-slate-100 mb-8 pb-6 flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2 text-white rounded-lg shadow-sm">
              <GraduationCap size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Individual Development Plan (IDP)
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                แผนการพัฒนาบุคลากรรายบุคคล
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block bg-slate-100 text-slate-600 uppercase tracking-widest text-[10px] font-bold px-3 py-1.5 mb-1.5 rounded-md">
              Development Plan Management System
            </span>
            <p className="text-xs text-slate-400 font-medium">Human Resources Dept.</p>
          </div>
        </div>

        <section className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              ส่วนที่ 1: ข้อมูลทั่วไปของพนักงาน (General Information)
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 px-2">
            <InputItem label="ชื่อ-นามสกุล (Name)" value={profile.name} onChange={(v) => handleProfileChange('name', v)} placeholder="กรอกชื่อ-นามสกุล" />
            <InputItem label="รหัสพนักงาน (Emp. ID)" value={profile.empId} onChange={(v) => handleProfileChange('empId', v)} placeholder="กรอกรหัสพนักงาน" />
            <InputItem label="ตำแหน่ง (Position)" value={profile.position} onChange={(v) => handleProfileChange('position', v)} placeholder="กรอกตำแหน่ง" />
            <InputItem label="แผนก (Department)" value={profile.department} onChange={(v) => handleProfileChange('department', v)} placeholder="กรอกแผนก" />
            <InputItem label="วันที่เริ่มงาน (Join Date)" value={profile.startDate} onChange={(v) => handleProfileChange('startDate', v)} type="date" />
            <InputItem label="ชื่อหัวหน้างาน (Manager)" value={profile.supervisor} onChange={(v) => handleProfileChange('supervisor', v)} placeholder="กรอกชื่อหัวหน้างาน" />
          </div>
        </section>

        {/* Summary Section */}
        <section className="mb-8 p-6 bg-slate-50 border border-slate-100 rounded-lg">
           <div className="flex items-center gap-2 mb-4">
             <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
             <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                สรุปแผนการพัฒนา (Development Summary)
             </h3>
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center cursor-default">
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-md shadow-sm border border-slate-100">
                 <span className="text-4xl font-black text-indigo-600 mb-1">{totalGoals}</span>
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">ทักษะเป้าหมายที่เลือกจะอบรม</span>
              </div>
              
              <div className="lg:col-span-2">
                 <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-semibold text-slate-700">ภาพรวมความสำเร็จลุล่วง (Progress)</span>
                    <span className="text-lg font-black text-emerald-600">{progressPercent}%</span>
                 </div>
                 <div className="w-full bg-slate-200 rounded-full h-3 mb-4">
                   <div className="bg-emerald-500 h-3 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                 </div>
                 
                 <div className="max-h-24 overflow-y-auto pr-2 custom-scrollbar">
                   <ul className="text-sm text-slate-600 space-y-1.5">
                     {goals.map((g, i) => (
                       <li key={g.id} className="flex items-start gap-2">
                         {g.status === 'Completed' ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0 mt-0.5"></div>}
                         <span className="font-medium line-clamp-1">{g.skill || <span className="text-slate-400 italic">ยังไม่ได้ระบุทักษะ...</span>}</span>
                       </li>
                     ))}
                   </ul>
                 </div>
              </div>
           </div>
        </section>

        <section className="mb-8 flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                ส่วนที่ 2-3: เป้าหมาย และ ความคืบหน้า
              </h3>
            </div>
            <button 
              onClick={addGoal}
              className="no-print flex items-center gap-1.5 text-indigo-600 text-xs font-bold uppercase tracking-wide hover:bg-indigo-50 px-3 py-1.5 rounded-md transition-colors"
            >
              <Plus size={16} strokeWidth={2.5} /> เพิ่มหัวข้อทักษะใหม่
            </button>
          </div>

          <div className="w-full flex-1 border border-slate-100 rounded-lg shadow-sm flex flex-col bg-white">
            <div className="w-full">
              <table className="w-full text-left border-collapse min-w-[800px] table-fixed">
                <thead className="bg-slate-50 border-b border-slate-100 text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="p-4 w-[20%]">ทักษะที่ต้องการพัฒนา</th>
                    <th className="p-4 w-[22%]">ผลลัพธ์ที่คาดหวัง / กำหนดสำเร็จ</th>
                    <th className="p-4 w-[20%]">วิธีการพัฒนา</th>
                    <th className="p-4 w-[24%]">อัพเดทความคืบหน้า (Log)</th>
                    <th className="p-4 w-[14%]">ความคิดเห็น (Manager)</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {goals.map((goal, idx) => {
                    // Safe guard logs array
                    const safeLogs = goal.logs || [];
                    return (
                    <tr key={goal.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors duration-200 align-top group relative">
                      <td className="p-4">
                        <textarea
                          className="w-full bg-transparent resize-none outline-none min-h-[60px] text-slate-800 font-medium placeholder-slate-300 focus:text-indigo-700 transition-colors"
                          placeholder="ระบุทักษะ..."
                          value={goal.skill}
                          onInput={autoResize}
                          onChange={(e) => handleGoalChange(goal.id, 'skill', e.target.value)}
                          rows={3}
                        />
                      </td>
                      <td className="p-4">
                        <textarea
                          className="w-full bg-transparent resize-none outline-none min-h-[50px] text-slate-600 italic placeholder-slate-300 focus:text-indigo-700 transition-colors"
                          placeholder="ระบุผลลัพธ์..."
                          value={goal.outcome}
                          onInput={autoResize}
                          onChange={(e) => handleGoalChange(goal.id, 'outcome', e.target.value)}
                          rows={2}
                        />
                        <div className="mt-2 border-t border-slate-100 pt-2">
                           <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-1">กำหนดเดือนสำเร็จ (Target Month)</label>
                           <input 
                             type="month" 
                             value={goal.targetMonth}
                             onChange={(e) => handleGoalChange(goal.id, 'targetMonth', e.target.value)}
                             className="text-sm font-semibold text-indigo-700 outline-none bg-transparent"
                           />
                        </div>
                      </td>
                      <td className="p-4">
                        <textarea
                          className="w-full bg-transparent resize-none outline-none min-h-[60px] text-slate-600 placeholder-slate-300 focus:text-indigo-700 transition-colors"
                          placeholder="ระบุวิธีการ..."
                          value={goal.method}
                          onInput={autoResize}
                          onChange={(e) => handleGoalChange(goal.id, 'method', e.target.value)}
                          rows={3}
                        />
                      </td>
                      <td className="p-4 border-l border-r border-slate-100">
                        <div className="mb-3">
                           <span className={`inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md ${goal.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : goal.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>
                             {goal.status}
                           </span>
                        </div>
                        
                        <div className="no-print mb-4 bg-slate-100/70 p-3 rounded-md border border-slate-200 border-dashed">
                           <textarea
                             className="w-full text-xs outline-none bg-transparent min-h-[40px] resize-none mb-2 placeholder-slate-400 font-medium"
                             placeholder="ระบุรายละเอียดการอัพเดท..."
                             value={newLogDrafts[goal.id]?.text || ''}
                             onChange={(e) => setNewLogDrafts(prev => ({ ...prev, [goal.id]: { ...prev[goal.id], text: e.target.value, status: prev[goal.id]?.status || goal.status } }))}
                           />
                           <div className="flex gap-2 items-center justify-between">
                              <select 
                                value={newLogDrafts[goal.id]?.status || goal.status}
                                onChange={(e) => setNewLogDrafts(prev => ({ ...prev, [goal.id]: { text: prev[goal.id]?.text || '', status: e.target.value as any } }))}
                                className="text-[10px] font-bold text-slate-600 outline-none bg-white border border-slate-200 rounded p-1"
                              >
                                 <option value="Not Started">ยังไม่เริ่ม</option>
                                 <option value="In Progress">กำลังทำ</option>
                                 <option value="Completed">สำเร็จแล้ว</option>
                              </select>
                              <button onClick={() => saveLog(goal.id)} className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded font-bold hover:bg-indigo-700 transition-colors">
                                เพิ่มอัพเดท
                              </button>
                           </div>
                        </div>

                        <div className="space-y-3 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                           {safeLogs.length === 0 ? <p className="text-xs text-slate-400 italic">No progress logged.</p> : null}
                           {safeLogs.map(log => (
                             <div key={log.id} className="text-xs relative pl-3 border-l-2 border-indigo-200">
                               <span className="block text-[10px] text-slate-400 font-bold mb-0.5">{log.date} · <span className={log.status === 'Completed' ? 'text-emerald-600' : 'text-slate-500'}>{log.status}</span></span>
                               <span className="text-slate-700 whitespace-pre-wrap">{log.text}</span>
                             </div>
                           ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="min-h-[60px] whitespace-pre-wrap text-[12px] text-slate-600">
                          {goal.comment ? (
                            <div className="bg-indigo-50/50 p-2 rounded border border-indigo-50 text-indigo-900 italic">
                              "{goal.comment}"
                            </div>
                          ) : (
                            <span className="text-slate-400 italic no-print py-1 block">ยังไม่มีความคิดเห็น</span>
                          )}
                        </div>
                        <button 
                          onClick={() => openCommentModal(goal)}
                          className="no-print mt-3 bg-indigo-50 border border-indigo-100 py-1.5 px-3 rounded-md text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <MessageSquare size={13} /> Edit
                        </button>
                        
                        <button 
                          onClick={() => removeGoal(goal.id)} 
                          className="absolute bottom-4 right-4 text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-md transition-all opacity-0 group-hover:opacity-100 no-print" 
                          title="Delete Goal"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="mt-auto pt-6 flex justify-between items-end border-t border-slate-100">
          <div className="grid grid-cols-2 gap-10 w-4/5 md:w-3/5 lg:w-1/2 text-sm text-slate-600">
            <div className="text-center">
              <div className="border-b border-slate-300 h-10 mb-2"></div>
              <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide">ลายมือชื่อพนักงาน</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Date: ....../....../......</p>
            </div>
            <div className="text-center">
              <div className="border-b border-slate-300 h-10 mb-2"></div>
              <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide">ลายมือชื่อหัวหน้างาน</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Date: ....../....../......</p>
            </div>
          </div>
          
          <div className="text-right pb-1">
             <div className="flex flex-col items-end">
                <span className="font-black text-xl text-slate-800 tracking-tight leading-none">
                  THAIRATH<span className="font-light text-slate-400"> GROUP</span>
                </span>
                <span className="text-[9px] text-indigo-600 uppercase tracking-widest mt-1.5 font-bold flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                  Official Document
                </span>
             </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 no-print transition-all duration-300">
          <div className="bg-white max-w-lg w-full rounded-xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare size={16} className="text-indigo-600" />
                ข้อเสนอแนะจากหัวหน้างาน
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-3">
                Manager's Feedback & Guidance
              </p>
              <textarea
                className="w-full border border-slate-200 rounded-lg outline-none p-4 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all min-h-[150px] text-sm text-slate-800 placeholder-slate-400"
                placeholder="พิมพ์ข้อคิดเห็นหรือคำแนะนำเพิ่มเติมเพื่อการพัฒนาของพนักงาน..."
                value={tempComment}
                onChange={(e) => setTempComment(e.target.value)}
                autoFocus
              ></textarea>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100 text-sm">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-800 font-medium transition shadow-sm"
              >
                ยกเลิก
              </button>
              <button 
                onClick={saveComment}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow-sm hover:bg-indigo-700 hover:shadow-md transition font-medium"
              >
                บันทึก (Save)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InputItem({ label, value, onChange, placeholder, type = "text" }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, type?: string }) {
  return (
    <div className="flex flex-col group space-y-1">
      <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-semibold text-slate-800 border-b border-slate-200 pb-1.5 outline-none bg-transparent focus:border-indigo-500 focus:text-indigo-700 transition-colors print:p-0 print:border-none w-full placeholder-slate-300 text-sm"
      />
    </div>
  );
}
