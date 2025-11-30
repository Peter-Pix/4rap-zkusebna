import React from 'react';
import { Recording } from '../types';
import { Button } from '../components/Button';
import { Play, Download, Trash2, User } from 'lucide-react';

interface ProfilePageProps {
  recordings: Recording[];
  onDelete: (id: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ recordings, onDelete }) => {
  return (
    <div className="pb-24 px-4 max-w-4xl mx-auto pt-8 md:pt-24">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center mb-10 bg-white p-6 border-4 border-black shadow-hard">
        <div className="w-24 h-24 bg-brand-cyan border-4 border-black flex items-center justify-center mb-4 md:mb-0 md:mr-6">
          <User size={40} className="text-black" strokeWidth={2.5} />
        </div>
        <div className="text-center md:text-left w-full">
          <div className="flex flex-col md:flex-row md:justify-between items-center w-full">
            <div>
              <h1 className="text-3xl font-black text-black uppercase">MC Nováček</h1>
              <p className="text-white bg-black inline-block px-2 font-bold text-sm mt-1">Členem od Březen 2024</p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-2">
                <div className="bg-brand-yellow border-2 border-black px-3 py-1 font-bold text-xs uppercase">5 Tracks</div>
                <div className="bg-brand-purple border-2 border-black px-3 py-1 font-bold text-xs uppercase">Pro</div>
            </div>
          </div>
          <p className="text-gray-600 font-medium text-sm mt-4 max-w-md border-t-2 border-gray-200 pt-2">
            Tady najdeš své uložené demáče. Tohle je jen začátek tvé cesty.
          </p>
        </div>
      </div>

      {/* Recordings List */}
      <h2 className="text-2xl font-black mb-6 uppercase bg-black text-white inline-block px-4 py-2 transform -skew-x-6"> 
        Tvoje Nahrávky ({recordings.length})
      </h2>
      
      {recordings.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 border-4 border-dashed border-gray-300">
          <p className="text-gray-500 font-bold mb-4 uppercase">Zatím jsi nic nenahrál.</p>
          <p className="text-sm text-gray-400">Běž do studia a polož první rýmy.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recordings.map((rec) => (
            <div key={rec.id} className="bg-white p-4 flex flex-col md:flex-row items-center justify-between border-4 border-black shadow-hard hover:translate-x-1 hover:translate-y-1 hover:shadow-hard-hover transition-all">
              <div className="flex items-center space-x-4 w-full md:w-auto mb-4 md:mb-0">
                <div className="w-12 h-12 bg-black flex items-center justify-center text-white">
                  <Play size={20} fill="white" />
                </div>
                <div>
                  <h3 className="font-black text-lg uppercase text-black">{rec.name}</h3>
                  <p className="text-xs font-bold bg-gray-200 inline-block px-1 border border-black">Beat: {rec.beatTitle}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
                <audio controls src={rec.blobUrl} className="h-8 w-32 md:w-48" />
                
                <a 
                  href={rec.blobUrl} 
                  download={`${rec.name.replace(/\s+/g, '_')}.webm`}
                  className="p-3 border-2 border-black bg-brand-cyan hover:bg-cyan-400 text-black transition-colors shadow-[2px_2px_0_0_#000]"
                  title="Stáhnout"
                >
                  <Download size={18} strokeWidth={2.5} />
                </a>
                
                <button 
                  onClick={() => onDelete(rec.id)}
                  className="p-3 border-2 border-black bg-red-500 hover:bg-red-400 text-white transition-colors shadow-[2px_2px_0_0_#000]"
                  title="Smazat"
                >
                  <Trash2 size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};