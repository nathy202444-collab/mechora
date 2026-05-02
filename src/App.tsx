import * as React from 'react';
import { useState, useEffect, Suspense, lazy } from 'react';
import Login from './components/Login.tsx';
import OwnerDashboard from './components/OwnerDashboard.tsx';
import MechanicDashboard from './components/MechanicDashboard.tsx';
import AdminDashboard from './components/AdminDashboard.tsx';
import BottomNav from './components/layout/BottomNav.tsx';
import { UserRole } from './types.ts';
import { MessageSquare, X, Send, Sparkles, Clock, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { auth, db } from './lib/firebase.ts';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';

// Keep lazy loading for massive/secondary modules only
const BookingModule = lazy(() => import('./components/BookingModule.tsx'));
const SOSModule = lazy(() => import('./components/SOSModule.tsx'));
const ShopModule = lazy(() => import('./components/ShopModule.tsx'));
const ProfileModule = lazy(() => import('./components/ProfileModule.tsx'));

export default function App() {
  const [role, setRole] = useState<UserRole | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mechora_last_role') as UserRole | null;
    }
    return null;
  });
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('mechora_user_profile');
      return cached ? JSON.parse(cached) : null;
    }
    return null;
  });
  
  // If we have a cached role and profile, we can start rendering immediately 
  // without showing the splash screen.
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
       return !(localStorage.getItem('mechora_last_role') && localStorage.getItem('mechora_user_profile'));
    }
    return true;
  }); 
  const [profileSyncing, setProfileSyncing] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [osActive, setOsActive] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Derived user ID (cached or live)
  const currentUid = user?.uid || userProfile?.uid;
  const currentRole = role || userProfile?.role;

  React.useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    
    // Fail-safe: if loading takes more than 5 seconds, FORCE it to stop
    const failSafe = setTimeout(() => {
      console.warn("MECHORA: Loading fail-safe triggered after 5s hang.");
      setLoading(false);
      setProfileSyncing(false); 
      if (!currentUid || !currentRole) {
        setBootError("Connection is slow. Still trying to reach the server...");
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("MECHORA: Auth state transition ->", firebaseUser?.uid || 'guest');
      
      // Always clear previous profile listener
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        setProfileSyncing(true);
        
        // Start profile synchronization
        unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          console.log("MECHORA: Profile sync snapshot received. Found:", docSnap.exists());
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile(data);
            localStorage.setItem('mechora_user_profile', JSON.stringify(data));
            
            let assignedRole: UserRole = data.role;
            
            // Proactive Maintenance: Ensure master user is always approved and active
            if (firebaseUser.email === 'nathy202444@gmail.com') {
              // FORCE change to mechanic for this request
              const targetRole: UserRole = 'mechanic';
              assignedRole = targetRole; 
              
              if (data.isApproved !== true || data.status !== 'active' || data.role !== targetRole) {
                console.log("MECHORA: Syncing master account to MECHANIC role...");
                updateDoc(doc(db, 'users', firebaseUser.uid), {
                  isApproved: true,
                  status: 'active',
                  role: targetRole,
                  updatedAt: serverTimestamp()
                }).catch(e => console.error("MECHORA: Failed to sync master account:", e));
              }
            } else if (data.role === 'admin') {
              assignedRole = 'admin';
            }
            
            setRole(assignedRole);
            localStorage.setItem('mechora_last_role', assignedRole);
          } else {
            // Logged in but profile record missing in Firestore
            console.warn("MECHORA: Authenticated but no profile record found.");
            setUserProfile(null);
            setRole(null);
            localStorage.removeItem('mechora_user_profile');
            localStorage.removeItem('mechora_last_role');
          }
          
          // Complete the sync
          setProfileSyncing(false);
          setLoading(false);
          clearTimeout(failSafe);
        }, (error) => {
          console.error("MECHORA: Critical Profile Sync Error:", error);
          setBootError("Network connection interrupted. Please refresh.");
          setProfileSyncing(false);
          setLoading(false);
          clearTimeout(failSafe);
        });
      } else {
        // Explicit logout or no session
        setUser(null);
        setRole(null);
        setUserProfile(null);
        localStorage.removeItem('mechora_last_role');
        localStorage.removeItem('mechora_user_profile');
        setProfileSyncing(false);
        setLoading(false);
        clearTimeout(failSafe);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
      clearTimeout(failSafe);
    };
  }, []);

  const handleLogin = (selectedRole: UserRole) => {
    setRole(selectedRole);
    setBootError(null);
    localStorage.setItem('mechora_last_role', selectedRole);
  };

  const renderContent = () => {
    // If not loading, and we don't have a user or role, show login
    if (!currentUid || !currentRole) {
      return <Login onLogin={handleLogin} />;
    }

    if (osActive) return <SOSModule onBack={() => setOsActive(false)} userId={currentUid} role={currentRole} />;

    if (currentRole === 'owner') {
      switch (activeTab) {
        case 'home': return (
          <OwnerDashboard 
            userId={currentUid} 
            onNavigateBooking={() => setActiveTab('services')} 
            onNavigateSOS={() => setOsActive(true)}
            onNavigateShop={() => setActiveTab('shop')}
          />
        );
        case 'services': return <BookingModule userId={currentUid} userProfile={userProfile} onClose={() => setActiveTab('home')} />;
        case 'shop': return <ShopModule userId={currentUid} role={currentRole} />;
        case 'profile': return <ProfileModule userId={currentUid} role={currentRole} onLogout={handleLogout} setActiveTab={setActiveTab} />;
        default: return (
          <OwnerDashboard 
            userId={currentUid} 
            onNavigateBooking={() => setActiveTab('services')} 
            onNavigateSOS={() => setOsActive(true)}
            onNavigateShop={() => setActiveTab('shop')}
          />
        );
      }
    }

    if (currentRole === 'mechanic') {
      switch (activeTab) {
        case 'home': return <MechanicDashboard userId={currentUid} activeTab="home" />;
        case 'services': return <MechanicDashboard userId={currentUid} activeTab="services" />;
        case 'shop': return <ShopModule userId={currentUid} role={currentRole} />;
        case 'profile': return <ProfileModule userId={currentUid} role={currentRole} onLogout={handleLogout} setActiveTab={setActiveTab} />;
        default: return <MechanicDashboard userId={currentUid} activeTab="home" />;
      }
    }

    if (currentRole === 'admin') {
      const adminTabMap: Record<string, string> = {
        'home': 'overview',
        'services': 'bookings',
        'shop': 'shop',
        'profile': 'profile'
      };
      
      const targetAdminTab = adminTabMap[activeTab] || 'overview';
      
      if (activeTab === 'profile') {
        return <ProfileModule userId={currentUid} role={currentRole} onLogout={handleLogout} setActiveTab={setActiveTab} />;
      }
      
      return <AdminDashboard userId={currentUid} activeTab={targetAdminTab} />;
    }

    return null;
  };

  const handleLogout = async () => {
    await signOut(auth);
    setRole(null);
    setUser(null);
    setActiveTab('home');
    setOsActive(false);
  };

  const sendMessage = async () => {

    const userMessage = { role: 'user' as const, content: input };
    setChatMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [...chatMessages, userMessage].map(msg => ({
          role: msg.role,
          parts: [{ text: msg.content }]
        })) as any,
        config: {
          systemInstruction: "You are Mechora AI, a helpful assistant for the Auto Connect Platform. You help car owners find mechanics, explain car problems, and assist mechanics with diagnostic tips. Keep responses concise and helpful.",
        }
      });

      const modelMessage = { role: 'model' as const, content: response.text || "Sorry, I couldn't process that." };
      setChatMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error("AI Error:", error);
      setChatMessages(prev => [...prev, { role: 'model' as const, content: "I'm having trouble connecting to my brain right now. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (loading || (user && !role && profileSyncing)) {
    return (
      <div className="min-h-screen bg-brand-blue flex flex-col items-center justify-center p-8 text-center text-white">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="font-bold text-4xl tracking-widest mb-8"
        >
          MECHORA
        </motion.div>
        
        {bootError && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <p className="text-white/60 font-medium">{bootError}</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => window.location.reload()}
                className="bg-white text-brand-blue px-6 py-3 rounded-2xl font-bold active:scale-95 transition-transform"
              >
                Refresh App
              </button>
              {user && (
                <button 
                  onClick={() => signOut(auth)}
                  className="text-white/40 text-sm font-medium hover:text-white transition-colors"
                >
                  Sign Out of Current Account
                </button>
              )}
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // If not loading, and we don't have a user or role, show login
  if (!currentUid || !currentRole) {
    return <Login onLogin={handleLogin} key={user?.uid || 'guest'} />;
  }

  if (role !== 'admin' && userProfile && !userProfile.isApproved) {
    return (
      <div className="min-h-screen bg-brand-blue flex flex-col items-center justify-center p-8 text-center text-white font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 p-8 rounded-[48px] backdrop-blur-xl border border-white/20 shadow-2xl space-y-8 max-w-md w-full"
        >
           <div className="bg-yellow-400 w-24 h-24 rounded-[32px] flex items-center justify-center mx-auto shadow-xl shadow-yellow-400/20">
              <Clock size={48} className="text-slate-900" />
           </div>
           <div className="space-y-2">
              <h1 className="text-3xl font-black">Account Pending</h1>
              <p className="text-white/70 font-medium leading-relaxed">
                Your account is currently under review by our administrators. You'll receive full access once your credentials have been verified.
              </p>
           </div>
           <div className="bg-white/5 p-4 rounded-3xl border border-white/10">
              <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-1">Status</p>
              <p className="font-black text-yellow-400">Waiting for Approval</p>
           </div>
           <button 
             onClick={handleLogout}
             className="w-full bg-white text-brand-blue py-5 rounded-3xl font-black active:scale-95 transition-all"
           >
              Sign Out
           </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <main className="flex-1">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="animate-spin text-brand-blue" size={40} />
          </div>
        }>
          {renderContent()}
        </Suspense>
      </main>

      <BottomNav 
        role={role} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onSOS={() => setOsActive(true)} 
      />

      {/* Floating AI Chat Button */}
      <button 
        onClick={() => setIsAIChatOpen(true)}
        className="fixed bottom-24 right-4 bg-brand-blue text-white p-4 rounded-full shadow-2xl z-40 active:scale-95 transition-transform"
      >
        <Sparkles size={24} />
      </button>

      {/* AI Chat Drawer */}
      <AnimatePresence>
        {isAIChatOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAIChatOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[80vh] bg-white rounded-t-[40px] z-[60] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-brand-blue text-white">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold">Mechora AI</h3>
                    <p className="text-white/60 text-xs">Always here to help</p>
                  </div>
                </div>
                <button onClick={() => setIsAIChatOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                {chatMessages.length === 0 && (
                  <div className="text-center py-12 space-y-4">
                    <div className="bg-blue-100 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto text-brand-blue">
                      <Sparkles size={32} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">How can I help you today?</h4>
                      <p className="text-slate-400 text-sm max-w-[240px] mx-auto">Ask me about car problems, finding mechanics, or how to use the app.</p>
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-3xl ${
                      msg.role === 'user' 
                      ? 'bg-brand-blue text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-tl-none'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isTyping && (
                   <div className="flex justify-start">
                     <div className="bg-white p-4 rounded-3xl rounded-tl-none shadow-sm border border-slate-100 flex gap-1">
                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-150"></span>
                        <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-300"></span>
                     </div>
                   </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-white">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-100 border-none rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-brand-blue transition-shadow"
                  />
                  <button 
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="bg-brand-blue text-white p-3 rounded-2xl active:scale-95 transition-transform disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center mt-3 font-medium uppercase tracking-wider">Powered by Gemini AI</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
