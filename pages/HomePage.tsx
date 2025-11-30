import React from 'react';
import { Button } from '../components/Button';
import { AppRoute } from '../types';
import { ARTISTS } from '../constants';

interface HomePageProps {
  onNavigate: (route: AppRoute) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  return (
    <div className="pb-20 md:pb-24 pt-4 md:pt-28 px-4 md:px-8 max-w-7xl mx-auto">
      
      {/* Header Section from Image */}
      <div className="mb-8">
        <div className="inline-block bg-brand-cyan border-4 border-black shadow-hard p-2 md:p-4 mb-6 transform -rotate-1">
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-black">
            RAPEŘI
          </h1>
        </div>

        {/* Search Bar */}
        <div className="relative mb-8">
          <input 
            type="text" 
            placeholder="HLEDAT RAPERA..." 
            className="w-full md:w-2/3 border-4 border-black p-4 text-xl font-bold placeholder-gray-400 focus:outline-none shadow-hard focus:translate-x-1 focus:translate-y-1 focus:shadow-none transition-all uppercase"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-4 mb-12">
          {['VŠICHNI', 'LEGENDY', 'UNDERGROUND', 'TRAP', 'SKUPINY', 'REGIONY'].map((filter, index) => (
            <Button 
              key={filter} 
              variant={index === 0 ? 'cyan' : 'secondary'} 
              size="sm"
              className="font-black text-sm md:text-base border-3"
            >
              {filter}
            </Button>
          ))}
        </div>
      </div>

      {/* Artists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        {ARTISTS.map((artist) => (
          <div key={artist.id} className="border-4 border-black bg-white shadow-hard flex flex-col">
            
            {/* Image Container */}
            <div className="w-full h-80 relative border-b-4 border-black overflow-hidden group">
              <img 
                src={artist.image} 
                alt={artist.name} 
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300" 
              />
              {/* Optional: Overlay effect */}
              <div className="absolute inset-0 bg-brand-cyan/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
            </div>

            {/* Content */}
            <div className="p-6 flex-grow flex flex-col">
              {/* Tags */}
              <div className="flex gap-3 mb-4">
                {artist.tags.map((tag, i) => (
                  <span 
                    key={tag} 
                    className={`border-2 border-black px-3 py-1 font-bold text-xs md:text-sm uppercase tracking-wider ${i === 0 ? 'bg-brand-cyan' : i === 1 ? (tag === 'TRAP' ? 'bg-brand-purple' : 'bg-brand-yellow') : 'bg-white'}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <h2 className="text-3xl md:text-4xl font-black uppercase mb-4 leading-none">
                {artist.name}
              </h2>
              
              <p className="text-gray-800 font-medium leading-relaxed mb-6 flex-grow">
                {artist.bio}
              </p>

              <button className="w-full bg-black text-white font-bold py-4 text-center hover:bg-gray-800 transition-colors uppercase tracking-widest flex justify-center items-center gap-2 group">
                Číst víc 
                <span className="transform group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CTA Block (Connects back to Studio MVP) */}
      <div className="mt-20 bg-brand-pink border-4 border-black shadow-hard p-8 text-center">
        <h2 className="text-3xl font-black text-white uppercase mb-4 text-outline">
          Chceš být mezi nimi?
        </h2>
        <p className="text-white font-bold text-xl mb-6">
          Zkušebna je otevřená. Nahraj svůj track hned teď.
        </p>
        <Button onClick={() => onNavigate(AppRoute.STUDIO)} variant="secondary" size="lg" className="text-brand-pink border-black">
          VSTOUPIT DO STUDIA
        </Button>
      </div>

    </div>
  );
};