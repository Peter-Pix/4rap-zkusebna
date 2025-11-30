import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { StudioPage } from './pages/StudioPage';
import { ProfilePage } from './pages/ProfilePage';
import { AppRoute, Recording } from './types';
import { STORAGE_KEY } from './constants';

const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(AppRoute.HOME);
  const [recordings, setRecordings] = useState<Recording[]>([]);

  // Load recordings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecordings(parsed);
      }
    } catch (error) {
      console.error("Failed to load recordings from localStorage", error);
    }
  }, []);

  // Save recordings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recordings));
    } catch (error) {
      console.error("Failed to save recordings to localStorage (likely quota exceeded)", error);
      // Optional: Alert user if storage is full
    }
  }, [recordings]);

  const handleSaveRecording = (newRecording: Recording) => {
    setRecordings(prev => [newRecording, ...prev]);
    setCurrentRoute(AppRoute.PROFILE);
  };

  const handleDeleteRecording = (id: string) => {
    setRecordings(prev => prev.filter(r => r.id !== id));
  };

  const renderPage = () => {
    switch (currentRoute) {
      case AppRoute.HOME:
        return <HomePage onNavigate={setCurrentRoute} />;
      case AppRoute.STUDIO:
        return <StudioPage onSaveRecording={handleSaveRecording} />;
      case AppRoute.PROFILE:
        return <ProfilePage recordings={recordings} onDelete={handleDeleteRecording} />;
      default:
        return <HomePage onNavigate={setCurrentRoute} />;
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark text-brand-text font-sans selection:bg-brand-accent selection:text-white">
      <main className="min-h-screen">
        {renderPage()}
      </main>
      <Navbar currentRoute={currentRoute} onNavigate={setCurrentRoute} />
    </div>
  );
};

export default App;