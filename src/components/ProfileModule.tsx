import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User as UserIcon, 
  Car, 
  Settings, 
  Bell, 
  Lock, 
  ChevronRight, 
  LogOut, 
  Edit3, 
  Camera,
  MapPin,
  Building2,
  Phone,
  CheckCircle2,
  Mail,
  Loader2,
  Package,
  Trash2,
  AlertCircle,
  X,
  BookOpen,
  Calendar,
  Wrench
} from 'lucide-react';
import { UserRole } from '../types';

import { auth, db, storage } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { deleteUser } from 'firebase/auth';

interface ProfileModuleProps {
  role: UserRole;
  onLogout: () => void;
  userId: string;
  setActiveTab?: (tab: string) => void;
}

export default function ProfileModule({ role, onLogout, userId, setActiveTab }: ProfileModuleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [shopItems, setShopItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const drivingTips = [
    { title: "Eco-Driving", content: "Smooth acceleration and braking can improve fuel efficiency by up to 20%." },
    { title: "Tire Health", content: "Check tire pressure monthly to prevent wear and improve safety." },
    { title: "Night Safety", content: "Keep your windshield clean to reduce glare from oncoming headlights." }
  ];

  useEffect(() => {
    // 1. Fetch Profile
    const fetchProfile = async () => {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setProfileData(userDoc.data());
      }
    };

    // 2. Fetch Orders (Transactions) - Common for both
    const qOrders = query(
      collection(db, "orders"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
    });

    // 3. Role specific fetching
    let unsubRoleSpecific: () => void = () => {};

    if (role === 'owner') {
      const qDiag = query(
        collection(db, "bookings"),
        where("ownerId", "==", userId),
        where("status", "==", "accepted"),
        orderBy("createdAt", "desc")
      );
      unsubRoleSpecific = onSnapshot(qDiag, async (snapshot) => {
        const diagData = [];
        for (const d of snapshot.docs) {
          const b = d.data();
          let mechanicName = "Pending...";
          if (b.mechanicId) {
            const mDoc = await getDoc(doc(db, "users", b.mechanicId));
            if (mDoc.exists()) mechanicName = mDoc.data().name;
          }
          diagData.push({ id: d.id, ...b, mechanicName });
        }
        setDiagnostics(diagData);
      });
    } else if (role === 'mechanic') {
      const qItems = query(
        collection(db, "products"),
        where("mechanicId", "==", userId)
      );
      unsubRoleSpecific = onSnapshot(qItems, (snapshot) => {
        setShopItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    setLoading(false);
    fetchProfile();
    return () => {
      unsubOrders();
      unsubRoleSpecific();
    };
  }, [userId, role]);

  if (!profileData) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-brand-blue" size={40} />
    </div>
  );

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 5MB for storage, but ideally smaller)
    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Please select an image under 5MB.");
      return;
    }

    console.log("Starting photo upload for file:", file.name);
    setIsUploading(true);
    setShowPhotoOptions(false);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMessage = "Upload failed";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const textError = await response.text();
          errorMessage = textError || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log("Upload successful, URL:", result.imageUrl);
      const downloadURL = result.imageUrl;

      const updatedData = { ...profileData, photoURL: downloadURL };
      setProfileData(updatedData);

      // Save to Firestore immediately
      await updateDoc(doc(db, 'users', userId), {
        photoURL: downloadURL,
        updatedAt: new Date()
      });
      
      console.log("Firestore updated with new photoURL");
    } catch (err: any) {
      console.error("Upload error detail:", err);
      alert(`Upload failed: ${err.message}. Check your internet connection.`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUseDefaultAvatar = async () => {
    const defaultURL = `https://picsum.photos/seed/${userId}/150/150`;
    setIsUploading(true);
    setShowPhotoOptions(false);

    try {
      const updatedData = { ...profileData, photoURL: defaultURL };
      setProfileData(updatedData);

      await updateDoc(doc(db, 'users', userId), {
        photoURL: defaultURL,
        updatedAt: new Date()
      });
      
      alert("Reset to default avatar!");
    } catch (err) {
      console.error("Reset avatar error:", err);
    } finally {
      setIsUploading(false);
    }
  };
  
   const handleVehiclePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Limit 5MB.");
      return;
    }

    setIsUploading(true);
    console.log("Starting vehicle photo upload:", file.name);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      
      if (!res.ok) {
        let errorMessage = "Vehicle upload failed";
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          const textError = await res.text();
          errorMessage = textError || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const result = await res.json();
      const photoURL = result.imageUrl;
      console.log("Vehicle upload successful:", photoURL);

      setProfileData(prev => ({ ...prev, vehiclePhotoURL: photoURL }));
      
      await updateDoc(doc(db, 'users', userId), {
        vehiclePhotoURL: photoURL,
        updatedAt: new Date()
      });
      
      console.log("Firestore updated with new vehiclePhotoURL");
    } catch (err: any) {
      console.error("Vehicle photo upload error:", err);
      alert(`Vehicle photo failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (newData: any) => {
    try {
      const response = await fetch(`/api/profile/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify(newData),
      });
      if (!response.ok) throw new Error("Failed to save profile");
    } catch (err) {
      console.error("Save profile error:", err);
      alert("Failed to save changes. Please try again.");
    }
  };

  const toggleEdit = async () => {
    if (isEditing) {
      await handleSave(profileData);
    }
    setIsEditing(!isEditing);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // 1. Delete from Firestore
      await deleteDoc(doc(db, 'users', userId));
      
      // 2. Delete from Auth (requires recent login usually)
      const user = auth.currentUser;
      if (user) {
        await deleteUser(user);
      }
      
      onLogout();
    } catch (err: any) {
      console.error("Delete account error:", err);
      alert("Please re-login before deleting your account for security reasons.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Header */}
      <div className="bg-brand-blue p-8 pt-12 text-white rounded-b-[40px] pb-16 relative mb-12 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="flex justify-between items-center mb-8 relative z-10">
           <h1 className="text-xl font-bold uppercase tracking-widest text-white/60">Profile Center</h1>
           <button 
             onClick={toggleEdit}
             className="bg-white/10 p-2 rounded-xl text-white hover:bg-white/20 transition-all active:scale-95 shadow-lg"
           >
             {isEditing ? <CheckCircle2 size={24} className="text-green-400" /> : <Edit3 size={24} />}
           </button>
        </div>

        {/* Profile Avatar & Info Card */}
        <div className="absolute -bottom-10 left-6 right-6 bg-white rounded-[32px] p-6 shadow-2xl flex items-center gap-5 text-slate-900 border border-slate-100 ring-4 ring-white/10">
           <div className="relative group">
              <img 
                src={profileData?.photoURL || `https://picsum.photos/seed/${userId}/150/150`} 
                className={`w-20 h-20 rounded-[28px] object-cover border-4 border-slate-50 shadow-inner transition-opacity ${isUploading ? 'opacity-50' : 'opacity-100'}`}
                alt="Profile"
                referrerPolicy="no-referrer"
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="animate-spin text-brand-blue" size={20} />
                </div>
              )}
              <button 
                onClick={() => setShowPhotoOptions(!showPhotoOptions)}
                className="absolute -bottom-1 -right-1 bg-brand-blue text-white p-2 rounded-xl border-4 border-white shadow-xl active:scale-90 transition-transform z-10"
              >
                 <Camera size={14} />
              </button>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload} 
                className="hidden" 
                accept="image/*" 
              />

              <AnimatePresence>
                {showPhotoOptions && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[100]"
                  >
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      <Camera size={14} className="text-brand-blue" />
                      Upload Photo
                    </button>
                    <button 
                      onClick={handleUseDefaultAvatar}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      <UserIcon size={14} className="text-slate-400" />
                      Default Avatar
                    </button>
                    <div className="h-px bg-slate-100 my-1 mx-2" />
                    <button 
                      onClick={() => setShowPhotoOptions(false)}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-400 flex items-center gap-2"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
           </div>
           <div className="flex-1">
              {isEditing ? (
                 <input 
                   className="text-lg font-black w-full bg-slate-50 border-none rounded-xl px-3 py-2 outline-none ring-2 ring-slate-100 focus:ring-brand-blue transition-all"
                   value={profileData.name}
                   onChange={e => setProfileData({...profileData, name: e.target.value})}
                 />
              ) : (
                 <h2 className="text-2xl font-black tracking-tight">{profileData.name}</h2>
              )}
              <div className="flex items-center gap-2 mt-1">
                 <span className="bg-blue-50 text-brand-blue text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-blue-100 transition-colors">
                    {role} account
                 </span>
                 <span className="text-slate-300 text-[10px] font-bold uppercase">ID: {userId.slice(0, 8)}</span>
              </div>
           </div>
        </div>
      </div>

      <div className="px-6 space-y-8 pt-2">
        {/* Drive Smarter: Educational Tips */}
        <section className="space-y-4">
           <div className="flex items-center gap-2 px-1">
              <BookOpen size={18} className="text-brand-blue" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Drive Smarter</h3>
           </div>
           <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {drivingTips.map((tip, i) => (
                <div key={i} className="min-w-[280px] bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-40">
                   <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Car size={80} />
                   </div>
                   <h4 className="font-bold text-slate-800 mb-2">{tip.title}</h4>
                   <p className="text-xs text-slate-500 leading-relaxed font-medium">{tip.content}</p>
                   <div className="mt-4 flex items-center gap-1 text-brand-blue font-bold text-[10px] uppercase tracking-widest">
                      <span>Learn more</span>
                      <ChevronRight size={12} />
                   </div>
                </div>
              ))}
           </div>
        </section>

        {/* Scheduled Diagnostics */}
        {role === 'owner' && (
          <section className="space-y-4">
             <div className="flex items-center gap-2 px-1">
                <Calendar size={18} className="text-brand-blue" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Upcoming Care</h3>
             </div>
             <div className="space-y-3">
                {diagnostics.length === 0 ? (
                  <div className="bg-white p-8 rounded-[32px] text-center border border-dashed border-slate-200 opacity-60">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">No scheduled visits</p>
                  </div>
                ) : (
                  diagnostics.map((diag) => (
                    <div key={diag.id} className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex items-center gap-4">
                       <div className="bg-blue-50 p-3 rounded-2xl text-brand-blue">
                          <CheckCircle2 size={24} />
                       </div>
                       <div className="flex-1">
                          <h4 className="font-bold text-sm text-slate-800">{diag.serviceType}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">With {diag.mechanicName}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-black text-slate-800">{diag.date}</p>
                          <p className="text-[9px] font-bold text-brand-blue uppercase">{diag.time}</p>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </section>
        )}

        {/* Personal Details Section */}
        <section className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm space-y-6">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Configuration</h3>
           
           <div className="space-y-5">
              <div className="flex items-center gap-4 group">
                 <div className="bg-slate-50 p-4 rounded-3xl text-slate-400 group-hover:bg-blue-50 group-hover:text-brand-blue transition-colors">
                    <Mail size={18} />
                 </div>
                 <div className="flex-1 border-b border-slate-50 pb-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Contact Sync</p>
                    <p className="text-sm font-black text-slate-800">{profileData.email}</p>
                 </div>
              </div>

              <div className="flex items-center gap-4 group">
                 <div className="bg-slate-50 p-4 rounded-3xl text-slate-400 group-hover:bg-blue-50 group-hover:text-brand-blue transition-colors">
                    <Phone size={18} />
                 </div>
                 <div className="flex-1 border-b border-slate-50 pb-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Mobile Access</p>
                    {isEditing ? (
                       <input 
                         className="text-sm font-black text-slate-800 w-full bg-slate-50 rounded-xl px-3 py-2 outline-none ring-2 ring-slate-100 focus:ring-brand-blue transition-all"
                         value={profileData.phone}
                         onChange={e => setProfileData({...profileData, phone: e.target.value})}
                       />
                    ) : (
                       <p className="text-sm font-black text-slate-800">{profileData.phone || 'Enter phone number'}</p>
                    )}
                 </div>
              </div>

              {(role === 'owner' || role === 'mechanic') && (
                 <div className="flex items-center gap-4 group">
                    <div className="bg-slate-50 p-4 rounded-3xl text-slate-400 group-hover:bg-blue-50 group-hover:text-brand-blue transition-colors">
                       {role === 'owner' ? <Car size={18} /> : <Building2 size={18} />}
                    </div>
                    <div className="flex-1 border-b border-slate-50 pb-4">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                         {role === 'owner' ? 'Registered Vehicle' : 'Garage Identity'}
                       </p>
                       {isEditing ? (
                          <div className="space-y-4">
                            <input 
                              placeholder={role === 'owner' ? "Make & Model" : "Garage Name & Detail"}
                              className="text-sm font-black text-slate-800 w-full bg-slate-50 rounded-xl px-3 py-2 outline-none ring-2 ring-slate-100 focus:ring-brand-blue transition-all"
                              value={role === 'owner' ? (profileData.carInfo || '') : (profileData.garageInfo || '')}
                              onChange={e => setProfileData({
                                ...profileData, 
                                [role === 'owner' ? 'carInfo' : 'garageInfo']: e.target.value
                              })}
                            />
                             <div className="flex items-center gap-4">
                               <div className="relative group flex-shrink-0">
                                  <img 
                                    src={profileData?.vehiclePhotoURL || `https://picsum.photos/seed/${userId}_car/300/200`} 
                                    className="w-32 h-20 bg-slate-50 rounded-2xl object-cover border-2 border-slate-100 shadow-inner"
                                    alt="Vehicle"
                                    referrerPolicy="no-referrer"
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const input = document.createElement('input');
                                      input.type = 'file';
                                      input.accept = 'image/*';
                                      input.onchange = (ev: any) => handleVehiclePhotoUpload(ev);
                                      input.click();
                                    }}
                                    className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                   >
                                     <Camera size={20} className="text-white" />
                                  </button>
                               </div>
                               <div className="flex-1 flex flex-col gap-1">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{role === 'owner' ? 'Update Photo' : 'Shop View'}</p>
                                  <p className="text-[9px] text-slate-300 leading-tight">A clear photo helps identify your {role === 'owner' ? 'car' : 'garage'}.</p>
                               </div>
                            </div>
                          </div>
                       ) : (
                          <p className="text-sm font-black text-slate-800">{profileData.carInfo || profileData.garageInfo || 'No details'}</p>
                       )}
                    </div>
                 </div>
              )}
           </div>
        </section>

        {/* Mechanic Shop Items */}
        {role === 'mechanic' && (
          <section className="space-y-4">
             <div className="flex items-center gap-2 px-1">
                <Package size={18} className="text-brand-blue" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">My Marketplace Items</h3>
             </div>
             <div className="grid grid-cols-2 gap-4">
                {shopItems.length === 0 ? (
                  <div className="col-span-2 bg-white p-12 rounded-[40px] text-center border border-dashed border-slate-200 opacity-60">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No active listings</p>
                  </div>
                ) : (
                  shopItems.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm space-y-3">
                       <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden shadow-inner">
                          <img 
                            src={item.image || `https://picsum.photos/seed/${item.name}/300/300`} 
                            className="w-full h-full object-cover" 
                            alt={item.name} 
                            referrerPolicy="no-referrer"
                          />
                       </div>
                       <div>
                          <h4 className="font-bold text-slate-800 text-xs truncate leading-tight">{item.name}</h4>
                          <p className="text-brand-blue font-black text-xs mt-1">${item.price}</p>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </section>
        )}
        <section className="space-y-3">
           {role === 'mechanic' && setActiveTab && (
              <button 
                onClick={() => setActiveTab('home')}
                className="w-full bg-blue-600 text-white p-6 rounded-[32px] flex items-center justify-between group active:scale-95 transition-all shadow-xl shadow-blue-500/20"
              >
                 <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-2xl">
                       <Wrench size={20} />
                    </div>
                    <span className="font-bold">Manage My Services</span>
                 </div>
                 <ChevronRight size={18} className="text-white/40" />
              </button>
           )}
           <button 
             onClick={onLogout}
             className="w-full bg-white border border-slate-100 p-6 rounded-[32px] flex items-center justify-between group active:scale-95 transition-all shadow-sm"
           >
              <div className="flex items-center gap-4">
                 <div className="bg-slate-50 p-3 rounded-2xl text-slate-400 group-hover:bg-brand-blue group-hover:text-white transition-colors">
                    <LogOut size={20} />
                 </div>
                 <span className="font-bold text-slate-800">Secure Sign Out</span>
              </div>
              <ChevronRight size={18} className="text-slate-200" />
           </button>

           <button 
             onClick={() => setShowDeleteModal(true)}
             className="w-full bg-red-50 p-6 rounded-[32px] flex items-center justify-between group active:scale-95 transition-all"
           >
              <div className="flex items-center gap-4">
                 <div className="bg-red-500 p-3 rounded-2xl text-white shadow-lg shadow-red-500/20">
                    <Trash2 size={20} />
                 </div>
                 <span className="font-bold text-red-600">Delete Account</span>
              </div>
              <ChevronRight size={18} className="text-red-300" />
           </button>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowDeleteModal(false)}
               className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative bg-white w-full max-w-sm rounded-[48px] p-8 shadow-2xl overflow-hidden"
             >
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                
                <div className="relative z-10 text-center space-y-6">
                   <div className="bg-red-100 w-20 h-20 rounded-[32px] flex items-center justify-center mx-auto text-red-600">
                      <AlertCircle size={40} />
                   </div>
                   
                   <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-900 leading-tight">Are you absolutely sure?</h3>
                      <p className="text-sm text-slate-500 leading-relaxed px-2">
                         This action will permanently delete your profile, vehicles, and order history from our servers.
                      </p>
                   </div>

                   <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleDeleteAccount}
                        disabled={isDeleting}
                        className="w-full bg-red-600 text-white py-5 rounded-3xl font-bold active:scale-95 transition-all shadow-xl shadow-red-600/20 flex items-center justify-center gap-2"
                      >
                         {isDeleting ? <Loader2 className="animate-spin" size={20} /> : 'Yes, Delete Account'}
                      </button>
                      <button 
                        onClick={() => setShowDeleteModal(false)}
                        className="w-full bg-slate-50 text-slate-400 py-5 rounded-3xl font-bold active:scale-95 transition-all"
                      >
                         Keep My Account
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
