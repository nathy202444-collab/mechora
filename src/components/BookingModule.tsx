import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Car, 
  Wrench, 
  Clock, 
  ChevronRight, 
  User, 
  Star, 
  CheckCircle2, 
  ArrowLeft,
  Calendar as CalendarIcon,
  Bell,
  Sparkles
} from 'lucide-react';

interface Mechanic {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  specialty: string;
  distance: string;
  avatar: string;
}

import { Loader2 } from 'lucide-react';

interface BookingModuleProps {
  userId: string;
  userProfile?: any;
  onClose?: () => void;
}

export default function BookingModule({ userId, userProfile, onClose }: BookingModuleProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<Mechanic[]>([]);
  const [selectedMechanic, setSelectedMechanic] = useState<Mechanic | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [formData, setFormData] = useState({
    carModel: userProfile?.carInfo || '',
    serviceType: '',
    date: '',
    time: '',
    notes: ''
  });

  const serviceCategories = [
    { title: 'Routine', icon: <Car size={24} />, img: 'https://picsum.photos/seed/routine/300/200', desc: 'Maintenance & Checks' },
    { title: 'Car Repair', icon: <Wrench size={24} />, img: 'https://picsum.photos/seed/repair/300/200', desc: 'Fix engine & body' },
    { title: 'Electrical', icon: <Clock size={24} />, img: 'https://picsum.photos/seed/electric/300/200', desc: 'Wiring & battery' },
    { title: 'Tire & Wheel', icon: <Car size={24} />, img: 'https://picsum.photos/seed/tire/300/200', desc: 'Alignment & swap' },
    { title: 'Diagnostics', icon: <Clock size={24} />, img: 'https://picsum.photos/seed/diag/300/200', desc: 'Error scanning' },
    { title: 'Body & Accessories', icon: <Car size={24} />, img: 'https://picsum.photos/seed/body/300/200', desc: 'Paint & mods' },
    { title: 'Emergency', icon: <Bell size={24} />, img: 'https://picsum.photos/seed/sos/300/200', desc: 'Fast assistance' },
    { title: 'Car Wash', icon: <Car size={24} />, img: 'https://picsum.photos/seed/wash/300/200', desc: 'Cleaning & detail' },
  ];

  const handleNext = async (overrides?: Partial<typeof formData>) => {
    const dataToSend = { ...formData, ...overrides };
    
    // Validate car info before searching
    if (!dataToSend.carModel.trim()) {
      alert("Please enter your vehicle identity first.");
      return;
    }

    setLoading(true);

    // Try to get location if not already present
    let location = userLocation;
    if (!location) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(location);
      } catch (err) {
        console.warn("Could not get user location:", err);
      }
    }

    try {
      const response = await fetch('/api/bookings/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: userId,
          serviceType: dataToSend.serviceType,
          carModel: dataToSend.carModel,
          preferredDate: dataToSend.date,
          preferredTime: dataToSend.time,
          userLocation: location
        })
      });

      const data = await response.json();
      if (data.success && data.mechanics) {
        setMatches(data.mechanics);
        setStep(2);
      } else {
        alert(data.error || "No mechanics found for this service.");
      }
    } catch (err) {
      console.error("Match Error:", err);
      alert("Failed to find mechanics. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryTitle: string) => {
    setFormData(prev => ({ ...prev, serviceType: categoryTitle }));
    // Automatically trigger search
    handleNext({ serviceType: categoryTitle });
  };
  const handleConfirm = async () => {
    if (!selectedMechanic) return;
    setLoading(true);
    try {
      const response = await fetch('/api/bookings/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: userId,
          mechanicId: selectedMechanic.id,
          serviceType: formData.serviceType,
          carModel: formData.carModel,
          date: formData.date,
          time: formData.time
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowSuccess(true);
      } else {
        alert(data.error || "Failed to confirm booking.");
      }
    } catch (err) {
      console.error("Confirm Error:", err);
      alert("Failed to confirm booking. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getPriceEstimate = (service: string) => {
    const prices: Record<string, string> = {
      'Routine': 'KES 2,500 - 5,000',
      'Car Repair': 'KES 8,000 - 25,000+',
      'Electrical': 'KES 3,500 - 12,000',
      'Tire & Wheel': 'KES 1,500 - 4,000',
      'Diagnostics': 'KES 2,000 - 5,000',
      'Body & Accessories': 'KES 15,000+',
      'Emergency': 'KES 4,000+',
      'Car Wash': 'KES 500 - 1,500'
    };
    return prices[service] || 'Price on inspection';
  };

  const steps = [
    { id: 1, label: 'Service' },
    { id: 2, label: 'Mechanic' },
    { id: 3, label: 'Review' }
  ];

  const handleBack = () => setStep(step - 1);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white px-6 py-6 flex items-center justify-between border-b border-slate-100 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {step > 1 && !showSuccess && (
            <button onClick={() => setStep(step - 1)} className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft size={24} />
            </button>
          )}
          <h1 className="text-xl font-bold text-slate-900">
            {showSuccess ? 'Booking Confirmed' : step === 1 ? 'Book a Service' : step === 2 ? 'Choose Mechanic' : 'Confirm Details'}
          </h1>
        </div>
        <div className="relative">
          <button className="bg-slate-50 p-2 rounded-xl text-slate-400 relative">
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </header>

      <div className="px-6 py-4 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0"></div>
          {steps.map((s, idx) => (
            <div key={s.id} className="relative z-10 flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${step >= s.id ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/30' : 'bg-slate-50 text-slate-400 border border-slate-200'}
              `}>
                {step > s.id ? <CheckCircle2 size={16} /> : s.id}
              </div>
              <span className={`text-[10px] uppercase tracking-wider font-bold
                ${step >= s.id ? 'text-brand-blue' : 'text-slate-400'}
              `}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        <div className="mb-8 flex gap-4 overflow-x-auto pb-4 no-scrollbar">
           <button 
            onClick={() => {
              const now = new Date();
              const date = now.toISOString().split('T')[0];
              const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
              setFormData(prev => ({ ...prev, date, time }));
              handleNext({ date, time });
            }}
            disabled={loading || !formData.carModel || !formData.serviceType}
            className="flex-shrink-0 bg-brand-blue text-white px-6 py-4 rounded-3xl font-black uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-brand-blue/20 active:scale-95 transition-transform disabled:opacity-50 disabled:bg-slate-300"
           >
              <Sparkles size={20} />
              Book Now
           </button>
        </div>
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center space-y-6"
            >
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-brand-blue">
                <Clock size={48} className="animate-pulse" />
              </div>
              <div className="space-y-3 px-4">
                <h2 className="text-2xl font-black text-slate-900 leading-tight">Request Sent!</h2>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-sm font-medium text-slate-600">
                    Your request for <span className="font-bold text-slate-900">{formData.serviceType}</span> has been sent to <span className="font-bold text-slate-900">{selectedMechanic?.name}</span>.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-brand-blue text-xs font-bold uppercase tracking-widest">
                  <span className="w-2 h-2 bg-brand-blue rounded-full"></span>
                  Waiting for Mechanic Approval
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  You'll be notified as soon as they review your request.
                </p>
              </div>
              <button 
                onClick={() => {
                  if (onClose) {
                    onClose();
                  } else {
                    setShowSuccess(false);
                    setStep(1);
                    setSelectedMechanic(null);
                  }
                }}
                className="bg-brand-blue text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-brand-blue/20"
              >
                Done
              </button>
            </motion.div>
          ) : step === 1 ? (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Car size={16} className="text-brand-blue" />
                    Car Details
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Toyota Camry 2022"
                    className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                    value={formData.carModel}
                    onChange={e => setFormData({...formData, carModel: e.target.value})}
                  />
                </label>
                <div className="space-y-4">
                  <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Wrench size={16} className="text-brand-blue" />
                    Service Category
                  </span>
                  <div className="grid grid-cols-2 gap-3 pb-2">
                    {serviceCategories.map((cat) => (
                      <button
                        key={cat.title}
                        onClick={() => handleCategorySelect(cat.title)}
                        disabled={loading}
                        className={`text-left p-4 rounded-3xl border transition-all relative overflow-hidden group
                          ${formData.serviceType === cat.title 
                             ? 'border-brand-blue bg-blue-50/50 shadow-md ring-2 ring-brand-blue/20' 
                             : 'border-slate-100 bg-white hover:border-slate-200'}
                        `}
                      >
                         <img 
                            src={cat.img} 
                            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-10 transition-opacity" 
                            alt={cat.title}
                            referrerPolicy="no-referrer"
                         />
                         <div className={`p-2 rounded-xl mb-3 inline-block transition-colors
                           ${formData.serviceType === cat.title ? 'bg-brand-blue text-white' : 'bg-slate-50 text-slate-400'}
                         `}>
                            {cat.icon}
                         </div>
                         <h4 className="font-bold text-sm text-slate-800 mb-0.5">{cat.title}</h4>
                         <p className="text-[10px] text-slate-400 font-medium leading-tight">{cat.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <CalendarIcon size={16} className="text-brand-blue" />
                      Preferred Date
                    </span>
                    <input
                      type="date"
                      className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Clock size={16} className="text-brand-blue" />
                      Preferred Time
                    </span>
                    <input
                      type="time"
                      className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                      value={formData.time}
                      onChange={e => setFormData({...formData, time: e.target.value})}
                    />
                  </label>
                </div>
              </div>

              <button
                onClick={() => handleNext()}
                disabled={loading || !formData.carModel || !formData.serviceType}
                className="w-full bg-brand-blue text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/20 disabled:opacity-50 active:scale-95 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    Find Mechanics
                    <ChevronRight size={20} />
                  </>
                )}
              </button>
            </motion.div>
          ) : step === 2 ? (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="bg-blue-50 p-4 rounded-2xl space-y-1">
                <p className="text-xs font-bold text-brand-blue uppercase tracking-wider">Matching for</p>
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">{formData.serviceType}</h3>
                  <p className="text-xs text-slate-500">{formData.carModel}</p>
                </div>
              </div>

              <h2 className="text-lg font-bold text-slate-900 pt-2">Recommended Mechanics</h2>

              <div className="space-y-4">
                {matches.length > 0 ? matches.map((mechanic, i) => (
                  <motion.div
                    key={mechanic.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => {
                      setSelectedMechanic(mechanic);
                      setStep(3);
                    }}
                    className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 active:border-brand-blue hover:border-brand-blue/50 transition-colors cursor-pointer group"
                  >
                    <img 
                      src={mechanic.avatar || `https://picsum.photos/seed/${mechanic.id}/100/100`} 
                      className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-50" 
                      alt={mechanic.name} 
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-900">{mechanic.name}</h4>
                        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                          <Star size={12} className="text-yellow-500 fill-yellow-500" />
                          <span className="text-[10px] font-bold text-yellow-700">{mechanic.rating}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 font-medium mb-1">{mechanic.specialty}</p>
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                           <MapPin size={10} />
                           {mechanic.distance}
                         </span>
                         <span className="text-[10px] font-bold text-brand-blue bg-blue-50 px-2 py-0.5 rounded-md">
                           {mechanic.reviews} Reviews
                         </span>
                      </div>
                    </div>
                  </motion.div>
                )) : (
                  <div className="bg-white p-8 rounded-3xl border border-dashed border-slate-200 text-center space-y-3">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto">
                      <User size={32} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">No mechanics available</p>
                      <p className="text-xs text-slate-400">Try a different service or check back later.</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-4 bg-blue-50/30 p-4 rounded-3xl border border-blue-50">
                  <img 
                    src={selectedMechanic?.avatar || `https://picsum.photos/seed/${selectedMechanic?.id}/100/100`} 
                    className="w-16 h-16 rounded-[20px] object-cover border-4 border-white shadow-sm" 
                    alt={selectedMechanic?.name} 
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <p className="text-[10px] font-bold text-brand-blue uppercase tracking-widest">Selected Expert</p>
                    <h3 className="text-lg font-bold text-slate-900">{selectedMechanic?.name}</h3>
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-bold text-slate-500">{selectedMechanic?.rating}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 text-sm uppercase tracking-widest px-1">Engagement Details</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="bg-white p-2 rounded-xl text-brand-blue shadow-sm">
                        <Wrench size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Service</p>
                        <p className="font-bold text-slate-800">{formData.serviceType}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Estimate</p>
                        <p className="font-bold text-brand-blue text-xs">{getPriceEstimate(formData.serviceType)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <CalendarIcon size={16} className="text-brand-blue" />
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Date</p>
                          <p className="font-bold text-slate-800 text-xs">{formData.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <Clock size={16} className="text-brand-blue" />
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Time</p>
                          <p className="font-bold text-slate-800 text-xs">{formData.time}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={14} className="text-brand-blue" />
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Special Instructions</p>
                      </div>
                      <textarea
                        className="w-full bg-white border border-slate-100 rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-blue outline-none transition-all resize-none h-20"
                        placeholder="Any specific issues with your vehicle? (Optional)"
                        value={formData.notes}
                        onChange={e => setFormData({...formData, notes: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="w-full bg-brand-blue text-white py-5 rounded-[24px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-brand-blue/20 active:scale-95 transition-all text-sm group"
                >
                  {loading ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <>
                      Confirm & Send Request
                      <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  Professional is Ready to Accept
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MapPin({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
