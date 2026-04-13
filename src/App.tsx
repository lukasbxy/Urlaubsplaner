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

function mapPasswordLoginError(message: string, code?: string): string {
  if (code === 'email_not_confirmed') {
    return 'Diese E-Mail ist noch nicht bestätigt. In Supabase unter Authentication → Users den Nutzer als bestätigt markieren oder „Confirm email“ für den E-Mail-Provider deaktivieren.';
  }
  const m = message.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid_credentials') || m.includes('invalid email or password')) {
    return 'E-Mail oder Passwort ist ungültig.';
  }
  if (m.includes('email not confirmed')) {
    return 'E-Mail noch nicht bestätigt. Bitte in der Supabase-Konsole den Nutzer bestätigen oder Bestätigungspflicht abschalten.';
  }
  return message;
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
  const [password, setPassword] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

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

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setLoginError('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    if (!password) {
      setLoginError('Bitte E-Mail und Passwort eingeben.');
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
    setLoginError(null);
    recordOAuthAttempt();
    setLoginSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setLoginSubmitting(false);
    if (error) {
      setLoginError(mapPasswordLoginError(error.message, error.code));
      return;
    }
    setPassword('');
  };

  const handleSignOut = async () => {
    setSelectedTripId(null);
    window.history.replaceState({}, '', appHomePath());
    await supabase.auth.signOut();
  };

  /* Determine which top-level screen to show */
  const screenKey = loading ? 'loading' : !user ? 'login' : 'app';

  return (
    <AnimatePresence mode="wait">
      {/* ── Loading ── */}
      {screenKey === 'loading' && (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.95, filter: 'blur(6px)' }}
          transition={{ duration: 0.4, ease: EASE }}
          className="flex h-dvh items-center justify-center bg-grid"
        >
          <motion.div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
              className="text-foreground/30"
            >
              <Compass className="h-7 w-7" />
            </motion.div>
            <p className="text-sm text-muted-foreground">Lädt…</p>
          </motion.div>
        </motion.div>
      )}

      {/* ── Login ── */}
      {screenKey === 'login' && (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex h-dvh items-center justify-center px-4 bg-grid overflow-hidden"
        >
          {/* Decorative floating shapes behind the card */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 1.2 }}
              className="absolute inset-0"
            >
              <motion.div
                animate={{ y: [0, -18, 0], x: [0, 6, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-[15%] left-[10%] w-48 h-48 sm:w-72 sm:h-72 rounded-full"
                style={{ background: 'oklch(0.24 0.030 255 / 4%)', filter: 'blur(60px)' }}
              />
              <motion.div
                animate={{ y: [0, 14, 0], x: [0, -8, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute bottom-[10%] right-[8%] w-56 h-56 sm:w-80 sm:h-80 rounded-full"
                style={{ background: 'oklch(0.40 0.040 200 / 4%)', filter: 'blur(60px)' }}
              />
              <motion.div
                animate={{ y: [0, 10, 0], x: [0, -5, 0] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                className="absolute top-[40%] right-[20%] w-36 h-36 sm:w-56 sm:h-56 rounded-full"
                style={{ background: 'oklch(0.35 0.035 280 / 3%)', filter: 'blur(50px)' }}
              />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
            className="w-full max-w-sm relative z-10"
          >
            <div className="glass-card p-5 sm:p-8 text-center">
              {/* Logo mark – drops in with spring bounce */}
              <motion.div
                initial={{ scale: 0, opacity: 0, rotate: -30 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.15 }}
                className="mx-auto mb-4 sm:mb-6 w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 20px oklch(0.24 0.030 255 / 18%)' }}
              >
                <Plane className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5, ease: EASE }}
              >
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight mb-1.5 sm:mb-2">Urlaubsplaner</h1>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-5 sm:mb-7">
                  Plane Reisen, arbeite mit Freunden zusammen und behalte alle Buchungen im Blick. Zugang nur mit einem in
                  Supabase angelegten Konto (keine Registrierung in dieser App).
                </p>
              </motion.div>

              {authLimitMessage && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-3 text-xs text-center text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2"
                >
                  {authLimitMessage}
                </motion.p>
              )}

              <motion.form
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.45, ease: EASE }}
                onSubmit={handlePasswordLogin}
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
                    autoComplete="username"
                    placeholder="name@beispiel.de"
                    value={email}
                    onChange={(ev) => {
                      setEmail(ev.target.value);
                      setLoginError(null);
                    }}
                    disabled={loginSubmitting}
                    className="h-9 sm:h-10"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="auth-password" className="text-[11px] sm:text-xs font-medium text-foreground">
                    Passwort
                  </label>
                  <Input
                    id="auth-password"
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="Passwort"
                    value={password}
                    onChange={(ev) => {
                      setPassword(ev.target.value);
                      setLoginError(null);
                    }}
                    disabled={loginSubmitting}
                    className="h-9 sm:h-10"
                  />
                </div>
                <AnimatePresence>
                  {loginError && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs text-destructive overflow-hidden"
                      role="alert"
                    >
                      {loginError}
                    </motion.p>
                  )}
                </AnimatePresence>
                <motion.button
                  type="submit"
                  disabled={loginSubmitting}
                  whileHover={{ scale: loginSubmitting ? 1 : 1.02 }}
                  whileTap={{ scale: loginSubmitting ? 1 : 0.97 }}
                  className="w-full py-2 sm:py-2.5 px-4 sm:px-5 rounded-lg sm:rounded-xl text-sm font-semibold text-white transition-shadow disabled:opacity-60"
                  style={{
                    background: 'var(--gradient-primary)',
                    boxShadow: '0 2px 12px oklch(0.24 0.030 255 / 20%)',
                  }}
                >
                  {loginSubmitting ? 'Anmeldung…' : 'Anmelden'}
                </motion.button>
              </motion.form>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ── Authenticated app ── */}
      {screenKey === 'app' && (
        <motion.div
          key="app"
          initial={{ opacity: 0, scale: 0.97, filter: 'blur(6px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scale: 0.97, filter: 'blur(6px)' }}
          transition={{ duration: 0.4, ease: EASE }}
          className="min-h-dvh bg-grid"
        >
          <AnimatePresence mode="wait">
            {selectedTripId ? (
              <motion.div
                key="trip"
                initial={{ opacity: 0, x: 40, filter: 'blur(4px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -40, filter: 'blur(4px)' }}
                transition={{ duration: 0.32, ease: EASE }}
              >
                <TripView tripId={selectedTripId} onBack={exitTrip} />
              </motion.div>
            ) : (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40, filter: 'blur(4px)' }}
                transition={{ duration: 0.32, ease: EASE }}
              >
                {/* Header */}
                <motion.header
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.05 }}
                  className="glass-header sticky top-0 z-50 px-3 py-2 sm:px-5 sm:py-3"
                >
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
                        {user!.email}
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
                </motion.header>

                <Dashboard onSelectTrip={selectTrip} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
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