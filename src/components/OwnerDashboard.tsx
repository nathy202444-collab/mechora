import React, { useState, useEffect } from 'react';
import { Bell, Car, Wrench, AlertTriangle, ChevronRight, MapPin, MessageCircle, X, Loader2, Calendar, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';

interface OwnerDashboardProps {
  onNavigateBooking: () => void;
  onNavigateSOS: () => void;
  onNavigateShop: () => void;
  userId: string;
}

export default function OwnerDashboard({ 
  onNavigateBooking, 
  onNavigateSOS, 
  onNavigateShop, 
  userId 
}: OwnerDashboardProps) {
  const [profile, setProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [showVehicleDetails, setShowVehicleDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Profile
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) setProfile(userDoc.data());

        // Fetch Recent Bookings
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("ownerId", "==", userId),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const bookingsSnap = await getDocs(bookingsQuery);
        setBookings(bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Admin Messages
        const messagesQuery = query(
          collection(db, "daily_messages"),
          orderBy("createdAt", "desc"),
          limit(3)
        );
        const messagesSnap = await getDocs(messagesQuery);
        setAdminMessages(messagesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (err) {
        console.error("Dashboard data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchData();
  }, [userId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
       <Loader2 className="animate-spin text-brand-blue" size={40} />
    </div>
  );

  const getFirstName = (fullName: string) => fullName ? fullName.split(' ')[0] : 'User';

  return (
    <div className="pb-24 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-brand-blue p-8 pt-12 text-white rounded-b-[40px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10 flex justify-between items-start mb-6">
          <div>
            <p className="text-white/60 text-sm font-medium">Hello there,</p>
            <h1 className="text-3xl font-bold">{getFirstName(profile?.name)} 👋</h1>
          </div>
          <div className="flex gap-2">
            <button className="bg-white/10 p-2 rounded-full relative active:scale-90 transition-transform">
              <Bell size={24} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-brand-blue"></span>
            </button>
            <img 
              src={profile?.photoURL || `https://picsum.photos/seed/${userId}/100/100`} 
              className="w-12 h-12 rounded-full border-2 border-white/20 shadow-lg" 
              referrerPolicy="no-referrer"
              alt="Avatar"
            />
          </div>
        </div>

        {/* My Vehicle Card */}
        <button 
          onClick={() => setShowVehicleDetails(true)}
          className="w-full bg-white rounded-3xl p-5 flex items-center gap-4 text-slate-900 shadow-xl translate-y-6 hover:shadow-2xl transition-all active:scale-95"
        >
          <div className="bg-blue-50 p-3 rounded-2xl">
            <Car className="text-brand-blue" size={28} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-slate-400 text-[10px] font-extrabold uppercase tracking-widest">Primary Vehicle</p>
            <h3 className="text-lg font-bold">{profile?.carInfo || 'Enter Vehicle Identity'}</h3>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl">
             <ChevronRight className="text-slate-400" size={20} />
          </div>
        </button>
      </div>

      <div className="px-6 pt-12 space-y-8">
         {/* Admin Daily Message */}
         {adminMessages.length > 0 && (
           <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <MessageCircle size={64} />
              </div>
              <div className="relative z-10 space-y-3">
                 <div>
                    <p className="text-blue-200 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Bulletin Board</p>
                    <p className="text-blue-50 text-xs leading-relaxed line-clamp-3">
                      {adminMessages[0].content}
                    </p>
                 </div>
                 {adminMessages[0].imageURL && (
                    <div className="w-full h-32 rounded-2xl overflow-hidden border border-white/20 shadow-lg">
                       <img src={adminMessages[0].imageURL} className="w-full h-full object-cover" alt="Broadcast" referrerPolicy="no-referrer" />
                    </div>
                 )}
              </div>
           </div>
         )}

        {/* Main Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={onNavigateBooking}
            className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-start gap-4 hover:border-brand-blue transition-colors text-left"
          >
            <div className="bg-blue-50 p-3 rounded-2xl text-brand-blue">
              <Wrench size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 tracking-tight">Book Care</h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Mechanics Near You</p>
            </div>
          </button>
          <button 
            onClick={onNavigateSOS}
            className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-start gap-4 hover:border-red-500 transition-colors text-left"
          >
            <div className="bg-red-50 p-3 rounded-2xl text-red-500">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 tracking-tight">SOS Request</h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Immediate Aid</p>
            </div>
          </button>
        </div>

        {/* Shop Shortcut */}
        <button 
          onClick={onNavigateShop}
          className="w-full bg-slate-900 p-6 rounded-[32px] text-white flex items-center justify-between group active:scale-95 transition-all shadow-xl shadow-slate-900/10"
        >
           <div className="flex items-center gap-4">
              <div className="bg-white/10 p-3 rounded-2xl">
                 <Package size={24} />
              </div>
              <div>
                 <h3 className="font-bold tracking-tight">Auto Shop</h3>
                 <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider">Mechanic Parts Marketplace</p>
              </div>
           </div>
           <div className="bg-white/10 p-2 rounded-xl group-hover:bg-white/20 transition-colors">
              <ChevronRight size={20} />
           </div>
        </button>

        {/* Recent Services */}
        <section>
          <div className="flex justify-between items-end mb-5">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Service Logs</h2>
            <button className="text-brand-blue font-bold text-xs uppercase tracking-widest">History</button>
          </div>
          <div className="space-y-3">
            {bookings.length === 0 ? (
              <div className="dashboard-card text-center py-10 opacity-50">
                 <Calendar className="mx-auto mb-2 text-slate-200" size={32} />
                 <p className="text-sm font-bold uppercase tracking-widest text-slate-300">No recent bookings</p>
              </div>
            ) : (
              bookings.map((booking, i) => (
                <motion.div 
                  key={booking.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white p-4 rounded-[28px] flex items-center gap-4 border border-slate-100 shadow-sm"
                >
                  <div className="bg-slate-50 p-3 rounded-2xl text-slate-400">
                    <Wrench size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm text-slate-800">{booking.serviceType}</h4>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                       {booking.date || 'Checking date...'}
                    </p>
                  </div>
                  <span className={`text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter shadow-sm
                    ${booking.status === 'completed' ? 'bg-green-500 text-white' : 
                      booking.status === 'pending' ? 'bg-yellow-400 text-white' : 'bg-slate-100 text-slate-400'}
                  `}>
                    {booking.status}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Vehicle Details Modal */}
      <AnimatePresence>
        {showVehicleDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowVehicleDetails(false)}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative bg-white w-full max-w-sm rounded-[42px] p-8 shadow-2xl"
             >
                <div className="absolute top-6 right-6">
                   <button onClick={() => setShowVehicleDetails(false)} className="bg-slate-50 p-2 rounded-xl text-slate-400">
                      <X size={20} />
                   </button>
                </div>

                <div className="flex flex-col items-center text-center mt-4">
                   <div className="bg-blue-50 p-6 rounded-[32px] mb-6">
                      <Car size={56} className="text-brand-blue" />
                   </div>
                   <h2 className="text-2xl font-bold mb-1">{profile?.carInfo || 'Not Set'}</h2>
                   <p className="text-slate-400 text-sm mb-8">Primary Vehicle Linked to Profile</p>
                   
                   <div className="w-full grid grid-cols-2 gap-4 text-left">
                      <div className="bg-slate-50 p-4 rounded-2xl">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                         <p className="text-sm font-bold text-slate-800">Operational</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl">
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Last Scan</p>
                         <p className="text-sm font-bold text-slate-800">04 April</p>
                      </div>
                   </div>

                   <button 
                     onClick={() => setShowVehicleDetails(false)}
                     className="w-full bg-brand-blue text-white py-4 rounded-2xl font-bold mt-8 shadow-lg shadow-brand-blue/20"
                   >
                      Manage Logbook
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
