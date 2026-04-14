import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { supabase, Trip, TripItem, Todo } from '../lib/supabase';
import { Map } from './Map';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  ArrowLeft, Plus, MapPin, Plane, Hotel, Activity, Car, Trash2, Copy, Check,
  Train, Loader2, FileText, X, Pencil, ListTodo, GripVertical, WifiOff,
  Euro, CalendarDays, Navigation, ChevronRight, Settings2,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format, isSameDay, differenceInDays, differenceInCalendarDays, differenceInMinutes } from 'date-fns';
import { de } from 'date-fns/locale';
import { Switch } from './ui/switch';
import { importLibrary } from '@googlemaps/js-api-loader';
import { fetchDrivingRoute, buildGoogleMapsNavigationUrl, type DrivingRouteInfo } from '../lib/drivingDirections';
import { tripShareUrl } from '../lib/tripUrl';
import { UndoSnackbar } from './UndoSnackbar';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const typeIcons = {
  location: MapPin,
  flight: Plane,
  accommodation: Hotel,
  activity: Activity,
  transport: Car,
  train: Train,
};

const typeLabels: Record<string, string> = {
  location: 'Ort',
  flight: 'Flug',
  accommodation: 'Unterkunft',
  activity: 'Aktivität',
  transport: 'Transport',
  train: 'Zug',
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -10, scale: 0.98, boxShadow: '0 2px 10px rgba(0,0,0,0), 0 0 0 0px transparent' },
  visible: (i: number) => ({
    opacity: 1, x: 0, scale: 1,
    boxShadow: '0 2px 10px rgba(0,0,0,0.03), 0 0 0 0px transparent',
    transition: { delay: i * 0.04, duration: 0.28, ease: EASE },
  }),
  dragging: {
    scale: 1.03,
    opacity: 0.95,
    boxShadow: '0 20px 40px -8px rgba(0,0,0,0.15), 0 0 0 2px oklch(0.24 0.030 255 / 30%)',
    transition: { type: 'spring', stiffness: 400, damping: 25 }
  },
  selected: {
    scale: 1,
    boxShadow: '0 4px 12px rgba(0,0,0,0.05), 0 0 0 2px oklch(0.24 0.030 255 / 20%)',
    transition: { duration: 0.2 }
  }
};

const todoVariants: Variants = {
  hidden: { opacity: 0, y: 6, scale: 0.98, boxShadow: '0 2px 10px rgba(0,0,0,0)' },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    boxShadow: '0 2px 10px rgba(0,0,0,0)',
    transition: { delay: i * 0.03, duration: 0.22, ease: EASE },
  }),
  dragging: {
    scale: 1.03,
    opacity: 0.95,
    boxShadow: '0 16px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px oklch(0.24 0.030 255 / 20%)',
    transition: { type: 'spring', stiffness: 400, damping: 25 }
  }
};

/** Panel slide variants – slides left/right based on direction */
const panelVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24, filter: 'blur(3px)' }),
  center: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.28, ease: EASE } },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24, filter: 'blur(3px)', transition: { duration: 0.2, ease: EASE } }),
};

const TABS = ['timeline', 'todos', 'map'] as const;
type Tab = typeof TABS[number];

/** Returns +1 (slide left→right) or -1 (slide right→left) */
function direction(from: Tab, to: Tab) {
  return TABS.indexOf(to) > TABS.indexOf(from) ? 1 : -1;
}

/* ── Shared form components ── */
const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{children}</Label>
);
const Field = ({ children }: { children: React.ReactNode }) => (
  <div className="space-y-1.5">{children}</div>
);
const inputCls = "h-8 sm:h-9 rounded-lg sm:rounded-xl border-border bg-white text-sm focus:ring-1 focus:ring-foreground/20";

