import * as React from 'react';
import { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  Wrench, 
  AlertCircle, 
  ShoppingCart, 
  Car, 
  User, 
  Shield, 
  CheckCircle2, 
  Camera, 
  MapPin, 
  Phone,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Calendar,
  Building
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole } from '../types';

import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

interface LoginProps {
  onLogin: (role: UserRole) => void;
  key?: string;
}

export default function Login({ onLogin }: LoginProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Common Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('owner');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [photoURL, setPhotoURL] = useState('');

  // Auto-detect existing auth but missing profile
  React.useEffect(() => {
    if (auth.currentUser) {
      console.log("MECHORA: Detected authed user without profile. Forcing registration mode.");
      setIsRegistering(true);
      setStep(1); // Start with role selection if profile is missing
      if (auth.currentUser.email) setEmail(auth.currentUser.email);
    }
  }, []);

  // Role Specific Fields
  const [age, setAge] = useState('');
  const [yearOfBirth, setYearOfBirth] = useState('');
  const [carInfo, setCarInfo] = useState('');
  const [garageName, setGarageName] = useState('');
  const [garageLocation, setGarageLocation] = useState('');
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);

  const getGeolocation = () => {
    if ("geolocation" in navigator) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLoading(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setError("Could not get precise location. Using default.");
          setLoading(false);
        }
      );
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("MECHORA: Submit triggering...");
    
    if (loading) {
      console.log("MECHORA: Submit ignored, already loading.");
      return;
    }
    
    setLoading(true);
    setError(null);
    console.log("MECHORA: State set to loading. Step:", step, "Mode:", isRegistering ? "Register" : "Login");

    const abortTimeout = setTimeout(() => {
      setLoading(false);
      setError("Operation timed out. Please try again.");
      console.warn("MECHORA: Internal 30s timeout reached.");
    }, 30000);

    try {
      if (!isRegistering) {
        console.log("MECHORA: Executing Login API...");
        // Use standard sign in
        const cred = await signInWithEmailAndPassword(auth, email, password);
        console.log("MECHORA: Login API success for:", cred.user.email);
        
        // Proactively fetch role to speed up transition
        console.log("MECHORA: Proactively fetching profile...");
        const profileSnap = await getDoc(doc(db, 'users', cred.user.uid));
        
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          console.log("MECHORA: Profile found. Role:", profileData.role);
          onLogin(profileData.role as UserRole);
        } else if (cred.user.email === 'nathy202444@gmail.com') {
          console.log("MECHORA: Master admin transition triggered.");
          onLogin('admin');
        } else {
          console.warn("MECHORA: No profile found for signed-in user. Triggering registration mode.");
          setIsRegistering(true);
          setStep(1);
          setLoading(false); 
          return;
        }
      } else {
        if (step < 3) {
          console.log("MECHORA: Advancing step...");
          nextStep();
        } else {
          console.log("MECHORA: Executing Registration API...");
          let user = auth.currentUser;
          
          try {
            if (!user) {
               const cred = await createUserWithEmailAndPassword(auth, email, password);
               user = cred.user;
            }
          } catch (regErr: any) {
            // If they are registering but account exists, try to just log them in and continue
            if (regErr.code === 'auth/email-already-in-use') {
              console.log("MECHORA: Email exists during reg. Attempting parallel sign-in recovery.");
              const cred = await signInWithEmailAndPassword(auth, email, password);
              user = cred.user;
            } else {
              throw regErr;
            }
          }
          
          if (!user) throw new Error("Auth failed");
          
          const assignedRole = user.email === 'nathy202444@gmail.com' ? 'admin' : role;
          const baseData = {
            uid: user.uid,
            name,
            email: user.email,
            role: assignedRole,
            phone,
            region,
            gender,
            photoURL: photoURL || `https://picsum.photos/seed/${user.uid}/200/200`,
            isApproved: true,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...(assignedRole === 'owner' ? { age: parseInt(age), yearOfBirth, carInfo } : {}),
            ...(assignedRole === 'mechanic' ? { 
              garageInfo: garageName, 
              garageLocation,
              location: coords || { lat: -1.2921, lng: 36.8219 } // Default to Nairobi
            } : {})
          };

          console.log("MECHORA: Writing profile to DB...");
          await setDoc(doc(db, 'users', user.uid), baseData);
          console.log("MECHORA: DB write success. Triggering onLogin...");
          onLogin(assignedRole as UserRole);
        }
      }
    } catch (err: any) {
      console.error("MECHORA Error caught:", err);
      let message = "An error occurred. Please try again.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = "Incorrect email or password. Please check your credentials.";
        if (err.code === 'auth/invalid-credential') {
          console.warn("MECHORA: auth/invalid-credential detected. This might be a session mismatch.");
          message = "Authentication failed. If this persists, try clearing your browser cache and refreshing.";
        }
      } else if (err.code === 'auth/email-already-in-use') {
        message = "This email is already registered. Please sign in instead.";
      } else if (err.code === 'auth/too-many-requests') {
        message = "Too many failed attempts. Access temporarily locked for security.";
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      clearTimeout(abortTimeout);
      setLoading(false);
      console.log("MECHORA: Submit cycle complete.");
    }
  };

  return (
    <div className="min-h-screen bg-brand-blue flex flex-col font-sans">
      {/* Header Area */}
      <div className="p-8 pt-12 text-white">
        <div className="flex items-center gap-4 mb-6">
           <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
             <Car size={32} />
           </div>
           <div>
             <h1 className="text-3xl font-black tracking-tight leading-none cursor-pointer"
                onClick={(e) => {
                  if (e.detail === 3) {
                    localStorage.clear();
                    auth.signOut();
                    window.location.reload();
                  }
                }}
              >
                Mechora
              </h1>
             <p className="text-white/60 text-xs font-bold uppercase tracking-widest mt-1">Unified Auto Solutions</p>
           </div>
        </div>
        
        <h2 className="text-4xl font-black mb-2 leading-tight">
          {isRegistering ? `Step ${step}/3` : 'Welcome Back'}
        </h2>
        <p className="text-white/60 text-lg font-medium">
          {isRegistering ? (
            step === 1 ? 'Select your role in the system' :
            step === 2 ? 'Let\'s get to know you better' :
            'Almost there! Just some more details'
          ) : 'Access your dashboard'}
        </p>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-brand-blue/60 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-white">
          <Loader2 className="animate-spin mb-4" size={48} />
          <p className="font-bold tracking-widest animate-pulse uppercase">Processing...</p>
        </div>
      )}

      {/* Main Form Area */}
      <div className="flex-1 bg-slate-50 rounded-t-[48px] p-8 -mt-4 shadow-2xl relative">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 text-red-500 p-4 rounded-2xl flex items-center gap-3 border border-red-100 italic text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {!isRegistering ? (
              <motion.div key="login-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <InputGroup label="Email" icon={<User size={18} />}>
                   <input 
                     type="email" 
                     className="auth-input" 
                     placeholder="your@email.com" 
                     value={email} 
                     onChange={e => setEmail(e.target.value)} 
                     required 
                   />
                </InputGroup>
                <InputGroup label="Password" icon={<Shield size={18} />}>
                   <div className="relative">
                     <input 
                        type={showPassword ? "text" : "password"} 
                        className="auth-input pr-12" 
                        placeholder="••••••••" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                     />
                     <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                     </button>
                   </div>
                </InputGroup>
              </motion.div>
            ) : (
              <motion.div key={`step-${step}`} initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                {step === 1 && (
                  <div className="space-y-4">
                    <RoleButton active={role === 'owner'} onClick={() => setRole('owner')} title="Car Owner" desc="I need help with my car" icon={<Car size={24} />} />
                    <RoleButton active={role === 'mechanic'} onClick={() => setRole('mechanic')} title="Mechanic fundi" desc="I provide pro services" icon={<Wrench size={24} />} />
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <InputGroup label="Full Name" icon={<User size={18} />}>
                       <input type="text" className="auth-input" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
                    </InputGroup>
                    <InputGroup label="Phone Number" icon={<Phone size={18} />}>
                       <input type="tel" className="auth-input" placeholder="+254 7XX XXX XXX" value={phone} onChange={e => setPhone(e.target.value)} required />
                    </InputGroup>
                    <InputGroup label="Region / City" icon={<MapPin size={18} />}>
                       <input type="text" className="auth-input" placeholder="Nairobi, KE" value={region} onChange={e => setRegion(e.target.value)} required />
                    </InputGroup>
                    <div className="grid grid-cols-2 gap-4">
                       <InputGroup label="Email" icon={<User size={18} />}>
                          <input type="email" className="auth-input" placeholder="me@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                       </InputGroup>
                       <InputGroup label="Password" icon={<Shield size={18} />}>
                          <input type="password" className="auth-input" placeholder="••••" value={password} onChange={e => setPassword(e.target.value)} required />
                       </InputGroup>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                     <div className="flex justify-center mb-6">
                        <div className="relative group cursor-pointer" onClick={() => setPhotoURL(`https://picsum.photos/seed/${Date.now()}/200/200`)}>
                           <div className="w-24 h-24 rounded-3xl bg-slate-200 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden">
                              {photoURL ? <img src={photoURL} className="w-full h-full object-cover" alt="Profile" /> : <Camera className="text-slate-400" size={32} />}
                           </div>
                           <div className="absolute -bottom-2 -right-2 bg-brand-blue text-white p-2 rounded-xl border-4 border-white shadow-lg">
                              <Camera size={14} />
                           </div>
                           <p className="text-[10px] text-center mt-2 font-bold text-slate-400 uppercase tracking-tighter">Click to simulate upload</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-3 gap-3">
                        {['male', 'female', 'other'].map(g => (
                          <button 
                            key={g} type="button" onClick={() => setGender(g as any)}
                            className={`py-3 rounded-2xl border text-xs font-bold uppercase tracking-widest transition-all ${gender === g ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-brand-blue/20' : 'bg-white text-slate-400 border-slate-100'}`}
                          >
                            {g}
                          </button>
                        ))}
                     </div>

                     {role === 'owner' && (
                        <div className="space-y-4">
                           <div className="grid grid-cols-2 gap-3">
                              <InputGroup label="Age" icon={<Calendar size={18} />}>
                                 <input type="number" className="auth-input" placeholder="25" value={age} onChange={e => setAge(e.target.value)} required />
                              </InputGroup>
                              <InputGroup label="Year of Birth" icon={<Calendar size={18} />}>
                                 <input type="text" className="auth-input" placeholder="1998" value={yearOfBirth} onChange={e => setYearOfBirth(e.target.value)} required />
                              </InputGroup>
                           </div>
                           <InputGroup label="Vehicles (owned)" icon={<Car size={18} />}>
                              <input type="text" className="auth-input" placeholder="Toyota Fielder, Mazda Axela" value={carInfo} onChange={e => setCarInfo(e.target.value)} required />
                           </InputGroup>
                        </div>
                     )}

                     {role === 'mechanic' && (
                        <div className="space-y-4">
                           <InputGroup label="Garage Name" icon={<Building size={18} />}>
                              <input type="text" className="auth-input" placeholder="Kibera Pro Autocare" value={garageName} onChange={e => setGarageName(e.target.value)} required />
                           </InputGroup>
                           <InputGroup label="Garage Location" icon={<MapPin size={18} />}>
                              <div className="flex gap-2">
                                <input type="text" className="auth-input flex-1" placeholder="Ngong Road, Suite 4" value={garageLocation} onChange={e => setGarageLocation(e.target.value)} required />
                                <button
                                  type="button"
                                  onClick={getGeolocation}
                                  className={`p-4 rounded-xl border transition-all ${coords ? 'bg-green-50 border-green-200 text-green-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                                >
                                  <MapPin size={24} />
                                </button>
                              </div>
                              <p className="text-[10px] font-bold text-slate-400 mt-1 ml-2 uppercase">Tap icon to pin GPS</p>
                           </InputGroup>
                        </div>
                     )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-4 pt-4">
            {isRegistering && step > 1 && (
               <button type="button" onClick={prevStep} className="bg-slate-100 p-5 rounded-[24px] text-slate-500 active:scale-90 transition-transform">
                  <ArrowLeft size={24} />
               </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand-blue text-white py-5 rounded-[24px] font-black text-xl shadow-xl shadow-brand-blue/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : (
                <>
                   {(!isRegistering || step === 3) ? (isRegistering ? 'Create Account' : 'Sign In Now') : 'Continue'}
                   <ArrowRight size={24} />
                </>
              )}
            </button>
          </div>

          <div className="text-center pb-8 pt-4">
             <button
               type="button"
               onClick={() => {
                 setIsRegistering(!isRegistering);
                 setStep(1);
                 setError(null);
               }}
               className="text-slate-400 font-bold text-sm tracking-tight"
             >
               {isRegistering ? 'Already a member?' : "Don't have an account?"} <span className="text-brand-blue font-black underline underline-offset-4 decoration-2">
                 {isRegistering ? 'Login here' : 'Join Mechora Free'}
               </span>
             </button>
          </div>
        </form>
      </div>

      <style>{`
        .auth-input {
          width: 100%;
          background: #f8fafc;
          border: 2px solid transparent;
          border-radius: 20px;
          padding: 16px;
          font-weight: 600;
          color: #0f172a;
          transition: all 0.2s;
        }
        .auth-input:focus {
          background: white;
          border-color: #2563eb;
          box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.1);
          outline: none;
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

function InputGroup({ label, icon, children }: { label: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-4">
          {icon}
          {label}
       </label>
       {children}
    </div>
  );
}

function RoleButton({ active, onClick, title, desc, icon }: { active: boolean, onClick: () => void, title: string, desc: string, icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-6 rounded-[32px] border-2 text-left transition-all ${active ? 'bg-brand-blue text-white border-brand-blue shadow-2xl scale-[1.02]' : 'bg-white text-slate-400 border-slate-50'}`}
    >
      <div className="flex items-center gap-4">
         <div className={`p-4 rounded-2xl ${active ? 'bg-white/20' : 'bg-slate-50'}`}>
            {icon}
         </div>
         <div>
            <h4 className="font-bold tracking-tight text-lg">{title}</h4>
            <p className={`text-xs ${active ? 'text-white/70' : 'text-slate-400'}`}>{desc}</p>
         </div>
         {active && <CheckCircle2 size={24} className="ml-auto" />}
      </div>
    </button>
  );
}
