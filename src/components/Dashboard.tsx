import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { supabase, Trip } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Plus,
  MapPin,
  CalendarDays,
  Compass,
  UserPlus,
  ArrowRight,
  Clock,
  Plane,
  Trash2,
} from 'lucide-react';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.06, duration: 0.4, ease: EASE },
  }),
};

const emptyVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: EASE } },
};

/* ── shared form field ── */
const FormField = ({
  label, value, onChange, placeholder, required,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</Label>
    <Input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="h-9 rounded-xl border-border bg-white text-sm focus:ring-1 focus:ring-foreground/20"
    />
  </div>
);

const PrimaryButton = ({ children, type = 'button', onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    type={type}
    onClick={onClick}
    disabled={disabled}
    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
    style={{ background: 'var(--gradient-primary)', boxShadow: '0 2px 10px oklch(0.24 0.030 255 / 18%)' }}
  >
    {children}
  </motion.button>
);

export function Dashboard({ onSelectTrip }: { onSelectTrip: (tripId: string) => void }) {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchTrips = useCallback(async () => {
    const { data, error } = await supabase
      .from('trips')
      .select('*, items(start_time, end_time, is_all_day)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching trips:', error);
    } else {
      setTrips(data || []);
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchTrips();

    const channel = supabase
      .channel('trips_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, fetchTrips)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchTrips]);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTripTitle.trim()) return;

    const { data, error } = await supabase
      .from('trips')
      .insert({
        title: newTripTitle,
        owner_id: user.id,
        collaborator_ids: [user.id],
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating trip:', error);
      alert('Fehler beim Erstellen der Reise');
    } else {
      setIsDialogOpen(false);
      setNewTripTitle('');
      onSelectTrip(data.id);
    }
  };

  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [joinTripId, setJoinTripId] = useState('');

  const handleJoinTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinTripId.trim()) return;

    const { data, error } = await supabase
      .from('trips')
      .select('collaborator_ids')
      .eq('id', joinTripId.trim())
      .single();

    if (error || !data) { alert('Reise nicht gefunden!'); return; }

    if (!data.collaborator_ids.includes(user.id)) {
      await supabase
        .from('trips')
        .update({ collaborator_ids: [...data.collaborator_ids, user.id] })
        .eq('id', joinTripId.trim());
    }

    setIsJoinDialogOpen(false);
    setJoinTripId('');
    onSelectTrip(joinTripId.trim());
  };

  const handleDeleteTrip = async (tripId: string) => {
    const { error } = await supabase.from('trips').delete().eq('id', tripId);
    if (error) {
      console.error('Error deleting trip:', error);
      alert('Fehler beim Löschen der Reise');
    } else {
      setTrips(p => p.filter(t => t.id !== tripId));
    }
  };

  const getTripDates = (trip: Trip) => {
    if (!trip.items || trip.items.length === 0) {
      return { start: trip.start_date || null, end: trip.end_date || null };
    }
    const starts = trip.items.map(i => i.start_time).filter(Boolean) as string[];
    const ends = trip.items.map(i => i.end_time).filter(Boolean) as string[];
    const min = starts.length ? new Date(Math.min(...starts.map(d => +new Date(d)))).toISOString() : null;
    const max = ends.length ? new Date(Math.max(...ends.map(d => +new Date(d)))).toISOString() : min;
    return { start: min || trip.start_date || null, end: max || trip.end_date || null };
  };

  const getDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const days = Math.round(
      (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000
    );
    return days;
  };

  return (
    <div className="container mx-auto px-5 py-10 max-w-5xl">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Meine Reisen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoaded
              ? trips.length > 0
                ? `${trips.length} Reise${trips.length !== 1 ? 'n' : ''}`
                : 'Keine Reisen vorhanden'
              : '–'}
          </p>
        </div>

        <div className="flex gap-2">
          {/* Join trip */}
          <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
            <DialogTrigger render={
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-border bg-white text-foreground hover:bg-muted transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Beitreten
              </motion.button>
            } />
            <DialogContent className="glass-card border-0 p-6 max-w-sm shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">Reise beitreten</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Frage den Ersteller nach der Reise-ID.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleJoinTrip} className="space-y-4 pt-4">
                <FormField label="Reise-ID" value={joinTripId} onChange={setJoinTripId} placeholder="ID einfügen…" required />
                <PrimaryButton type="submit">Beitreten</PrimaryButton>
              </form>
            </DialogContent>
          </Dialog>

          {/* Create trip */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'var(--gradient-primary)', boxShadow: '0 2px 10px oklch(0.24 0.030 255 / 18%)' }}
              >
                <Plus className="h-3.5 w-3.5" />
                Neue Reise
              </motion.button>
            } />
            <DialogContent className="glass-card border-0 p-6 max-w-sm shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">Neue Reise erstellen</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTrip} className="space-y-4 pt-4">
                <FormField label="Name" value={newTripTitle} onChange={setNewTripTitle} placeholder="z.B. Sommer in Italien" required />
                <PrimaryButton type="submit">Erstellen</PrimaryButton>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Divider */}
      <div className="h-px bg-border mb-8" />

      {/* Content */}
      <AnimatePresence mode="wait">
        {!isLoaded ? (
          /* Skeleton */
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl h-32 shimmer border border-border" />
            ))}
          </motion.div>

        ) : trips.length === 0 ? (
          /* Empty */
          <motion.div
            key="empty"
            variants={emptyVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col items-center justify-center py-24 gap-4"
          >
            <div className="w-16 h-16 rounded-2xl border border-border bg-white flex items-center justify-center">
              <Compass className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">Noch keine Reisen</p>
              <p className="text-sm text-muted-foreground mt-0.5">Erstelle deine erste Reise, um loszulegen.</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setIsDialogOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white mt-1"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Plus className="h-4 w-4" />
              Erste Reise erstellen
            </motion.button>
          </motion.div>

        ) : (
          /* Grid */
          <motion.div key="grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trips.map((trip, i) => {
              const { start, end } = getTripDates(trip);
              const duration = getDuration(start, end);
              return (
                <motion.div
                  key={trip.id}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ y: -3, boxShadow: '0 8px 24px oklch(0 0 0 / 9%), 0 0 0 1px oklch(0 0 0 / 4%)' }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onSelectTrip(trip.id)}
                  className="glass-card p-5 cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--gradient-primary)' }}
                    >
                      <Plane className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger render={
                          <motion.button
                            onClick={e => e.stopPropagation()}
                            whileHover={{ scale: 1.1, color: 'var(--destructive)' }}
                            whileTap={{ scale: 0.9 }}
                            className="text-muted-foreground p-1 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </motion.button>
                        } />
                        <DialogContent className="glass-card border-0 p-6 max-w-sm shadow-lg">
                          <DialogHeader>
                            <DialogTitle>Reise löschen?</DialogTitle>
                            <DialogDescription>
                              Dies kann nicht rückgängig gemacht werden. Alle Pläne und To-Dos gehen verloren.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex gap-3 mt-4">
                            <DialogTrigger render={
                              <button className="flex-1 py-2 px-4 rounded-xl text-sm font-medium border border-border">Abbrechen</button>
                            } />
                            <button
                              onClick={() => handleDeleteTrip(trip.id)}
                              className="flex-1 py-2 px-4 rounded-xl text-sm font-medium bg-destructive text-white"
                            >Löschen</button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <h3 className="font-semibold text-sm text-foreground truncate mb-0.5">{trip.title}</h3>
                  {trip.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{trip.description}</p>
                  )}

                  {/* Meta */}
                  <div
                    className="flex items-center gap-3 mt-4 pt-3 text-xs text-muted-foreground"
                    style={{ borderTop: '1px solid var(--glass-border)' }}
                  >
                    {start ? (
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3 flex-shrink-0" />
                        <span>
                          {end && isSameDay(new Date(start), new Date(end))
                            ? format(new Date(start), 'dd.MM.yy', { locale: de })
                            : `${format(new Date(start), 'dd.MM', { locale: de })}${end ? ` – ${format(new Date(end), 'dd.MM.yy', { locale: de })}` : ''}`
                          }
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Datum offen</span>
                      </div>
                    )}
                    {duration !== null && duration > 0 && (
                      <span className="ml-auto font-medium text-foreground/50">{duration} {duration === 1 ? 'Nacht' : 'Tage'}</span>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Add card */}
            <motion.div
              custom={trips.length}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setIsDialogOpen(true)}
              className="cursor-pointer group flex flex-col items-center justify-center gap-2.5 min-h-[160px] h-full rounded-2xl border border-dashed border-border hover:border-foreground/20 hover:bg-white/60 transition-all"
            >
              <motion.div
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.18 }}
                className="w-9 h-9 rounded-xl border border-border flex items-center justify-center bg-white text-muted-foreground group-hover:text-foreground group-hover:border-foreground/20 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </motion.div>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Neue Reise
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
