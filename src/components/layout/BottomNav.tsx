import React from 'react';
import { Home, Calendar, ShoppingBag, User, Plus, LayoutDashboard, ClipboardList } from 'lucide-react';
import { UserRole } from '../../types';

interface BottomNavProps {
  role: UserRole;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSOS?: () => void;
}

export default function BottomNav({ role, activeTab, setActiveTab, onSOS }: BottomNavProps) {
  const tabs = [
    { id: 'home', label: role === 'admin' ? 'Dashboard' : 'Home', icon: role === 'admin' ? <LayoutDashboard size={24} /> : <Home size={24} /> },
    { id: 'services', label: role === 'admin' ? 'Bookings' : 'Services', icon: <Calendar size={24} /> },
    { id: 'sos', label: '', icon: null, isSOS: true },
    { id: 'shop', label: role === 'admin' ? 'Orders' : 'Shop', icon: role === 'admin' ? <ClipboardList size={24} /> : <ShoppingBag size={24} /> },
    { id: 'profile', label: 'Profile', icon: <User size={24} /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex items-center justify-around h-20 pb-2 px-2 z-50">
      {tabs.map((tab) => {
        if (tab.isSOS) {
          return (
            <button
              key="sos"
              onClick={onSOS}
              className="relative -top-6 bg-red-500 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 ring-8 ring-white active:scale-95 transition-transform"
            >
              <Plus size={32} className="rotate-45" />
            </button>
          );
        }

        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`bottom-nav-icon flex flex-col items-center gap-1 ${isActive ? 'active' : ''}`}
          >
            {tab.icon}
            <span className="text-[10px] font-bold tracking-tight">{tab.label}</span>
            {isActive && <div className="absolute top-0 w-12 h-1 bg-brand-blue rounded-b-full"></div>}
          </button>
        );
      })}
    </nav>
  );
}
