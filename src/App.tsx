import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './components/Dashboard';
import { TripView } from './components/TripView';
import { supabase } from './lib/supabase';
import { appHomePath, parseTripIdFromPath, tripPath } from './lib/tripUrl';
import { oauthRateLimitStatus, recordOAuthAttempt } from './lib/oauthRateLimit';
import { Input } from './components/ui/input';
import { Plane, WifiOff, LogOut, Compass } from 'lucide-react';

function buildAuthRedirectUrl(): string {
  const base = import.meta.env.BASE_URL;
  const path = base.endsWith('/') ? base.slice(0, -1) : base;
  return path ? `${window.location.origin}${path}` : window.location.origin;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function AppContent() {
  const { user, loading } = useAuth();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? parseTripIdFromPath() : null,
  );
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [authLimitMessage, setAuthLimitMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [magicLinkSending, setMagicLinkSending] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    const onPop = () => setSelectedTripId(parseTripIdFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!user) return;
    const id = parseTripIdFromPath();
    if (id) setSelectedTripId(id);
  }, [user]);

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

  const selectTrip = (tripId: string) => {
    setSelectedTripId(tripId);
    window.history.pushState({ screen: 'trip' }, '', tripPath(tripId));
  };

  const exitTrip = () => {
    if (parseTripIdFromPath() && window.history.length > 1) {
      window.history.back();
    } else {
      window.history.replaceState({}, '', appHomePath());
      setSelectedTripId(null);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setMagicLinkError('Bitte eine E-Mail-Adresse eingeben.');
      return;
    }
    const limit = oauthRateLimitStatus();
    if (limit.ok === false) {
      setAuthLimitMessage(
        `Zu viele Anmeldeversuche. Bitte in etwa ${limit.retryAfterSec} Sekunden erneut versuchen.`,
      );
      return;
    }
    setAuthLimitMessage(null);
    setMagicLinkError(null);
    setMagicLinkSent(false);
    recordOAuthAttempt();
    setMagicLinkSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: buildAuthRedirectUrl() },
    });
    setMagicLinkSending(false);
    if (error) {
      setMagicLinkError(error.message);
      return;
    }
    setMagicLinkSent(true);
  };

  const handleSignOut = async () => {
    setSelectedTripId(null);
    window.history.replaceState({}, '', appHomePath());
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-3"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            className="text-foreground/30"
          >
            <Compass className="h-7 w-7" />
          </motion.div>
          <p className="text-sm text-muted-foreground">Lädt…</p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center px-4 bg-grid">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="w-full max-w-sm"
        >
          <div className="glass-card p-5 sm:p-8 text-center">
            {/* Logo mark */}
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: EASE }}
              className="mx-auto mb-4 sm:mb-6 w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px oklch(0.24 0.030 255 / 18%)' }}
            >
              <Plane className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.4 }}
            >
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1.5 sm:mb-2">Urlaubsplaner</h1>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-5 sm:mb-7">
                Plane Reisen, arbeite mit Freunden zusammen und behalte alle Buchungen im Blick. Wir schicken dir einen
                Anmeldelink per E-Mail (<span className="text-foreground/80 font-medium">Supabase Auth</span>).
              </p>
            </motion.div>

            {authLimitMessage && (
              <p className="mb-3 text-xs text-center text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
                {authLimitMessage}
              </p>
            )}

            <motion.form
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26, duration: 0.35 }}
              onSubmit={handleSendMagicLink}
              className="text-left space-y-2.5 sm:space-y-3"
            >
              <div className="space-y-1">
                <label htmlFor="auth-email" className="text-[11px] sm:text-xs font-medium text-foreground">
                  E-Mail
                </label>
                <Input
                  id="auth-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="name@beispiel.de"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  disabled={magicLinkSending}
                  className="h-9 sm:h-10"
                />
              </div>
              {magicLinkError && (
                <p className="text-xs text-destructive" role="alert">
                  {magicLinkError}
                </p>
              )}
              {magicLinkSent && (
                <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
                  Link ist unterwegs. Bitte Postfach und Spam prüfen. Der Link führt zurück in diese App.
                </p>
              )}
              <motion.button
                type="submit"
                disabled={magicLinkSending}
                whileHover={{ scale: magicLinkSending ? 1 : 1.02 }}
                whileTap={{ scale: magicLinkSending ? 1 : 0.98 }}
                className="w-full py-2 sm:py-2.5 px-4 sm:px-5 rounded-lg sm:rounded-xl text-sm font-semibold text-white transition-shadow disabled:opacity-60"
                style={{
                  background: 'var(--gradient-primary)',
                  boxShadow: '0 2px 12px oklch(0.24 0.030 255 / 20%)',
                }}
              >
                {magicLinkSending ? 'Sende Link…' : 'Anmeldelink senden'}
              </motion.button>
            </motion.form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">
      <AnimatePresence mode="wait">
        {selectedTripId ? (
          <motion.div
            key="trip"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <TripView tripId={selectedTripId} onBack={exitTrip} />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, x: -32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {/* Header */}
            <header className="glass-header sticky top-0 z-50 px-3 py-2 sm:px-5 sm:py-3">
              <div className="max-w-5xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--gradient-primary)' }}
                  >
                    <Plane className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" />
                  </div>
                  <span className="font-semibold text-xs sm:text-sm text-foreground">Urlaubsplaner</span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <AnimatePresence>
                    {!isOnline && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: 'oklch(0.55 0.20 25 / 8%)',
                          color: 'oklch(0.45 0.18 25)',
                          border: '1px solid oklch(0.55 0.20 25 / 18%)',
                        }}
                      >
                        <WifiOff className="h-3 w-3" />
                        Offline
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <span className="text-xs text-muted-foreground hidden sm:block max-w-[160px] truncate">
                    {user.email}
                  </span>

                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium text-muted-foreground hover:text-foreground border border-border hover:border-foreground/15 transition-colors bg-white/60"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden sm:block">Abmelden</span>
                  </motion.button>
                </div>
              </div>
            </header>

            <Dashboard onSelectTrip={selectTrip} />
          </motion.div>
        )}
      </AnimatePresence>
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