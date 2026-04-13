import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './components/Dashboard';
import { TripView } from './components/TripView';
import { signInWithGoogle, logOut } from './lib/firebase';
import { Button } from './components/ui/button';
import { Plane, WifiOff } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Lädt...</div>;
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <div className="max-w-md w-full p-8 bg-card rounded-xl shadow-lg text-center border">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <Plane className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Urlaubsplaner</h1>
          <p className="text-muted-foreground mb-8">
            Plane deine Reisen, arbeite mit Freunden zusammen und lass die KI deine Buchungen organisieren.
          </p>
          <Button size="lg" className="w-full" onClick={signInWithGoogle}>
            Mit Google anmelden
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {selectedTripId ? (
        <TripView tripId={selectedTripId} onBack={() => setSelectedTripId(null)} />
      ) : (
        <>
          <header className="border-b px-4 py-2 flex justify-between items-center bg-card sticky top-0 z-50">
            <div className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" />
              <span className="font-bold text-base">Urlaubsplaner</span>
            </div>
            <div className="flex items-center gap-2">
              {!isOnline && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-destructive/10 text-destructive rounded-full text-[10px] font-medium border border-destructive/20">
                  <WifiOff className="h-3 w-3" />
                  <span>Offline</span>
                </div>
              )}
              <span className="text-[10px] text-muted-foreground hidden sm:inline-block max-w-[120px] truncate">{user.email}</span>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={logOut}>Abmelden</Button>
            </div>
          </header>
          <Dashboard onSelectTrip={setSelectedTripId} />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
