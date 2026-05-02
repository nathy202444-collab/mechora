import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Wrench, 
  Bell, 
  ShoppingBag, 
  Database, 
  MessageSquare, 
  PieChart, 
  Activity,
  Shield, 
  Loader2, 
  Sparkles,
  ListTodo,
  Settings2,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  Trash2,
  Camera,
  LayoutDashboard,
  Megaphone,
  UserCheck,
  UserX,
  Plus,
  Send
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  deleteDoc,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

import ShopSellerTools from './ShopSellerTools.tsx';

type AdminTab = 'overview' | 'users' | 'bookings' | 'sos' | 'shop' | 'messages' | 'settings';

export default function AdminDashboard({ userId, activeTab: initialTab }: { userId: string, activeTab?: string }) {
  const [activeTab, setActiveTab] = useState<AdminTab>((initialTab as AdminTab) || 'overview');
  const [loading, setLoading] = useState(true);

  // Sync internal tab if initialTab changes
  useEffect(() => {
    if (initialTab && ['overview', 'users', 'bookings', 'sos', 'shop', 'messages', 'settings'].includes(initialTab)) {
      setActiveTab(initialTab as AdminTab);
    }
  }, [initialTab]);
  
  // Data State
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [sosAlerts, setSosAlerts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newMessageImage, setNewMessageImage] = useState<string | null>(null);
  const [isUploadingMessageImage, setIsUploadingMessageImage] = useState(false);
  const messageImageInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedBookingFilter, setSelectedBookingFilter] = useState<'pending' | 'accepted' | 'completed'>('pending');
  const [showSellerTools, setShowSellerTools] = useState(false);

  const handleBookingStatus = async (bid: string, status: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bid), {
        status,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Booking update error:", err);
    }
  };

  const handleSOSAction = async (sid: string, action: string) => {
    try {
      await updateDoc(doc(db, 'sos_alerts', sid), {
        status: action === 'resolve' ? 'resolved' : 'cancelled',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("SOS action error:", err);
    }
  };
  
  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingUsers: 0,
    activeSOS: 0,
    pendingProducts: 0,
    revenue: 0
  });

  useEffect(() => {
    // Listen to Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userData);
      setStats(prev => ({
        ...prev,
        totalUsers: userData.length,
        pendingUsers: userData.filter((u: any) => u.status === 'pending').length
      }));
    });

    // Listen to Bookings
    const unsubBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to SOS
    const unsubSOS = onSnapshot(collection(db, 'sos_alerts'), (snapshot) => {
      const sosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSosAlerts(sosData);
      setStats(prev => ({
        ...prev,
        activeSOS: sosData.filter((s: any) => s.status === 'active').length
      }));
    });

    // Listen to Products
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prodData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prodData);
      setStats(prev => ({
        ...prev,
        pendingProducts: prodData.filter((p: any) => !p.isApproved).length
      }));
    });

    // Listen to Messages
    const unsubMessages = onSnapshot(query(collection(db, 'daily_messages'), orderBy('createdAt', 'desc')), (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    setLoading(false);

    return () => {
      unsubUsers();
      unsubBookings();
      unsubSOS();
      unsubProducts();
      unsubMessages();
    };
  }, []);

  const handleUserApproval = async (uid: string, approve: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        isApproved: approve,
        status: approve ? 'active' : 'suspended',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("User approval error:", err);
    }
  };

  const handleProductApproval = async (pid: string, approve: boolean) => {
    try {
      await updateDoc(doc(db, 'products', pid), {
        isApproved: approve,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Product approval error:", err);
    }
  };

  const publishMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await addDoc(collection(db, 'daily_messages'), {
        content: newMessage.trim(),
        imageURL: newMessageImage,
        authorId: userId,
        createdAt: serverTimestamp()
      });
      setNewMessage('');
      setNewMessageImage(null);
    } catch (err) {
      console.error("Publish error:", err);
    }
  };

  const handleMessageImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Large file. 5MB limit.");
      return;
    }

    setIsUploadingMessageImage(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      setNewMessageImage(result.imageUrl);
    } catch (err) {
      console.error("Message image upload error:", err);
      alert("Upload failed.");
    } finally {
      setIsUploadingMessageImage(false);
    }
  };

  const deleteMessage = async (mid: string) => {
    try {
      await deleteDoc(doc(db, 'daily_messages', mid));
    } catch (err) {
      console.error("Delete message error:", err);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <Loader2 size={40} className="animate-spin text-brand-blue" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans">
      {/* Admin Header */}
      <div className="bg-slate-900 p-8 pt-12 text-white rounded-b-[48px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-blue/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-8">
            <div>
               <div className="flex items-center gap-2 text-brand-blue text-xs font-black uppercase tracking-widest mb-1">
                  <Shield size={14} />
                  Root Authority
               </div>
               <h1 className="text-3xl font-black">Admin Command</h1>
            </div>
            <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md flex items-center gap-3">
               <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Active Session</p>
                  <p className="font-bold text-sm">System Admin</p>
               </div>
               <div className="w-10 h-10 bg-brand-blue rounded-2xl flex items-center justify-center font-black">A</div>
            </div>
          </div>

            {/* Quick Stats Tab Scroller */}
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
               <StatCard active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Overview" value={stats.totalUsers} icon={<LayoutDashboard size={20} />} />
               <StatCard active={activeTab === 'users'} onClick={() => setActiveTab('users')} label="All Users" value={users.length} color="bg-orange-500" icon={<UserCheck size={20} />} />
               <StatCard active={activeTab === 'bookings'} onClick={() => setActiveTab('bookings')} label="Bookings" value={bookings.length} color="bg-blue-500" icon={<ListTodo size={20} />} />
               <StatCard active={activeTab === 'sos'} onClick={() => setActiveTab('sos')} label="Emergency" value={stats.activeSOS} color="bg-red-500" icon={<Bell size={20} />} />
               <StatCard active={activeTab === 'shop'} onClick={() => setActiveTab('shop')} label="Catalog" value={products.length} color="bg-green-500" icon={<ShoppingBag size={20} />} />
               <StatCard active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} label="History" value={messages.length} color="bg-purple-500" icon={<Megaphone size={20} />} />
               <StatCard active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} label="Settings" value={0} color="bg-slate-400" icon={<Settings2 size={20} />} />
            </div>
        </div>
      </div>

      <div className="px-6 mt-8">
         <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                 {/* Roles & Approval Section */}
                 <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                    <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                       <Users className="text-brand-blue" />
                       Community Overview
                    </h3>
                    <div className="space-y-4">
                       {users.slice(0, 5).map((user: any) => (
                         <div key={user.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-3xl">
                            <img src={user.photoURL || `https://picsum.photos/seed/${user.id}/100/100`} className="w-12 h-12 rounded-2xl object-cover" alt="" referrerPolicy="no-referrer" />
                            <div className="flex-1">
                               <h4 className="font-bold text-slate-800">{user.name}</h4>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{user.role} • {user.status}</p>
                            </div>
                            <div className="flex gap-2">
                               <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                  {user.status}
                               </span>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>

                 {/* System Messages */}
                 <div className="bg-brand-blue p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                    <div className="relative z-10 space-y-4">
                       <h3 className="text-lg font-black flex items-center gap-2">
                          <Megaphone />
                          Daily Broadcast
                       </h3>
                       <div className="flex flex-col gap-4">
                          <div className="flex gap-2">
                             <input 
                               value={newMessage}
                               onChange={e => setNewMessage(e.target.value)}
                               placeholder="Type a community message..."
                               className="flex-1 bg-white/10 border-none rounded-2xl px-5 py-3 text-sm placeholder:text-white/40 outline-none ring-2 ring-transparent focus:ring-white/20 transition-all font-medium"
                             />
                             <button 
                                onClick={() => messageImageInputRef.current?.click()}
                                className="bg-white/10 p-3 rounded-2xl hover:bg-white/20 transition-colors"
                             >
                                {isUploadingMessageImage ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                             </button>
                             <input 
                                type="file"
                                ref={messageImageInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleMessageImageUpload}
                             />
                             <button onClick={publishMessage} className="bg-white text-brand-blue p-3 rounded-2xl shadow-xl active:scale-95 transition-transform">
                                <Send size={20} />
                             </button>
                          </div>
                          
                          {newMessageImage && (
                             <div className="relative group w-32 h-20 rounded-2xl overflow-hidden shadow-lg border border-white/20">
                                <img src={newMessageImage} className="w-full h-full object-cover" alt="Broadcast" />
                                <button 
                                   onClick={() => setNewMessageImage(null)}
                                   className="absolute top-1 right-1 bg-red-500 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                   <Trash2 size={12} />
                                </button>
                             </div>
                          )}
                       </div>
                    </div>
                 </div>
              </motion.div>
            )}

             {activeTab === 'bookings' && (
                <motion.div key="bookings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                        {(['accepted', 'completed'] as const).map(filter => (
                            <button 
                                key={filter}
                                onClick={() => setSelectedBookingFilter(filter)}
                                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedBookingFilter === filter ? 'bg-white text-brand-blue shadow-sm' : 'text-slate-400'}`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                    <div className="space-y-4">
                        {bookings.filter(b => b.status === selectedBookingFilter).map((booking: any) => (
                            <div key={booking.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-50 p-3 rounded-2xl text-brand-blue">
                                            <Wrench size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900">{booking.serviceType}</h4>
                                            <p className="text-xs text-slate-400">Scheduled for {booking.date}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                                        <p className={`text-xs font-bold ${booking.status === 'pending' ? 'text-orange-500' : 'text-green-500'}`}>{booking.status}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {booking.status === 'accepted' && (
                                        <button onClick={() => handleBookingStatus(booking.id, 'completed')} className="w-full bg-green-500 text-white py-3 rounded-2xl font-bold text-xs uppercase active:scale-95 transition-all">Mark Completed</button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {bookings.filter(b => b.status === selectedBookingFilter).length === 0 && (
                            <div className="text-center py-20 text-slate-300">
                                <Clock size={48} className="mx-auto mb-4 opacity-10" />
                                <p className="font-bold uppercase text-xs tracking-widest">No matching requests</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {activeTab === 'sos' && (
                <motion.div key="sos" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    {/* SOS Map Abstract */}
                    <div className="bg-slate-900 aspect-video rounded-[40px] relative overflow-hidden shadow-2xl">
                        <img 
                            src="https://picsum.photos/seed/nairobi-map/800/450?grayscale" 
                            className="absolute inset-0 w-full h-full object-cover opacity-20 contrast-125" 
                            alt="Surveillance Map"
                             referrerPolicy="no-referrer"
                        />
                        {sosAlerts.filter(s => s.status === 'active').map((alert: any) => (
                            <div 
                                key={alert.id}
                                style={{ 
                                    left: `${40 + (Math.random() * 20)}%`, 
                                    top: `${40 + (Math.random() * 20)}%` 
                                }}
                                className="absolute"
                            >
                                <div className="relative">
                                    <div className="absolute -inset-4 bg-red-500 rounded-full animate-ping opacity-30"></div>
                                    <div className="bg-red-600 p-2 rounded-full relative z-10">
                                        <AlertTriangle size={14} className="text-white" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="absolute bottom-6 left-6 right-6 bg-black/60 backdrop-blur-md p-4 rounded-3xl border border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <p className="text-white text-xs font-bold uppercase tracking-widest">Live Monitoring Active</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {sosAlerts.map((alert: any) => (
                            <div key={alert.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`p-4 rounded-2xl ${alert.status === 'active' ? 'bg-red-50 text-red-500 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
                                        <AlertTriangle size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800">{alert.type === 'repair' ? 'Mechanical Failure' : 'Towing Needed'}</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">User: {alert.userId.slice(-6)}</p>
                                    </div>
                                </div>
                                {alert.status === 'active' && (
                                    <button onClick={() => handleSOSAction(alert.id, 'resolve')} className="bg-green-50 text-green-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Resolve</button>
                                )}
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
            {activeTab === 'users' && (
              <motion.div key="users" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                 <div className="flex gap-2 mb-4">
                    <button className="flex-1 py-3 bg-brand-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-blue/20">All Active</button>
                    <button className="flex-1 py-3 bg-white text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-100">Suspended</button>
                 </div>
                 <div className="space-y-4">
                    {users.map((user: any) => (
                      <div key={user.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between">
                         <div className="flex items-center gap-4">
                            <img src={user.photoURL} className="w-14 h-14 rounded-[22px] object-cover" alt="" referrerPolicy="no-referrer" />
                            <div>
                               <h4 className="font-bold text-slate-900">{user.name}</h4>
                               <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${user.role === 'mechanic' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {user.role}
                                  </span>
                                  {user.isApproved && <CheckCircle2 size={10} className="text-green-500" />}
                               </div>
                            </div>
                         </div>
                         <button className="bg-slate-50 p-3 rounded-2xl text-slate-400 hover:text-red-500 transition-colors">
                            <Activity size={18} />
                         </button>
                      </div>
                    ))}
                 </div>
              </motion.div>
            )}

            {activeTab === 'shop' && (
              <motion.div key="shop" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                 <div className="flex justify-between items-center px-2">
                    <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs">Review Products</h3>
                    <button 
                      onClick={() => setShowSellerTools(true)}
                      className="bg-brand-blue text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-brand-blue/20 active:scale-95 transition-all"
                    >
                      <Plus size={16} /> Add Product
                    </button>
                 </div>
                  <div className="grid grid-cols-2 gap-4">
                    {products.slice(0, 10).map((prod: any) => (
                      <div key={prod.id} className="bg-white p-4 rounded-[40px] border border-slate-100 shadow-sm flex flex-col gap-4">
                         <img src={prod.image} className="w-full aspect-square rounded-[32px] object-cover" alt="" referrerPolicy="no-referrer" />
                         <div className="px-2">
                            <h4 className="font-bold text-slate-900 truncate">{prod.name}</h4>
                            <p className="text-brand-blue font-black text-lg">${prod.price}</p>
                         </div>
                      </div>
                    ))}
                 </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
               <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex items-center gap-6">
                     <div className="w-24 h-24 bg-brand-blue rounded-[32px] flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-brand-blue/20">A</div>
                     <div>
                        <h3 className="text-2xl font-black text-slate-900">System Admin</h3>
                        <p className="text-slate-400 font-medium">nathy20244@gmail.com</p>
                        <div className="flex gap-2 mt-4">
                           <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Root Access</span>
                           <span className="bg-green-100 text-green-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Verified</span>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Users</p>
                        <p className="text-2xl font-black text-slate-900">{users.length}</p>
                     </div>
                     <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Approved</p>
                        <p className="text-2xl font-black text-slate-900">{users.filter(u => u.isApproved).length}</p>
                     </div>
                     <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Mechanics</p>
                        <p className="text-2xl font-black text-slate-900">{users.filter(u => u.role === 'mechanic').length}</p>
                     </div>
                     <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Bookings</p>
                        <p className="text-2xl font-black text-slate-900">{bookings.filter(b => b.status === 'accepted').length}</p>
                     </div>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 space-y-4">
                     <h3 className="font-bold text-slate-900">System Preferences</h3>
                     <div className="space-y-2">
                        <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                           <span className="text-sm font-bold text-slate-700">Maintenance Mode</span>
                           <div className="w-10 h-5 bg-slate-200 rounded-full relative">
                              <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                           </div>
                        </label>
                        <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                           <span className="text-sm font-bold text-slate-700">Audit Logging</span>
                           <div className="w-10 h-5 bg-green-500 rounded-full relative">
                              <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                           </div>
                        </label>
                     </div>
                  </div>
               </motion.div>
            )}
            {activeTab === 'messages' && (
               <motion.div key="messages" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                     <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs">Broadcast History</h3>
                  </div>
                  {messages.map((msg: any) => (
                    <div key={msg.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-4">
                       <div className="flex items-start gap-4">
                          <div className="bg-brand-blue/10 p-4 rounded-[22px] text-brand-blue">
                             <Megaphone size={24} />
                          </div>
                          <div className="flex-1">
                             <p className="text-slate-900 font-bold leading-relaxed">{msg.content}</p>
                          </div>
                       </div>
                       
                       {msg.imageURL && (
                          <div className="w-full h-48 rounded-[32px] overflow-hidden border border-slate-100">
                             <img src={msg.imageURL} className="w-full h-full object-cover" alt="Broadcast" referrerPolicy="no-referrer" />
                          </div>
                       )}

                       <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                             {msg.createdAt?.toDate().toLocaleDateString()}
                          </span>
                          <button onClick={() => deleteMessage(msg.id)} className="text-red-400 p-2 hover:bg-red-50 rounded-xl transition-colors">
                             <Trash2 size={16} />
                          </button>
                       </div>
                    </div>
                  ))}
               </motion.div>
            )}
         </AnimatePresence>
      </div>
      
      {/* Bottom Spacer for Nav */}
      <div className="h-12"></div>
      
      <AnimatePresence>
        {showSellerTools && (
          <ShopSellerTools userId={userId} onClose={() => setShowSellerTools(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ active, onClick, label, value, color = "bg-brand-blue", icon }: { active: boolean, onClick: () => void, label: string, value: number, color?: string, icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={`min-w-[140px] p-6 rounded-[40px] flex flex-col gap-4 transition-all duration-300 ${active ? 'bg-white shadow-2xl scale-105' : 'bg-white/10 opacity-60'}`}
    >
       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${color}`}>
          {icon}
       </div>
       <div>
          <p className={`text-2xl font-black ${active ? 'text-slate-900' : 'text-white'}`}>{value}</p>
          <p className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-slate-400' : 'text-white/40'}`}>{label}</p>
       </div>
    </button>
  );
}
