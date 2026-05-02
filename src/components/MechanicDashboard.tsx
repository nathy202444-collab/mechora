import * as React from 'react';
import { useState } from 'react';
import { Clock, CheckCircle2, Box, Wrench, Zap, Search, AlertCircle, Droplets, Car, Shield, Package, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { auth, db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import ShopSellerTools from './ShopSellerTools';

interface MechanicDashboardProps {
  userId: string;
  activeTab?: string;
}

export default function MechanicDashboard({ userId, activeTab = 'home' }: MechanicDashboardProps) {
  const [profile, setProfile] = useState<any>(null);
  const [activeServices, setActiveServices] = useState<string[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [pastWorks, setPastWorks] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [loadingServices, setLoadingServices] = useState(false);
  const [showSellerTools, setShowSellerTools] = useState(false);

  React.useEffect(() => {
    // 1. Fetch Profile and Offered Services
    const fetchProfile = async () => {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setProfile(data);
        setActiveServices(data.offeredServices || []);
      }
    };

    // 2. Listen for current bookings (Active Requests)
    const bookingsQuery = query(
      collection(db, "bookings"),
      where("mechanicId", "==", userId),
      where("status", "in", ["pending", "accepted"]),
      orderBy("createdAt", "desc")
    );

    const unsubscribeBookings = onSnapshot(bookingsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
    });

    // 3. Past performed works (Completed)
    const pastWorksQuery = query(
      collection(db, "bookings"),
      where("mechanicId", "==", userId),
      where("status", "==", "completed"),
      orderBy("createdAt", "desc")
    );

    const unsubscribePast = onSnapshot(pastWorksQuery, (snapshot) => {
       setPastWorks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 4. Shop Sales Summary
    const salesQuery = query(
      collection(db, "orders"),
      where("sellerIds", "array-contains", userId),
      orderBy("createdAt", "desc")
    );
    // Note: In a real app we'd filter per item since orders can have multiple mechanics.
    // For this demo, let's just listen for all orders and sum those that contain this mechanic's items.
    const unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
       let total = 0;
       snapshot.docs.forEach(d => {
         const order = d.data();
         order.items?.forEach((item: any) => {
           // We'll need products to have mechanicId to filter here properly if not in order item
           // Assuming order item has mechanicId for calculation
           if (item.mechanicId === userId) {
             total += (item.price * item.qty);
           }
         });
       });
       setSalesTotal(total);
    });

    // 5. Notifications
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("recipientId", "==", userId),
      where("read", "==", false),
      orderBy("createdAt", "desc")
    );

    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    fetchProfile();
    return () => {
      unsubscribeBookings();
      unsubscribePast();
      unsubscribeSales();
      unsubscribeNotifications();
    };
  }, [userId]);

  const saveServices = async () => {
    setLoadingServices(true);
    try {
      const updateData: any = {
        offeredServices: activeServices,
        updatedAt: serverTimestamp()
      };
      
      // Also update location if we can
      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          updateData.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (e) {
          console.warn("Could not auto-update location on save.");
        }
      }

      await updateDoc(doc(db, 'users', userId), updateData);
      alert("Profile updated successfully!");
    } catch (err) {
      console.error("Save Services Error:", err);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleAction = async (bookingId: string, status: 'accepted' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Update Error:", err);
    }
  };

  const handleSOSRespond = async (notif: any) => {
    try {
      await updateDoc(doc(db, 'sos_alerts', notif.relatedId), {
        assignedMechanicId: userId,
        updatedAt: serverTimestamp()
      });
      await markRead(notif.id);
      alert("Emergency accepted! Location details shared.");
    } catch (err) {
      console.error("SOS Respond Error:", err);
      alert("Could not respond to SOS. It might have been taken by another mechanic.");
    }
  };

  const markRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const stats = [
    { label: 'Rating', value: (profile?.rating || 4.9).toString(), icon: <Shield className="text-brand-blue" /> },
    { label: 'Earning', value: `$${salesTotal.toFixed(0)}`, icon: <Package className="text-blue-500" /> },
    { label: 'Jobs', value: pastWorks.length.toString(), icon: <CheckCircle2 className="text-green-500" /> },
  ];

  const recentActivity = [...requests, ...pastWorks]
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 5);

  const servicesList = [
    { id: 'Routine Maintenance', name: 'Routine Maintenance', icon: <Wrench size={20} /> },
    { id: 'Car Repair', name: 'Car Repair', icon: <Box size={20} /> },
    { id: 'Electrical Repair', name: 'Electrical Repair', icon: <Zap size={20} /> },
    { id: 'Tire & Wheel', name: 'Tire & Wheel', icon: <Shield size={20} /> },
    { id: 'Car Diagnostics', name: 'Car Diagnostics', icon: <Search size={20} /> },
    { id: 'Body & Accessories', name: 'Body & Accessories', icon: <Car size={20} /> },
    { id: 'Emergency Service', name: 'Emergency Service', icon: <AlertCircle size={20} /> },
    { id: 'Car Wash', name: 'Car Wash', icon: <Droplets size={20} /> },
  ];

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="bg-brand-blue p-8 pt-12 text-white rounded-b-[40px] pb-16 relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="flex justify-between items-center mb-8 relative z-10">
          <div>
            <p className="text-white/60 text-sm font-medium">Welcome back,</p>
            <h1 className="text-3xl font-bold flex items-center gap-2">Fundi {profile?.name?.split(' ')[0] || 'Me'} <Wrench size={28} className="rotate-90" /></h1>
          </div>
          <img 
            src={profile?.photoURL || "https://picsum.photos/seed/fundi/100/100"} 
            className="w-14 h-14 rounded-[20px] object-cover border-4 border-white/10 shadow-lg" 
            referrerPolicy="no-referrer"
            alt="Avatar"
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 relative z-10">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 text-slate-900 shadow-xl border border-slate-50">
              <div className="bg-slate-50 w-10 h-10 rounded-xl flex items-center justify-center mb-2">
                {stat.icon}
              </div>
              <p className="text-xl font-black tracking-tight">{stat.value}</p>
              <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-6 space-y-8 mt-12">
        {activeTab === 'home' && (
          <>
            {/* Real-time Notifications Toast */}
            <AnimatePresence>
              {notifications.map((notif) => (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-slate-900 text-white p-4 rounded-3xl shadow-xl flex items-center justify-between gap-4 border border-white/10 mb-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-red-500 p-2 rounded-xl">
                      <Zap size={20} className="text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">{notif.title}</h4>
                      <p className="text-[10px] text-white/50">{notif.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {notif.type === 'sos_nearby' && (
                      <button 
                        onClick={() => handleSOSRespond(notif)}
                        className="bg-red-600 text-white text-[10px] font-bold px-4 py-2 rounded-xl active:scale-95 transition-all shadow-lg shadow-red-600/20"
                      >
                        Respond
                      </button>
                    )}
                    <button onClick={() => markRead(notif.id)} className="bg-white/10 text-[10px] font-bold px-4 py-2 rounded-xl">Dismiss</button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setShowSellerTools(true)}
                className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-start gap-3 hover:border-brand-blue transition-all active:scale-95 text-left group"
              >
                  <div className="bg-blue-50 p-3 rounded-2xl text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors">
                    <Package size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 tracking-tight">Marketplace</h3>
                    <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Manage Parts</p>
                  </div>
              </button>
              <button className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-start gap-3 hover:border-brand-blue transition-all active:scale-95 text-left group">
                  <div className="bg-slate-50 p-3 rounded-2xl text-slate-400 group-hover:bg-brand-blue group-hover:text-white transition-colors">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 tracking-tight">Security</h3>
                    <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Garage Lock</p>
                  </div>
              </button>
            </div>

            {/* Recent Activity Feed */}
            <section className="space-y-4">
              <div className="flex justify-between items-end px-2">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900">Recent Activity</h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Latest service logs</p>
                </div>
              </div>
              
              <div className="bg-white rounded-[40px] border border-slate-100 divide-y divide-slate-50 overflow-hidden shadow-sm">
                {recentActivity.length > 0 ? (
                  recentActivity.map((item) => (
                    <div key={item.id} className="p-5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                      <div className={`p-3 rounded-2xl ${
                        item.status === 'completed' ? 'bg-green-50 text-green-600' :
                        item.status === 'pending' ? 'bg-yellow-50 text-yellow-600' :
                        'bg-blue-50 text-brand-blue'
                      }`}>
                        {item.status === 'completed' ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-900 text-sm truncate">{item.serviceType}</h4>
                          <span className="text-[10px] font-black text-slate-300 uppercase">{item.date}</span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium truncate">{item.carModel}</p>
                      </div>
                      <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase border ${
                        item.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' :
                        item.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                        'bg-blue-50 text-brand-blue border-blue-100'
                      }`}>
                        {item.status}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-slate-300">
                    <ClipboardList size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest">No recent logs</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === 'services' && (
          <>
            {/* Service Requests */}
            <section>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">Incoming Requests</h2>
                  <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">
                    {requests.filter(r => r.status === 'pending').length} Action Required
                  </p>
                </div>
                <div className="bg-blue-50 p-3 rounded-2xl text-brand-blue">
                  <ClipboardList size={24} />
                </div>
              </div>
              
              <div className="space-y-4">
                {requests.map((req) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={req.id} 
                    className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="bg-slate-50 p-3 rounded-2xl text-brand-blue">
                          <Car size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-lg">{req.serviceType}</h4>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{req.carModel}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase border ${
                        req.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                        req.status === 'accepted' ? 'bg-green-50 text-green-600 border-green-100' :
                        'bg-slate-50 text-slate-600 border-slate-100'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-2xl flex items-center gap-2">
                        <Clock size={16} className="text-slate-400" />
                        <span className="text-[11px] font-bold text-slate-600">{req.date} at {req.time}</span>
                      </div>
                      {req.notes && (
                        <div className="bg-blue-50/50 p-3 rounded-2xl flex items-center gap-2">
                          <AlertCircle size={16} className="text-brand-blue" />
                          <span className="text-[11px] font-bold text-brand-blue truncate">Has Notes</span>
                        </div>
                      )}
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={() => handleAction(req.id, 'accepted')}
                          className="flex-1 bg-brand-blue text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-brand-blue/20 active:scale-95 transition-all"
                        >
                          Accept Task
                        </button>
                        <button 
                          onClick={() => handleAction(req.id, 'rejected')}
                          className="flex-1 bg-slate-50 text-slate-400 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest border border-slate-100 active:scale-95 transition-all"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </motion.div>
                ))}
                
                {requests.length === 0 && (
                  <div className="bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[32px] p-12 text-center text-slate-300">
                    <Zap size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm font-bold">No active requests</p>
                  </div>
                )}
              </div>
            </section>

            {/* Services I Offer */}
            <section className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-xl font-black tracking-tight">Expertise Profile</h2>
                  <p className="text-slate-400 text-xs font-medium">Toggle services you provide</p>
                </div>
                <button 
                  onClick={saveServices}
                  disabled={loadingServices}
                  className="bg-brand-blue text-white px-6 py-2 rounded-2xl text-sm font-bold shadow-lg shadow-brand-blue/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {loadingServices ? '...' : 'Update'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {servicesList.map((service) => {
                  const isActive = activeServices.includes(service.name);
                  return (
                    <button
                      key={service.id}
                      onClick={() => {
                        if (isActive) setActiveServices(activeServices.filter(s => s !== service.name));
                        else setActiveServices([...activeServices, service.name]);
                      }}
                      className={`flex items-center gap-3 p-4 rounded-3xl border transition-all text-left group
                        ${isActive 
                          ? 'bg-blue-50 border-brand-blue text-brand-blue shadow-md shadow-brand-blue/5' 
                          : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200'}
                      `}
                    >
                      <div className={`transition-colors ${isActive ? 'text-brand-blue' : 'text-slate-300 group-hover:text-slate-400'}`}>
                        {service.icon}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none flex-1">{service.name}</span>
                      {isActive && <CheckCircle2 size={16} className="text-brand-blue" />}
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>

      <AnimatePresence>
        {showSellerTools && (
          <ShopSellerTools userId={userId} onClose={() => setShowSellerTools(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
