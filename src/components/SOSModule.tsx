import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  MapPin, 
  Phone, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  ChevronLeft,
  ChevronRight,
  Bell,
  ShieldAlert,
  Loader2,
  Navigation,
  Car,
  Wrench
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc } from 'firebase/firestore';

// Leaflet Icon fix
const userIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const mechanicIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Helper to auto-center map when locations change
function MapController({ userPos, mechPos }: { userPos?: [number, number], mechPos?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (userPos && mechPos) {
      const bounds = L.latLngBounds([userPos, mechPos]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (userPos) {
      map.setView(userPos, 15);
    }
  }, [userPos, mechPos, map]);
  return null;
}

export default function SOSModule({ onBack, userId, role }: { onBack: () => void, userId: string, role?: string }) {
  const [isActivating, setIsActivating] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [sosType, setSosType] = useState<'repair' | 'towing' | 'pickup'>('repair');
  const [currentAlertId, setCurrentAlertId] = useState<string | null>(null);
  const [mechanicStatus, setMechanicStatus] = useState<'searching' | 'assigned' | 'arriving'>('searching');
  const [assignedMechanic, setAssignedMechanic] = useState<any>(null);
  const [alertData, setAlertData] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sosImage, setSosImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationIntervalRef = useRef<any>(null);

  // For mechanics: Listen to our assigned alerts and update location
  useEffect(() => {
    // Get current location for the initial map
    navigator.geolocation.getCurrentPosition((pos) => {
      setUserLocation([pos.coords.latitude, pos.coords.longitude]);
    }, (err) => console.error("Location error:", err));

    if (role === 'mechanic') {
      const q = query(
        collection(db, 'sos_alerts'),
        where('assignedMechanicId', '==', userId),
        where('status', '==', 'active')
      );
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        if (!snapshot.empty) {
          const docRef = snapshot.docs[0];
          const docData = { id: docRef.id, ...docRef.data() } as any;
          setAlertData(docData);
          setSosActive(true);
          setCurrentAlertId(docRef.id);
          
          // Fetch user info
          const userDoc = await getDoc(doc(db, 'users', docData.userId));
          if (userDoc.exists()) setUserData(userDoc.data());

          // Start updating mechanic location
          if (!locationIntervalRef.current) {
            locationIntervalRef.current = setInterval(() => {
                navigator.geolocation.getCurrentPosition((pos) => {
                    updateDoc(doc(db, 'sos_alerts', docRef.id), {
                        mechanicLocation: {
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude
                        },
                        updatedAt: serverTimestamp()
                    }).catch(console.error);
                });
            }, 10000); // Reduced frequency slightly for stability
          }
        } else {
            // No active assignment
            setSosActive(false);
            setAlertData(null);
            setCurrentAlertId(null);
            if (locationIntervalRef.current) {
                clearInterval(locationIntervalRef.current);
                locationIntervalRef.current = null;
            }
        }
      });
      return () => {
        unsubscribe();
        if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      };
    }
  }, [role, userId]);

  const [allActiveAlerts, setAllActiveAlerts] = useState<any[]>([]);

  // For Admins: Listen to ALL active alerts
  useEffect(() => {
    if (role === 'admin') {
      const q = query(collection(db, 'sos_alerts'), where('status', '==', 'active'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllActiveAlerts(alerts);
      });
      return () => unsubscribe();
    }
  }, [role]);

  // Listen for alert updates (for Owner)
  useEffect(() => {
    if (currentAlertId && role === 'owner') {
      const unsubscribe = onSnapshot(doc(db, 'sos_alerts', currentAlertId), async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setAlertData({ id: snapshot.id, ...data });
          if (data.assignedMechanicId) {
             setMechanicStatus('assigned');
             if (!assignedMechanic || assignedMechanic.uid !== data.assignedMechanicId) {
                const mechDoc = await getDoc(doc(db, 'users', data.assignedMechanicId));
                if (mechDoc.exists()) setAssignedMechanic({ uid: data.assignedMechanicId, ...mechDoc.data() });
             }
          }
          if (data.status === 'resolved') {
            setSosActive(false);
            alert("Rescue complete!");
          }
        }
      });
      return () => unsubscribe();
    }
  }, [currentAlertId, role, assignedMechanic]);

  const triggerSOS = async () => {
    setIsActivating(true);
    
    // 1. Get Location
    navigator.geolocation.getCurrentPosition(async (position) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };

      try {
        const sosData = {
          userId,
          location,
          status: "active",
          type: sosType,
          imageURL: sosImage,
          createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "sos_alerts"), sosData);
        
        // Broadcast to mechanics
        const mechanicsQuery = query(collection(db, "users"), where("role", "==", "mechanic"));
        const mechanicsSnapshot = await getDocs(mechanicsQuery);

        const notificationPromises = mechanicsSnapshot.docs.map(mechanicDoc => {
          return addDoc(collection(db, "notifications"), {
            recipientId: mechanicDoc.id,
            title: "🚨 EMERGENCY SOS",
            message: "A user nearby needs urgent help!",
            type: "sos_nearby",
            relatedId: docRef.id,
            read: false,
            createdAt: serverTimestamp()
          });
        });

        await Promise.all(notificationPromises);

        setCurrentAlertId(docRef.id);
        setIsActivating(false);
        setSosActive(true);
      } catch (err) {
        console.error("SOS Trigger Error:", err);
        alert("Failed to trigger SOS. Please check your connection.");
        setIsActivating(false);
      }
    }, (error) => {
      alert("Please enable location services to use SOS.");
      setIsActivating(false);
    });
  };

  const cancelSOS = async () => {
    if (currentAlertId) {
        await updateDoc(doc(db, 'sos_alerts', currentAlertId), {
            status: 'cancelled',
            updatedAt: serverTimestamp()
        });
    }
    setSosActive(false);
    setMechanicStatus('searching');
    setSosImage(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Limit 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      setSosImage(result.imageUrl);
    } catch (err: any) {
      console.error("Upload error:", err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const userPos: [number, number] | undefined = alertData?.location ? [alertData.location.lat, alertData.location.lng] : undefined;
  const mechPos: [number, number] | undefined = alertData?.mechanicLocation ? [alertData.mechanicLocation.lat, alertData.mechanicLocation.lng] : undefined;

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-12 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center justify-between z-20">
        <button 
          onClick={onBack}
          className="bg-white/10 p-2 rounded-xl text-white hover:bg-white/20 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold uppercase tracking-widest text-red-500">
          {role === 'admin' ? 'Admin Hub' : 'Emergency SOS'}
        </h1>
        <div className="w-10">
          {role === 'admin' && <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mx-auto" />}
        </div>
      </header>

      <div className="flex-1 relative flex flex-col px-6">
        <AnimatePresence mode="wait">
          {(role === 'admin' || role === 'mechanic') ? (
             <motion.div 
               key="admin-view"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="flex-1 flex flex-col"
             >
                <div className="h-64 bg-slate-800 rounded-[32px] overflow-hidden relative shadow-inner mb-6 border border-white/5">
                  <MapContainer 
                    center={userLocation || [-1.2921, 36.8219]} 
                    zoom={12} 
                    style={{ height: '100%', width: '100%', zIndex: 1 }}
                    className="rounded-[32px]"
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {(role === 'admin' ? allActiveAlerts : allActiveAlerts.filter(a => !a.assignedMechanicId)).map(alert => (
                      <Marker 
                        key={alert.id} 
                        position={[alert.location.lat, alert.location.lng]} 
                        icon={userIcon}
                        eventHandlers={{
                          click: () => {
                            if (role === 'admin') {
                              setAlertData(alert);
                              setSosActive(true);
                              setCurrentAlertId(alert.id);
                            }
                          }
                        }}
                      >
                        <Popup>
                          <div className="p-2">
                             <h4 className="font-bold capitalize">{alert.type}</h4>
                             <p className="text-xs mb-2">Needs assistance</p>
                             {role === 'mechanic' && (
                               <button 
                                 onClick={() => {
                                   setAlertData(alert);
                                   setSosActive(true);
                                   setCurrentAlertId(alert.id);
                                 }}
                                 className="w-full bg-red-600 text-white py-1 px-3 rounded-lg text-[10px] font-bold"
                               >
                                 Respond
                               </button>
                             )}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    {userLocation && (
                      <Marker position={userLocation} icon={mechanicIcon}>
                        <Popup>You are here (Pro)</Popup>
                      </Marker>
                    )}
                  </MapContainer>
                  <div className="absolute top-4 right-4 z-[1000] bg-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    {allActiveAlerts.length} SOS Alerts
                  </div>
                </div>

                <h2 className="text-xl font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
                  <ShieldAlert className="text-red-500" size={24} />
                  {role === 'admin' ? 'Global Live Action' : 'Available Requests'}
                </h2>

                <div className="space-y-4 overflow-y-auto max-h-[400px] mb-8 pb-10">
                   {(role === 'admin' ? allActiveAlerts : allActiveAlerts.filter(a => !a.assignedMechanicId)).length === 0 ? (
                      <div className="text-center py-12 bg-slate-800/50 rounded-[32px] border border-white/5">
                         <CheckCircle2 size={48} className="mx-auto text-green-500 mb-4 opacity-20" />
                         <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">All clear on the roads</p>
                      </div>
                   ) : (
                      (role === 'admin' ? allActiveAlerts : allActiveAlerts.filter(a => !a.assignedMechanicId)).map(alert => (
                        <button 
                          key={alert.id}
                          onClick={() => {
                            setAlertData(alert);
                            setCurrentAlertId(alert.id);
                            setSosActive(true);
                          }}
                          className="w-full bg-slate-800 p-6 rounded-[32px] border border-white/5 flex items-center gap-4 hover:bg-slate-700 transition-colors"
                        >
                           <div className="bg-red-500/20 p-3 rounded-2xl text-red-500">
                             {alert.type === 'towing' ? <Navigation size={24} /> : alert.type === 'repair' ? <Wrench size={24} /> : <AlertTriangle size={24} />}
                           </div>
                           <div className="flex-1 text-left">
                              <h4 className="font-bold text-lg capitalize">{alert.type} Requested</h4>
                              <p className="text-xs text-slate-400 font-medium">#{alert.id.slice(-6)} • {alert.status}</p>
                           </div>
                           <ChevronRight className="text-slate-600" />
                        </button>
                      ))
                   )}
                </div>
             </motion.div>
          ) : !sosActive ? (
            <motion.div 
              key="inactive"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex-1 flex flex-col pt-4"
            >
              {/* Preview Map */}
              <div className="h-64 bg-slate-800 rounded-[32px] overflow-hidden relative shadow-inner mb-8 border border-white/5">
                <MapContainer 
                  center={userLocation || [0, 0]} 
                  zoom={15} 
                  style={{ height: '100%', width: '100%', zIndex: 1 }}
                  className="rounded-[32px]"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <MapController userPos={userLocation || undefined} />
                  
                  {userLocation && (
                    <Marker position={userLocation} icon={userIcon}>
                      <Popup>You are here</Popup>
                    </Marker>
                  )}
                </MapContainer>
                <div className="absolute top-4 left-4 z-[1000]">
                  <div className="bg-red-600/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/20">
                    <div className="bg-white w-1.5 h-1.5 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {role === 'mechanic' ? 'Awaiting Alerts' : 'Live Preview'}
                    </span>
                  </div>
                </div>
              </div>

              {role === 'mechanic' ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-10 pb-20">
                   <div className="relative mb-8">
                      <div className="absolute -inset-8 bg-brand-blue/20 rounded-full animate-ping" />
                      <div className="bg-brand-blue w-24 h-24 rounded-[32px] flex items-center justify-center relative shadow-2xl">
                         <Bell className="text-white animate-bounce" size={40} />
                      </div>
                   </div>
                   <h2 className="text-3xl font-black tracking-tighter mb-4">Ready for Duty</h2>
                   <p className="text-slate-400 font-medium leading-relaxed">
                     We are monitoring the map for urgent car owner requests. Keep this window open to receive live alerts.
                   </p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8 space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Need Urgent Help?</h2>
                    <p className="text-slate-400 text-sm">Select service type and trigger the alarm.</p>
                  </div>

                  {/* SOS Type Selection */}
                  <div className="flex gap-3 mb-8 w-full max-w-md mx-auto">
                    {[
                      { id: 'repair', label: 'Repair', icon: <Wrench size={18} /> },
                      { id: 'towing', label: 'Towing', icon: <Navigation size={18} /> },
                      { id: 'pickup', label: 'Pickup', icon: <Car size={18} /> }
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setSosType(type.id as any)}
                        className={`flex-1 p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2
                          ${sosType === type.id 
                              ? 'border-red-500 bg-red-500/10 text-red-500 shadow-lg shadow-red-500/10' 
                              : 'border-white/5 bg-white/5 text-slate-400 hover:border-white/10'}
                        `}
                      >
                          {type.icon}
                          <span className="text-[10px] font-black uppercase tracking-widest">{type.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Add Image Section */}
                  <div className="w-full max-w-md mx-auto mb-8 px-2">
                     <div 
                       onClick={() => fileInputRef.current?.click()}
                       className={`w-full aspect-video rounded-[32px] border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all cursor-pointer relative overflow-hidden
                         ${sosImage ? 'border-red-500/50 bg-slate-800' : 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-400'}
                       `}
                     >
                        {isUploading ? (
                           <Loader2 className="animate-spin text-brand-blue" size={32} />
                        ) : sosImage ? (
                           <>
                              <img src={sosImage} className="w-full h-full object-cover" alt="Breakdown" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                 <motion.span initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-white text-xs font-black uppercase tracking-widest bg-red-600 px-4 py-2 rounded-full shadow-lg">Change Photo</motion.span>
                              </div>
                           </>
                        ) : (
                           <>
                              <div className="bg-white/5 p-4 rounded-2xl">
                                 <Car size={32} className="text-slate-500" />
                              </div>
                              <div className="text-center">
                                 <p className="text-xs font-bold text-white/80">Add Breakdown Photo</p>
                                 <p className="text-[10px] text-slate-500 font-medium">Shows mechanics the issue</p>
                              </div>
                           </>
                        )}
                        <input 
                           type="file" 
                           ref={fileInputRef} 
                           onChange={handleImageUpload} 
                           className="hidden" 
                           accept="image/*" 
                        />
                     </div>
                  </div>

                  <div className="flex flex-col items-center pb-12">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={triggerSOS}
                      disabled={isActivating}
                      className={`relative w-64 h-64 rounded-full flex flex-col items-center justify-center shadow-[0_0_80px_rgba(220,38,38,0.4)] transition-all duration-500 ${
                        isActivating ? 'bg-red-800' : 'bg-red-600 hover:bg-red-500'
                      }`}
                    >
                      {/* Visual effects for emergency feel */}
                      <div className="absolute inset-0 rounded-full border-[16px] border-white/10 animate-pulse"></div>
                      <div className="absolute -inset-6 rounded-full border-2 border-red-500/20 animate-ping opacity-30"></div>
                      <div className="absolute inset-4 rounded-full border-2 border-white/5"></div>
                      
                      {isActivating ? (
                        <Loader2 size={64} className="animate-spin text-white" />
                      ) : (
                        <span className="text-8xl font-black text-white tracking-widest drop-shadow-2xl select-none">SOS</span>
                      )}
                    </motion.button>
                    <p className="mt-12 text-slate-500 text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3">
                       <span className="bg-red-500 w-2 h-2 rounded-full animate-pulse" />
                       Emergency Broadcast Center
                       <span className="bg-red-500 w-2 h-2 rounded-full animate-pulse" />
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="active"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col"
            >
              {/* Live Map Area */}
              <div className="flex-1 bg-slate-800 rounded-[32px] overflow-hidden relative shadow-inner mb-6 min-h-[300px]">
                <MapContainer 
                  center={userPos || [0, 0]} 
                  zoom={15} 
                  style={{ height: '100%', width: '100%', zIndex: 1 }}
                  className="rounded-[32px]"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <MapController userPos={userPos} mechPos={mechPos} />
                  
                  {userPos && (
                    <Marker position={userPos} icon={userIcon}>
                      <Popup>Your Location</Popup>
                    </Marker>
                  )}
                  
                  {mechPos && (
                    <Marker position={mechPos} icon={mechanicIcon}>
                      <Popup>Mechanic's Location</Popup>
                    </Marker>
                  )}
                </MapContainer>

                <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md p-3 rounded-2xl flex items-center gap-3 border border-white/10 z-[1000]">
                   <div className="bg-green-500 w-2 h-2 rounded-full animate-pulse"></div>
                   <span className="text-xs font-bold text-white/80">Broadcasting live location...</span>
                </div>
              </div>
              {/* Status Panel */}
              <div className="bg-white rounded-[40px] p-8 -mx-6 mb-[-24px] text-slate-900 space-y-6 shadow-2xl">
                 <div className="flex justify-between items-start">
                    <div>
                       <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">
                         {role === 'mechanic' ? 'SOS Response' : role === 'admin' ? 'Monitoring' : 'SOS Active'}
                       </p>
                       <h3 className="text-2xl font-bold tracking-tight">
                         {role === 'mechanic' ? (userData?.name || 'Help Requested') : (role === 'admin' && alertData) ? `Admin: ${alertData.type}` : (
                           <>
                             {mechanicStatus === 'searching' && 'Searching for help...'}
                             {mechanicStatus === 'assigned' && 'Mechanic Assigned'}
                             {mechanicStatus === 'arriving' && 'On the way!'}
                           </>
                         )}
                       </h3>
                    </div>
                    {(role === 'owner' || role === 'admin') && (
                      <button 
                        onClick={() => {
                          if (role === 'admin') {
                            setSosActive(false);
                          } else {
                            cancelSOS();
                          }
                        }}
                        className="text-slate-400 hover:text-red-500 transition-colors text-sm font-bold"
                      >
                        {role === 'admin' ? 'Close View' : 'Cancel SOS'}
                      </button>
                    )}
                 </div>

                 {alertData?.imageURL && (
                    <div className="w-full h-40 bg-slate-50 rounded-3xl overflow-hidden border border-slate-100 shadow-inner">
                       <img src={alertData.imageURL} className="w-full h-full object-cover" alt="Breakdown" referrerPolicy="no-referrer" />
                    </div>
                 )}

                  {(role === 'mechanic' ? userData : (role === 'admin' ? null : assignedMechanic)) ? (
                   <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-50 p-6 rounded-[32px] flex items-center gap-4 border border-slate-100"
                   >
                      <img 
                        src={(role === 'mechanic' ? userData : assignedMechanic).photoURL || `https://picsum.photos/seed/${(role === 'mechanic' ? userData : assignedMechanic).name}/100/100`} 
                        className="w-16 h-16 rounded-[24px] object-cover border-2 border-white shadow-md" 
                        alt="Contact" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1">
                         <h4 className="font-bold text-lg">{(role === 'mechanic' ? userData : assignedMechanic).name}</h4>
                         <p className="text-[10px] text-slate-500 mb-1 flex items-center gap-1 font-black uppercase tracking-widest">
                           <Phone size={10} className="text-brand-blue" />
                           {(role === 'mechanic' ? userData : assignedMechanic).phone || 'No phone'}
                         </p>
                      </div>
                      <div className="flex gap-2">
                         <a 
                           href={`tel:${(role === 'mechanic' ? userData : assignedMechanic).phone}`}
                           className="bg-brand-blue text-white p-4 rounded-2xl shadow-lg shadow-brand-blue/20 active:scale-95 transition-all"
                         >
                           <Phone size={24} />
                         </a>
                      </div>
                   </motion.div>
                 ) : (
                   <div className="space-y-4">
                      <div className="flex items-center gap-3 text-slate-400">
                         <Loader2 size={16} className="animate-spin" />
                         <span className="text-sm font-medium">Alerting nearby services...</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                         <motion.div 
                           initial={{ x: "-100%" }}
                           animate={{ x: "0%" }}
                           transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                           className="bg-brand-blue h-full w-full"
                         />
                      </div>
                   </div>
                 )}

                 <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center gap-2 text-slate-500">
                       <CheckCircle2 size={18} className="text-green-500" />
                       <span className="text-xs font-bold">Location Sent</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                       <CheckCircle2 size={18} className="text-green-500" />
                       <span className="text-xs font-bold">Help Nearby</span>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