export function TripView({ tripId, onBack }: { tripId: string; onBack: () => void }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<TripItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TripItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('timeline');
  const [prevTab, setPrevTab] = useState<Tab>('timeline');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isEditTripOpen, setIsEditTripOpen] = useState(false);
  const [editTripTitle, setEditTripTitle] = useState('');
  const [editTripDescription, setEditTripDescription] = useState('');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoText, setEditingTodoText] = useState('');
  const [transportRoutes, setTransportRoutes] = useState<Record<string, DrivingRouteInfo | undefined>>({});
  const [tripLoading, setTripLoading] = useState(true);
  const [tripNotFound, setTripNotFound] = useState(false);
  const [undoKey, setUndoKey] = useState(0);
  const [undoState, setUndoState] = useState<{ message: string; onUndo: () => Promise<void> } | null>(null);
  const dismissUndo = useCallback(() => setUndoState(null), []);

  const processedItems = React.useMemo(() => {
    const tripCostForItemType = (type: TripItem['type']): number | undefined => {
      if (type === 'flight') return trip?.flight_cost;
      if (type === 'train') return trip?.train_cost;
      if (type === 'transport') return trip?.transport_cost;
      return undefined;
    };

    return items.map(item => {
      if (['flight', 'train', 'transport'].includes(item.type) && item.booking_reference) {
        const group = items.filter(i => ['flight', 'train', 'transport'].includes(i.type) && i.booking_reference === item.booking_reference);
        if (group.length > 1) {
          const sumItemCosts = group.reduce((sum, i) => sum + (i.cost || 0), 0);
          const sameType = group.every(i => i.type === item.type);
          const tripBookingTotal = sameType ? tripCostForItemType(item.type) : undefined;
          const totalGroupCost =
            tripBookingTotal != null && tripBookingTotal > 0 ? tripBookingTotal : sumItemCosts;
          const itemWithFile = group.find(i => i.file_data);
          
          return {
            ...item,
            displayCost: totalGroupCost > 0 ? totalGroupCost / group.length : undefined,
            isSharedCost: totalGroupCost > 0,
            file_data: itemWithFile?.file_data || item.file_data,
            file_name: itemWithFile?.file_name || item.file_name,
          };
        }
      }
      return { 
        ...item, 
        displayCost: item.cost, 
        isSharedCost: false 
      };
    });
  }, [items, trip?.flight_cost, trip?.train_cost, trip?.transport_cost]);

  const tripDateRange = React.useMemo(() => {
    if (items.length === 0) return null;
    const starts = items.map(i => i.start_time).filter(Boolean) as string[];
    const ends = items.map(i => i.end_time).filter(Boolean) as string[];
    if (starts.length === 0) return null;
    
    const min = new Date(Math.min(...starts.map(d => +new Date(d))));
    const max = ends.length 
      ? new Date(Math.max(...ends.map(d => +new Date(d))))
      : min;
      
    return { min, max };
  }, [items]);

  const changeTab = (next: Tab) => {
    setPrevTab(activeTab);
    setActiveTab(next);
  };

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  /* ── Todos ── */
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoText, setNewTodoText] = useState('');

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('todos').select('*').eq('trip_id', tripId).order('todo_order', { ascending: true });
      if (data) setTodos(data);
    };
    fetch();
    const ch = supabase.channel(`todos_${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos', filter: `trip_id=eq.${tripId}` }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    const opt: Todo = { id: `tmp-${Date.now()}`, trip_id: tripId, text: newTodoText.trim(), completed: false, todo_order: todos.length, created_at: new Date().toISOString() };
    setTodos(p => [...p, opt]);
    setNewTodoText('');
    await supabase.from('todos').insert({ trip_id: tripId, text: opt.text, completed: false, todo_order: todos.length, created_at: opt.created_at });
  };
  const toggleTodo = async (todo: Todo) => {
    setTodos(p => p.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t));
    await supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id);
  };
  const deleteTodo = async (id: string) => {
    setTodos(p => p.filter(t => t.id !== id));
    await supabase.from('todos').delete().eq('id', id);
  };
  const handleTodoDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const arr = [...todos];
    const [it] = arr.splice(result.source.index, 1);
    arr.splice(result.destination.index, 0, it);
    setTodos(arr);
    for (let i = 0; i < arr.length; i++) await supabase.from('todos').update({ todo_order: i }).eq('id', arr[i].id);
  };
  const handleUpdateTodoText = async (id: string) => {
    if (!editingTodoText.trim()) { setEditingTodoId(null); return; }
    setTodos(p => p.map(t => t.id === id ? { ...t, text: editingTodoText.trim() } : t));
    await supabase.from('todos').update({ text: editingTodoText.trim() }).eq('id', id);
    setEditingTodoId(null);
  };

  const handleDeleteItem = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const snapshot = items.find(i => i.id === id);
    if (!snapshot) return;
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) {
      console.error('Error deleting item:', error);
      alert('Fehler beim Löschen');
    } else {
      setItems(prev => prev.filter(i => i.id !== id));
      setUndoKey(k => k + 1);
      setUndoState({
        message: `„${snapshot.title}“ gelöscht`,
        onUndo: async () => {
          const { error: insErr } = await supabase.from('items').insert(snapshot);
          if (insErr) {
            console.error(insErr);
            alert('Rückgängig war nicht möglich.');
            return;
          }
        },
      });
    }
  };

  /* ── Item form state ── */
  const [newItemType, setNewItemType] = useState<TripItem['type']>('location');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemLocation, setNewItemLocation] = useState('');
  const [newItemEndLocation, setNewItemEndLocation] = useState('');
  const [newItemStartTime, setNewItemStartTime] = useState('');
  const [newItemEndTime, setNewItemEndTime] = useState('');
  const [newItemAllDay, setNewItemAllDay] = useState(false);
  const [newItemCost, setNewItemCost] = useState('');
  const [newItemBookingRef, setNewItemBookingRef] = useState('');
  const [newItemFileData, setNewItemFileData] = useState<string | undefined>();
  const [newItemFileName, setNewItemFileName] = useState<string | undefined>();

  const totalCost = items.reduce((s, i) => (i.type === 'flight' || i.type === 'train' || i.type === 'transport' ? s : s + (i.cost || 0)), 0)
    + (trip?.flight_cost || 0) + (trip?.train_cost || 0) + (trip?.transport_cost || 0);

  useEffect(() => {
    const fetchTrip = async () => {
      const { data } = await supabase.from('trips').select('*').eq('id', tripId).maybeSingle();
      setTripLoading(false);
      if (data) {
        setTrip(data);
        setTripNotFound(false);
        setEditTripTitle(data.title);
        setEditTripDescription(data.description || '');
      } else {
        setTrip(null);
        setTripNotFound(true);
        setItems([]);
      }
    };
    const fetchItems = async () => {
      const { data } = await supabase.from('items').select('*').eq('trip_id', tripId).order('item_order', { ascending: true });
      if (data) setItems(data);
    };
    setTripLoading(true);
    setTripNotFound(false);
    fetchTrip();
    fetchItems();
    const chItems = supabase
      .channel(`items_${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `trip_id=eq.${tripId}` }, fetchItems)
      .subscribe();
    const chTrip = supabase
      .channel(`trip_row_${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, () => {
        void fetchTrip();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(chItems);
      supabase.removeChannel(chTrip);
    };
  }, [tripId]);

  useEffect(() => {
    if (!trip || items.length === 0) return;
    const starts = items.map(i => i.start_time).filter(Boolean) as string[];
    const ends   = items.map(i => i.end_time).filter(Boolean) as string[];
    const min = starts.length ? new Date(Math.min(...starts.map(d => +new Date(d)))).toISOString() : null;
    const max = ends.length   ? new Date(Math.max(...ends.map(d => +new Date(d)))).toISOString()   : min;
    if (trip.start_date !== min || trip.end_date !== max)
      supabase.from('trips').update({ start_date: min, end_date: max }).eq('id', tripId);
  }, [items, trip?.start_date, trip?.end_date, tripId]);

  useEffect(() => {
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) return;
    const list = items.filter(
      (i) =>
        i.type === 'transport' &&
        typeof i.lat === 'number' &&
        typeof i.lng === 'number' &&
        typeof i.end_lat === 'number' &&
        typeof i.end_lng === 'number' &&
        !Number.isNaN(i.lat) &&
        !Number.isNaN(i.lng) &&
        !Number.isNaN(i.end_lat) &&
        !Number.isNaN(i.end_lng),
    );
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        list.map(async (it) => {
          const info = await fetchDrivingRoute(
            { lat: it.lat!, lng: it.lng! },
            { lat: it.end_lat!, lng: it.end_lng! },
            it.start_time ? new Date(it.start_time) : null,
          );
          return [it.id, info ?? undefined] as const;
        }),
      );
      if (cancelled) return;
      setTransportRoutes(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const prevItems = [...items];
    const arr = [...items];
    const [it] = arr.splice(result.source.index, 1);
    arr.splice(result.destination.index, 0, it);
    setItems(arr);
    for (let i = 0; i < arr.length; i++) await supabase.from('items').update({ item_order: i }).eq('id', arr[i].id);
    setUndoKey(k => k + 1);
    setUndoState({
      message: 'Reihenfolge geändert',
      onUndo: async () => {
        setItems(prevItems);
        for (let i = 0; i < prevItems.length; i++) {
          await supabase.from('items').update({ item_order: i }).eq('id', prevItems[i].id);
        }
      },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) { alert('Max. 5 MB.'); return; }
    setNewItemFileName(file.name);
    const r = new FileReader();
    r.onloadend = () => setNewItemFileData(r.result as string);
    r.readAsDataURL(file);
  };

  const geocode = async (address: string) => {
    try {
      const lib = await importLibrary('geocoding') as google.maps.GeocodingLibrary;
      const res = await new lib.Geocoder().geocode({ address });
      if (res.results?.length) return { lat: res.results[0].geometry.location.lat(), lng: res.results[0].geometry.location.lng() };
    } catch { /* noop */ }
    return null;
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSaving(true);
    try {
      const start = newItemLocation ? await geocode(newItemLocation) : null;
      const end   = newItemEndLocation ? await geocode(newItemEndLocation) : null;
      if (['flight', 'train', 'transport'].includes(newItemType) && newItemCost) {
        const cf = newItemType === 'flight' ? 'flight_cost' : newItemType === 'train' ? 'train_cost' : 'transport_cost';
        await supabase.from('trips').update({ [cf]: parseFloat(newItemCost) || 0 }).eq('id', tripId);
      }
      const payload: any = {
        trip_id: tripId, type: newItemType, title: newItemTitle,
        location_name: newItemLocation || undefined, lat: start?.lat, lng: start?.lng,
        end_location_name: newItemEndLocation || undefined, end_lat: end?.lat, end_lng: end?.lng,
        start_time: newItemStartTime ? new Date(newItemStartTime).toISOString() : undefined,
        end_time:   newItemEndTime   ? new Date(newItemEndTime).toISOString()   : undefined,
        is_all_day: newItemAllDay,
        cost: newItemCost ? parseFloat(newItemCost) : undefined,
        booking_reference: newItemBookingRef || undefined,
        file_data: newItemFileData, file_name: newItemFileName,
        item_order: items.length, created_at: new Date().toISOString(),
      };
      if (newItemBookingRef && !newItemFileData) {
        const same = items.find(i => i.booking_reference === newItemBookingRef);
        if (same) { payload.file_data = same.file_data; payload.file_name = same.file_name; }
      }
      const { data: inserted } = await supabase.from('items').insert(payload).select().single();
      if (inserted) setItems(prev => [...prev, inserted]);
      setIsAddItemOpen(false); resetForm();
    } catch (err) { console.error(err); }
    finally { setIsSaving(false); }
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingItem) return; setIsSaving(true);
    try {
      let lat = editingItem.lat, lng = editingItem.lng, eLat = editingItem.end_lat, eLng = editingItem.end_lng;
      if (newItemLocation !== editingItem.location_name || lat == null) {
        const r = newItemLocation ? await geocode(newItemLocation) : null;
        lat = r?.lat; lng = r?.lng;
      }
      if (newItemEndLocation !== editingItem.end_location_name || eLat == null) {
        const r = newItemEndLocation ? await geocode(newItemEndLocation) : null;
        eLat = r?.lat; eLng = r?.lng;
      }
      if (['flight', 'train', 'transport'].includes(newItemType) && newItemCost) {
        const cf = newItemType === 'flight' ? 'flight_cost' : newItemType === 'train' ? 'train_cost' : 'transport_cost';
        await supabase.from('trips').update({ [cf]: parseFloat(newItemCost) || 0 }).eq('id', tripId);
      }
      const updates: Partial<TripItem> = {
        type: newItemType, title: newItemTitle,
        location_name: newItemLocation || undefined, lat, lng,
        end_location_name: newItemEndLocation || undefined, end_lat: eLat, end_lng: eLng,
        start_time: newItemStartTime ? new Date(newItemStartTime).toISOString() : undefined,
        end_time:   newItemEndTime   ? new Date(newItemEndTime).toISOString()   : undefined,
        is_all_day: newItemAllDay,
        cost: newItemCost ? parseFloat(newItemCost) : undefined,
        booking_reference: newItemBookingRef || undefined,
        file_data: newItemFileData, file_name: newItemFileName,
      };
      const { data: updated } = await supabase.from('items').update(updates).eq('id', editingItem.id).select().single();
      if (updated) {
        setItems(prev => prev.map(i => i.id === editingItem.id ? updated : i));
      }
      if (newItemBookingRef && newItemFileData !== editingItem.file_data) {
        for (const it of items.filter(i => i.booking_reference === newItemBookingRef && i.id !== editingItem.id)) {
          const { data: synced } = await supabase.from('items').update({ file_data: newItemFileData, file_name: newItemFileName }).eq('id', it.id).select().single();
          if (synced) setItems(prev => prev.map(i => i.id === synced.id ? synced : i));
        }
      }
      setIsEditItemOpen(false); setEditingItem(null); resetForm();
    } catch (err) { console.error(err); }
    finally { setIsSaving(false); }
  };

  const handleUpdateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await supabase.from('trips').update({
        title: editTripTitle,
        description: editTripDescription
      }).eq('id', tripId);
      setTrip(prev => prev ? { ...prev, title: editTripTitle, description: editTripDescription } : null);
      setIsEditTripOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setNewItemType('location'); setNewItemTitle(''); setNewItemLocation('');
    setNewItemEndLocation(''); setNewItemStartTime(''); setNewItemEndTime('');
    setNewItemAllDay(false); setNewItemCost(''); setNewItemBookingRef('');
    setNewItemFileData(undefined); setNewItemFileName(undefined);
  };

  const openEditDialog = (item: TripItem) => {
    setEditingItem(item); setNewItemType(item.type); setNewItemTitle(item.title);
    setNewItemLocation(item.location_name || ''); setNewItemEndLocation(item.end_location_name || '');
    setNewItemStartTime(item.start_time ? format(new Date(item.start_time), item.is_all_day ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm") : '');
    setNewItemEndTime(item.end_time ? format(new Date(item.end_time), item.is_all_day ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm") : '');
    setNewItemAllDay(item.is_all_day || false);
    setNewItemCost(
      item.type === 'flight' ? (trip?.flight_cost?.toString() || '') :
      item.type === 'train'  ? (trip?.train_cost?.toString()  || '') :
      item.type === 'transport' ? (trip?.transport_cost?.toString() || '') :
      (item.cost?.toString() || '')
    );
    setNewItemBookingRef(item.booking_reference || '');
    setNewItemFileData(item.file_data); setNewItemFileName(item.file_name);
    setIsEditItemOpen(true);
  };

  const [isCopied, setIsCopied] = useState(false);
  const copyTripId = () => {
    navigator.clipboard.writeText(tripShareUrl(tripId));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const formatDateRange = (start?: string, end?: string, allDay?: boolean) => {
    if (!start) return null;
    const startDate = new Date(start);
    if (!end) {
      return (
        <span>
          {allDay
            ? format(startDate, 'eee. dd.MM', { locale: de })
            : format(startDate, "eee. dd.MM HH:mm 'Uhr'", { locale: de })}
        </span>
      );
    }
    const endDate = new Date(end);
    if (allDay) {
      if (isSameDay(startDate, endDate)) {
        return <span>{format(startDate, 'eee. dd.MM', { locale: de })}</span>;
      }
      return (
        <div className="flex flex-col">
          <span>{format(startDate, 'eee. dd.MM', { locale: de })}</span>
          <span className="text-muted-foreground/70">{format(endDate, 'eee. dd.MM', { locale: de })}</span>
        </div>
      );
    }
    
    if (isSameDay(startDate, endDate)) {
      return (
        <div className="flex flex-col">
          <span>{format(startDate, 'eee. dd.MM HH:mm', { locale: de })} Uhr</span>
          <span className="text-muted-foreground/70">Bis {format(endDate, 'HH:mm', { locale: de })} Uhr</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col">
        <span>{format(startDate, 'eee. dd.MM HH:mm', { locale: de })} Uhr</span>
        <span className="text-muted-foreground/70">Bis {format(endDate, 'eee. dd.MM HH:mm', { locale: de })} Uhr</span>
      </div>
    );
  };

  const getDurationLabel = (item: TripItem): string | null => {
    if (!item.start_time || !item.end_time) return null;
    const start = new Date(item.start_time);
    const end = new Date(item.end_time);

    if (item.type === 'accommodation') {
      const nights = differenceInCalendarDays(end, start);
      if (nights > 0) return `${nights} Nacht${nights > 1 ? 'e' : ''}`.replace('Nachte', 'Nächte');
      return null;
    }

    if (['flight', 'train', 'transport'].includes(item.type)) {
      const mins = differenceInMinutes(end, start);
      if (mins <= 0) return null;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h > 0 && m > 0) return `${h} Std. ${m} Min.`;
      if (h > 0) return `${h} Std.`;
      return `${m} Min.`;
    }

    return null;
  };

  /* ── Day label helper ── */
  const getDayLabel = (item: TripItem, prevItem: TripItem | null): string | null => {
    if (!item.start_time) return null;
    const curr = new Date(item.start_time);
    if (!prevItem?.start_time || !isSameDay(curr, new Date(prevItem.start_time))) {
      return format(curr, 'eee, dd. MMM', { locale: de });
    }
    return null;
  };

  /* ── Item form ── */
  const ItemForm = ({ onSubmit, label }: { onSubmit: (e: React.FormEvent) => void; label: string }) => (
    <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4 pt-2">
      <div className="flex items-center justify-between bg-muted/60 rounded-lg sm:rounded-xl p-2.5 sm:p-3">
        <div>
          <p className="text-xs sm:text-sm font-medium">Ganztägig</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground">Nur Datum anzeigen</p>
        </div>
        <Switch checked={newItemAllDay} onCheckedChange={setNewItemAllDay} />
      </div>
      <Field>
        <FieldLabel>Typ</FieldLabel>
        <Select value={newItemType} onValueChange={(v: any) => setNewItemType(v)}>
          <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="location">Ort</SelectItem>
            <SelectItem value="flight">Flug</SelectItem>
            <SelectItem value="accommodation">Unterkunft</SelectItem>
            <SelectItem value="activity">Aktivität</SelectItem>
            <SelectItem value="transport">Transport</SelectItem>
            <SelectItem value="train">Zug</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Titel</FieldLabel>
        <Input value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} required className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Field>
          <FieldLabel>{newItemType === 'flight' || newItemType === 'transport' || newItemType === 'train' ? 'Start' : 'Ort'}</FieldLabel>
          <Input value={newItemLocation} onChange={e => setNewItemLocation(e.target.value)} className={inputCls} />
        </Field>
        {(newItemType === 'flight' || newItemType === 'transport' || newItemType === 'train') && (
          <Field>
            <FieldLabel>Ziel</FieldLabel>
            <Input value={newItemEndLocation} onChange={e => setNewItemEndLocation(e.target.value)} className={inputCls} />
          </Field>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Field>
          <FieldLabel>{newItemType === 'accommodation' ? 'Check-in' : 'Start'}</FieldLabel>
          <Input type={newItemAllDay ? 'date' : 'datetime-local'} value={newItemStartTime} onChange={e => setNewItemStartTime(e.target.value)} className={inputCls} />
        </Field>
        <Field>
          <FieldLabel>{newItemType === 'accommodation' ? 'Check-out' : 'Ende'}</FieldLabel>
          <Input type={newItemAllDay ? 'date' : 'datetime-local'} value={newItemEndTime} onChange={e => setNewItemEndTime(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Field>
          <FieldLabel>Kosten (€)</FieldLabel>
          <Input type="number" step="0.01" value={newItemCost} onChange={e => setNewItemCost(e.target.value)} placeholder="0.00" className={inputCls} />
        </Field>
        <Field>
          <FieldLabel>Buchung</FieldLabel>
          <Input value={newItemBookingRef} onChange={e => setNewItemBookingRef(e.target.value)} placeholder="XYZ123" className={inputCls} />
        </Field>
      </div>
      <Field>
        <FieldLabel>PDF Datei</FieldLabel>
        <div className="flex items-center gap-2">
          <Input type="file" accept="application/pdf" onChange={handleFileChange}
            className={`${inputCls} flex-1 text-xs file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-muted file:text-foreground`} />
          {newItemFileData && (
            <motion.button type="button" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => { setNewItemFileData(undefined); setNewItemFileName(undefined); }}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors">
              <X className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </div>
        {newItemFileName && <p className="text-xs text-muted-foreground">{newItemFileName}</p>}
      </Field>
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        type="submit" disabled={isSaving}
        className="w-full py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ background: 'var(--gradient-primary)', boxShadow: '0 2px 10px oklch(0.24 0.030 255 / 18%)' }}>
        {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Wird gespeichert…</> : label}
      </motion.button>
    </form>
  );

  /* ── Tab button ── */
  const TabBtn = ({ k, icon: Icon, label }: { k: Tab; icon: React.ElementType; label: string }) => (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => changeTab(k)}
      className="relative flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-medium transition-colors"
      style={{ color: activeTab === k ? 'white' : 'oklch(0.52 0.012 255)' }}
    >
      {activeTab === k && (
        <motion.div
          layoutId="active-tab-pill"
          className="absolute inset-0 rounded-md sm:rounded-lg"
          style={{ background: 'var(--gradient-primary)' }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1 sm:gap-1.5">
        <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        {label}
      </span>
    </motion.button>
  );

  if (tripLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }} className="text-muted-foreground/40">
          <Navigation className="h-7 w-7" />
        </motion.div>
      </div>
    );
  }

  if (tripNotFound || !trip) {
    return (
      <div className="flex flex-col h-dvh bg-background items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground max-w-sm">
          Diese Reise ist nicht verfügbar oder wurde aus der Liste entfernt.
        </p>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBack}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--gradient-primary)', boxShadow: '0 2px 10px oklch(0.24 0.030 255 / 18%)' }}
        >
          Zurück zur Übersicht
        </motion.button>
      </div>
    );
  }

  const dir = direction(prevTab, activeTab);

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* ── Header ── */}
      <header className="glass-header sticky top-0 z-50 px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0 sm:gap-2.5">
            <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
              onClick={onBack}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl border border-border bg-white flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </motion.button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-[13px] sm:text-sm font-semibold truncate max-w-[min(200px,calc(100vw-10.5rem))] lg:max-w-xs">{trip.title}</h1>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} 
                    onClick={() => setIsEditTripOpen(true)}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="h-3 w-3" />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={copyTripId}
                    className="text-muted-foreground hover:text-foreground transition-colors">
                    <AnimatePresence mode="wait">
                      {isCopied
                        ? <motion.div key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="h-3.5 w-3.5 text-green-500" /></motion.div>
                        : <motion.div key="u" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Copy className="h-3.5 w-3.5" /></motion.div>}
                    </AnimatePresence>
                  </motion.button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-0.5 min-w-0">
                {tripDateRange && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-foreground text-background whitespace-nowrap">
                    {format(tripDateRange.min, 'dd.MM.')} - {format(tripDateRange.max, 'dd.MM.yyyy')}
                  </span>
                )}
                {totalCost > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-foreground/70 whitespace-nowrap">
                    {totalCost.toFixed(2)} €
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <AnimatePresence>
              {!isOnline && (
                <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'oklch(0.55 0.20 25 / 8%)', color: 'oklch(0.45 0.18 25)', border: '1px solid oklch(0.55 0.20 25 / 18%)' }}>
                  <WifiOff className="h-3 w-3" />
                  <span className="hidden sm:block">Offline</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add item dialog */}
            <Dialog open={isAddItemOpen} onOpenChange={v => { setIsAddItemOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger render={
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold text-white"
                  style={{ background: 'var(--gradient-primary)', boxShadow: '0 2px 8px oklch(0.24 0.030 255 / 18%)' }}>
                  <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Hinzufügen</span>
                </motion.button>
              } />
              <DialogContent className="glass-card border-0 p-4 sm:p-6 sm:max-w-md shadow-lg">
                <DialogHeader>
                  <DialogTitle className="text-sm sm:text-base font-semibold">Zum Reiseplan hinzufügen</DialogTitle>
                </DialogHeader>
                {ItemForm({ onSubmit: handleAddItem, label: "Hinzufügen" })}
              </DialogContent>
            </Dialog>

            {/* Edit dialog */}
            <Dialog open={isEditItemOpen} onOpenChange={v => { setIsEditItemOpen(v); if (!v) { setEditingItem(null); resetForm(); } }}>
              <DialogContent className="glass-card border-0 p-4 sm:p-6 sm:max-w-md shadow-lg">
                <DialogHeader>
                  <DialogTitle className="text-sm sm:text-base font-semibold">Eintrag bearbeiten</DialogTitle>
                </DialogHeader>
                {ItemForm({ onSubmit: handleEditItem, label: "Änderungen speichern" })}
              </DialogContent>
            </Dialog>

            {/* Edit Trip dialog */}
            <Dialog open={isEditTripOpen} onOpenChange={setIsEditTripOpen}>
              <DialogContent className="glass-card border-0 p-4 sm:p-6 sm:max-w-md shadow-lg">
                <DialogHeader>
                  <DialogTitle className="text-sm sm:text-base font-semibold">Reise anpassen</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUpdateTrip} className="space-y-3 sm:space-y-4 pt-2">
                  <Field>
                    <FieldLabel>Name der Reise</FieldLabel>
                    <Input value={editTripTitle} onChange={e => setEditTripTitle(e.target.value)} required className={inputCls} />
                  </Field>
                  <Field>
                    <FieldLabel>Beschreibung</FieldLabel>
                    <Input value={editTripDescription} onChange={e => setEditTripDescription(e.target.value)} placeholder="z.B. Sommerurlaub 2024" className={inputCls} />
                  </Field>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    type="submit" disabled={isSaving}
                    className="w-full py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: 'var(--gradient-primary)', boxShadow: '0 2px 10px oklch(0.24 0.030 255 / 18%)' }}>
                    {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Wird gespeichert…</> : "Speichern"}
                  </motion.button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel (timeline + todos) with animated tabs ── */}
        <div className="w-full lg:w-[360px] xl:w-[400px] flex-shrink-0 flex flex-col border-r border-border bg-background relative">

          {/* Tab bar – desktop */}
          <div className="hidden lg:flex gap-1 p-1.5 border-b border-border bg-background/95">
            {TabBtn({ k: "timeline", icon: Navigation, label: "Plan" })}
            {TabBtn({ k: "todos", icon: ListTodo, label: "To-Do" })}
          </div>

          {/* Animated panel content */}
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait" custom={dir}>
              {activeTab === 'timeline' && (
                <motion.div
                  key="timeline"
                  custom={dir}
                  variants={panelVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="absolute inset-0 overflow-y-auto p-2.5 sm:p-3 lg:p-4 pb-20 lg:pb-4"
                >
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="timeline">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-0.5 sm:space-y-1">
                          <AnimatePresence initial={false}>
                          {processedItems.map((item, index) => {
                            const Icon = typeIcons[item.type] || MapPin;
                            const titleIsTbd = /tbd/i.test(item.title);
                            const dayLabel = getDayLabel(item as TripItem, index > 0 ? processedItems[index - 1] as TripItem : null);
                            return (
                              <React.Fragment key={item.id}>
                                {/* Day separator */}
                                {dayLabel && (
                                  <motion.div
                                    layout
                                    className="flex items-center gap-2 pt-2 pb-0.5 sm:pt-3 sm:pb-1 first:pt-0"
                                  >
                                    <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                      {dayLabel}
                                    </span>
                                    <div className="flex-1 h-px bg-border" />
                                  </motion.div>
                                )}
                                <Draggable draggableId={item.id} index={index}>
                                  {(provided, snapshot) => {
                                    const isSelected = selectedItemId === item.id;
                                    return (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      style={{
                                        ...provided.draggableProps.style,
                                        zIndex: snapshot.isDragging ? 50 : 'auto',
                                      }}
                                    >
                                      <motion.div
                                        custom={index}
                                        variants={itemVariants}
                                        initial="hidden"
                                        animate={["visible", snapshot.isDragging ? "dragging" : isSelected ? "selected" : ""]}
                                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                        layout="position"
                                        layoutId={`timeline-item-${item.id}`}
                                        transition={{ layout: { type: 'spring', stiffness: 350, damping: 30, mass: 0.8 } }}
                                        onClick={() => setSelectedItemId(isSelected ? null : item.id)}
                                        className={
                                          'glass-card p-2.5 sm:p-3 cursor-pointer group transition-colors transition-shadow ' +
                                          (titleIsTbd
                                            ? '!border-orange-200/95 !bg-orange-50/95 ring-1 ring-orange-200/40 dark:!border-orange-800/60 dark:!bg-orange-950/45 dark:ring-orange-800/35'
                                            : '')
                                        }
                                      >
                                        <div className="flex gap-2 sm:gap-2.5">
                                          {/* Drag handle – visible on hover (desktop) or when selected (mobile) */}
                                          <div
                                            {...(provided.dragHandleProps as any)}
                                            className={
                                              'flex items-center touch-none select-none text-muted-foreground/40 hover:text-muted-foreground transition-opacity -ml-1 ' +
                                              (isSelected || snapshot.isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')
                                            }
                                          >
                                            <GripVertical className="h-4 w-4" />
                                          </div>
                                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 icon-${item.type}`}>
                                          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-1">
                                            <div className="min-w-0">
                                              <h4 className="text-[13px] sm:text-sm font-semibold truncate leading-tight">{item.title}</h4>
                                              {(() => {
                                                const durLabel = getDurationLabel(item as TripItem);
                                                const tr = transportRoutes[item.id];
                                                const navOk =
                                                  item.type === 'transport' &&
                                                  tr &&
                                                  typeof item.lat === 'number' &&
                                                  typeof item.lng === 'number' &&
                                                  typeof item.end_lat === 'number' &&
                                                  typeof item.end_lng === 'number';
                                                if (!navOk && !durLabel) return null;
                                                return (
                                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                    {navOk && (
                                                      <a
                                                        href={buildGoogleMapsNavigationUrl(
                                                          { lat: item.lat!, lng: item.lng! },
                                                          { lat: item.end_lat!, lng: item.end_lng! },
                                                        )}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="inline-flex flex-wrap items-baseline gap-x-1 text-[10px] font-medium text-rose-700/90 hover:text-rose-800 hover:underline underline-offset-2"
                                                      >
                                                        {tr?.durationInTrafficText
                                                          ? `Live: ${tr.durationInTrafficText}`
                                                          : tr?.durationText
                                                            ? `Fahrt: ${tr.durationText}`
                                                            : 'Route in Google Maps'}
                                                        {tr?.distanceText ? (
                                                          <span className="text-muted-foreground font-normal">({tr.distanceText})</span>
                                                        ) : null}
                                                      </a>
                                                    )}
                                                    {durLabel && (
                                                      <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border text-muted-foreground bg-muted/50">
                                                        {durLabel}
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                            </div>
                                            <div className={'flex gap-1 transition-opacity flex-shrink-0 ' + (isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
                                              {item.file_data && (
                                                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                                  onClick={e => { e.stopPropagation(); const w = window.open(); if (w) w.document.write(`<iframe src="${item.file_data}" frameborder="0" style="border:0;width:100%;height:100%"></iframe>`); }}
                                                  className="w-6 h-6 rounded-lg border border-border flex items-center justify-center bg-white text-muted-foreground hover:text-foreground transition-colors">
                                                  <FileText className="h-3.5 w-3.5" />
                                                </motion.button>
                                              )}
                                              <button
                                                onClick={(e) => { e.stopPropagation(); openEditDialog(item as TripItem); }}
                                                className="p-1.5 sm:p-1.5 min-w-[28px] min-h-[28px] sm:min-w-0 sm:min-h-0 rounded-lg border border-border bg-white text-muted-foreground hover:text-foreground hover:border-foreground/15 transition-colors flex items-center justify-center"
                                              >
                                                <Settings2 className="h-3.5 w-3.5" />
                                              </button>
                                              <Dialog>
                                                <DialogTrigger render={
                                                  <button
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-1.5 sm:p-1.5 min-w-[28px] min-h-[28px] sm:min-w-0 sm:min-h-0 rounded-lg border border-border bg-white text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors flex items-center justify-center"
                                                  >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                  </button>
                                                } />
                                                <DialogContent className="glass-card border-0 p-4 sm:p-6 sm:max-w-sm shadow-lg">
                                                  <DialogHeader>
                                                    <DialogTitle className="text-sm sm:text-base font-semibold">Eintrag löschen?</DialogTitle>
                                                    <DialogDescription className="text-sm">
                                                      Möchtest du diesen Eintrag wirklich aus deiner Planung entfernen?
                                                    </DialogDescription>
                                                  </DialogHeader>
                                                  <div className="flex gap-3 pt-4">
                                                    <DialogTrigger render={
                                                      <button className="flex-1 py-2 px-4 rounded-xl text-sm font-medium border border-border">Abbrechen</button>
                                                    } />
                                                    <button
                                                      onClick={(e) => handleDeleteItem(item.id, e)}
                                                      className="flex-1 py-2 px-4 rounded-xl text-sm font-medium bg-destructive text-white"
                                                    >Löschen</button>
                                                  </div>
                                                </DialogContent>
                                              </Dialog>
                                            </div>
                                          </div>
                                          {item.location_name && (
                                            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                              <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                                              <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location_name)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                className="truncate hover:text-foreground hover:underline decoration-foreground/20 underline-offset-2 transition-all"
                                              >
                                                {item.location_name}
                                              </a>
                                              {item.end_location_name && (
                                                <>
                                                  <ChevronRight className="h-2.5 w-2.5 flex-shrink-0" />
                                                  <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.end_location_name)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    className="truncate hover:text-foreground hover:underline decoration-foreground/20 underline-offset-2 transition-all"
                                                  >
                                                    {item.end_location_name}
                                                  </a>
                                                </>
                                              )}
                                            </div>
                                          )}
                                          <div className="mt-1 flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-0.5 sm:gap-y-1 text-[11px] sm:text-xs text-muted-foreground">
                                            {item.start_time && (
                                              <div className="flex items-start gap-1.5 mt-0.5">
                                                <CalendarDays className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0 mt-0.5" />
                                                <span>{formatDateRange(item.start_time, item.end_time, item.is_all_day)}</span>
                                              </div>
                                            )}
                                            {item.displayCost !== undefined && item.displayCost > 0 && (
                                              <div className="flex items-center gap-0.5 font-semibold text-foreground/60 ml-auto">
                                                <span>{item.isSharedCost ? '(anteilig) ' : ''}{item.displayCost.toFixed(2)}</span>
                                                <Euro className="h-3 w-3" />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                    </div>
                                  ); }}
                                </Draggable>
                              </React.Fragment>
                            );
                          })}
                          </AnimatePresence>
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>

                  {items.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.4, ease: EASE }}
                      className="flex flex-col items-center justify-center py-12 sm:py-16 gap-2.5 sm:gap-3 text-center">
                      <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl border border-dashed border-border flex items-center justify-center"
                      >
                        <Navigation className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                      </motion.div>
                      <div>
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">Reiseplan ist leer</p>
                        <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">Füge deinen ersten Eintrag hinzu.</p>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {activeTab === 'todos' && (
                <motion.div
                  key="todos"
                  custom={dir}
                  variants={panelVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="absolute inset-0 overflow-y-auto p-3 sm:p-4 pb-20 lg:pb-4"
                >
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                      <ListTodo className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" />
                    </div>
                    <h2 className="text-xs sm:text-sm font-semibold">To-Do Liste</h2>
                    {todos.length > 0 && (
                      <span className="ml-auto text-[11px] sm:text-xs text-muted-foreground">
                        {todos.filter(t => t.completed).length}/{todos.length}
                      </span>
                    )}
                  </div>

                  <form onSubmit={handleAddTodo} className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                    <Input value={newTodoText} onChange={e => setNewTodoText(e.target.value)} placeholder="Neue Aufgabe…"
                      className="flex-1 h-8 sm:h-9 rounded-lg sm:rounded-xl border-border bg-white text-sm" />
                    <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} type="submit"
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ background: 'var(--gradient-primary)' }}>
                      <Plus className="h-4 w-4" />
                    </motion.button>
                  </form>

                  <DragDropContext onDragEnd={handleTodoDragEnd}>
                    <Droppable droppableId="todos">
                      {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1.5 sm:space-y-2">
                          <AnimatePresence initial={false}>
                          {todos.map((todo, index) => (
                            <Draggable key={todo.id} draggableId={todo.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  style={{
                                    ...provided.draggableProps.style,
                                    zIndex: snapshot.isDragging ? 50 : 'auto',
                                  }}
                                >
                                <motion.div
                                  custom={index}
                                  variants={todoVariants}
                                  initial="hidden"
                                  animate={["visible", snapshot.isDragging ? "dragging" : ""]}
                                  exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                                  layout
                                  transition={{ layout: { type: 'spring', stiffness: 400, damping: 30 } }}
                                  className="glass-card flex items-center gap-2 sm:gap-2.5 p-2.5 sm:p-3 group transition-colors transition-shadow"
                                >
                                  <div {...provided.dragHandleProps} className="text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors">
                                    <GripVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  </div>
                                  <div className="flex items-center gap-2 sm:gap-2.5 flex-1 cursor-pointer" onClick={() => toggleTodo(todo)}>
                                    <motion.div
                                      className="w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0"
                                      animate={{
                                        borderColor: todo.completed ? 'oklch(0.50 0.13 145)' : 'oklch(0.75 0.008 255)',
                                        background: todo.completed ? 'oklch(0.50 0.13 145)' : 'transparent',
                                        scale: 1,
                                      }}
                                      whileTap={{ scale: 0.8 }}
                                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                                    >
                                      <AnimatePresence>
                                        {todo.completed && (
                                          <motion.div
                                            initial={{ scale: 0, rotate: -45 }}
                                            animate={{ scale: 1, rotate: 0 }}
                                            exit={{ scale: 0, rotate: 45 }}
                                            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                                          >
                                            <Check className="h-2.5 w-2.5 text-white" />
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </motion.div>
                                    {editingTodoId === todo.id ? (
                                      <Input
                                        autoFocus
                                        value={editingTodoText}
                                        onChange={e => setEditingTodoText(e.target.value)}
                                        onBlur={() => handleUpdateTodoText(todo.id)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateTodoText(todo.id); if (e.key === 'Escape') setEditingTodoId(null); }}
                                        onClick={e => e.stopPropagation()}
                                        className="h-7 py-0 px-2 rounded-lg border-muted bg-white text-sm flex-1"
                                      />
                                    ) : (
                                      <span 
                                        onClick={(e) => { e.stopPropagation(); setEditingTodoId(todo.id); setEditingTodoText(todo.text); }}
                                        className={`text-[13px] sm:text-sm transition-colors flex-1 py-0.5 ${todo.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                                      >
                                        {todo.text}
                                      </span>
                                    )}
                                  </div>
                                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    onClick={() => deleteTodo(todo.id)}
                                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg border border-border flex items-center justify-center bg-white text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </motion.button>
                                </motion.div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          </AnimatePresence>
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>

                  {todos.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.4, ease: EASE }}
                      className="flex flex-col items-center justify-center py-10 sm:py-12 gap-2.5 sm:gap-3 text-center">
                      <motion.div
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl border border-dashed border-border flex items-center justify-center"
                      >
                        <ListTodo className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                      </motion.div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Keine Aufgaben vorhanden.</p>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Map tab – only visible on mobile inside this panel */}
              {activeTab === 'map' && (
                <motion.div
                  key="map-mobile"
                  custom={dir}
                  variants={panelVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="absolute inset-0 lg:hidden"
                >
                  <Map items={items} selectedItemId={selectedItemId} onSelectItem={setSelectedItemId} transportRoutes={transportRoutes} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile bottom tab nav */}
          <div className="lg:hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-50 pb-[env(safe-area-inset-bottom,0px)]">
            <div className="flex gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-white rounded-full border border-border" style={{ boxShadow: '0 4px 20px oklch(0 0 0 / 10%)' }}>
              {TabBtn({ k: "timeline", icon: Navigation, label: "Plan" })}
              {TabBtn({ k: "todos", icon: ListTodo, label: "To-Do" })}
              {TabBtn({ k: "map", icon: MapPin, label: "Karte" })}
            </div>
          </div>
        </div>

        {/* ── Right panel: Google Maps (always visible on desktop) ── */}
        <div className="hidden lg:block flex-1">
          <Map items={items} selectedItemId={selectedItemId} onSelectItem={setSelectedItemId} transportRoutes={transportRoutes} />
        </div>
      </div>

      <UndoSnackbar
        variant="aboveMobileTabs"
        open={undoState !== null}
        undoKey={undoKey}
        message={undoState?.message ?? ''}
        onUndo={async () => {
          if (undoState) await undoState.onUndo();
        }}
        onDismiss={dismissUndo}
      />
    </div>
  );
}