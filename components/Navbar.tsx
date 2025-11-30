import React from 'react';
import { AppRoute } from '../types';
import { Mic, User, Home } from 'lucide-react';

interface NavbarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, onNavigate }) => {
  const getLinkClass = (route: AppRoute) => {
    const baseClass = "flex flex-col items-center justify-center space-y-1 text-sm transition-all duration-200";
    return currentRoute === route 
      ? `${baseClass} text-black font-black transform scale-105` 
      : `${baseClass} text-gray-500 hover:text-black`;
  };

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t-4 border-black z-50 md:top-0 md:bottom-auto md:border-t-0 md:border-b-4 shadow-[0_-4px_0_0_rgba(0,0,0,0.1)] md:shadow-hard">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          
          {/* Mobile & Desktop Logo */}
          <div className="hidden md:flex items-center">
            <span className="text-2xl font-black italic bg-black text-white px-2 py-1 transform -skew-x-12 border-2 border-transparent">
              ZKUŠEBNA<span className="text-brand-cyan">.CZ</span>
            </span>
          </div>

          {/* Navigation Links */}
          <div className="flex w-full md:w-auto justify-around md:justify-end md:space-x-8">
            <button onClick={() => onNavigate(AppRoute.HOME)} className={getLinkClass(AppRoute.HOME)}>
              <Home size={24} strokeWidth={2.5} />
              <span className="font-bold uppercase">Domů</span>
            </button>
            <button onClick={() => onNavigate(AppRoute.STUDIO)} className={getLinkClass(AppRoute.STUDIO)}>
              <div className="bg-brand-pink border-3 border-black p-2 -mt-8 md:mt-0 md:p-0 md:bg-transparent md:border-0 shadow-hard md:shadow-none">
                 <Mic size={24} className="text-white md:text-current md:w-6 md:h-6" strokeWidth={2.5} />
              </div>
              <span className="font-bold uppercase md:font-bold">Studio</span>
            </button>
            <button onClick={() => onNavigate(AppRoute.PROFILE)} className={getLinkClass(AppRoute.PROFILE)}>
              <User size={24} strokeWidth={2.5} />
              <span className="font-bold uppercase">Profil</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};