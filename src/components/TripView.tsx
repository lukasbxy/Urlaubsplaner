import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, orderBy, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Trip, TripItem } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Plus, Upload, MapPin, Plane, Hotel, Activity, Car, Trash2, Copy, Check, Train, Loader2, FileText, X, Pencil, ListTodo, CheckCircle2, Circle, GripVertical, WifiOff } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { format, differenceInCalendarDays, intervalToDuration, formatDuration, eachDayOfInterval, isSameDay, startOfDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { Switch } from './ui/switch';
import { importLibrary } from '@googlemaps/js-api-loader';

import { Map } from './Map';

const typeIcons = {
  location: MapPin,
  flight: Plane,
  accommodation: Hotel,
  activity: Activity,
  transport: Car,
  train: Train,
};

export function TripView({ tripId, onBack }: { tripId: string, onBack: () => void }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [items, setItems] = useState<TripItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isEditItemOpen, setIsEditItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TripItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [mobileView, setMobileView] = useState<'timeline' | 'map' | 'todos'>('timeline');
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
  
  // To-Do state
  const [todos, setTodos] = useState<{id: string, text: string, completed: boolean, order: number}[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoText, setEditingTodoText] = useState('');

  useEffect(() => {
    const unsubscribeTodos = onSnapshot(
      query(collection(db, `trips/${tripId}/todos`), orderBy('completed', 'asc'), orderBy('order', 'asc')),
      (snapshot) => {
        setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      }
    );
    return () => unsubscribeTodos();
  }, [tripId]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    try {
      await addDoc(collection(db, `trips/${tripId}/todos`), {
        text: newTodoText.trim(),
        completed: false,
        order: todos.length,
        createdAt: new Date().toISOString()
      });
      setNewTodoText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `trips/${tripId}/todos`);
    }
  };

  const toggleTodo = async (todo: any) => {
    try {
      await updateDoc(doc(db, `trips/${tripId}/todos`, todo.id), {
        completed: !todo.completed
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}/todos/${todo.id}`);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await deleteDoc(doc(db, `trips/${tripId}/todos`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `trips/${tripId}/todos/${id}`);
    }
  };

  const handleEditTodo = async (id: string, newText: string) => {
    if (!newText.trim()) return;
    try {
      await updateDoc(doc(db, `trips/${tripId}/todos`, id), {
        text: newText.trim()
      });
      setEditingTodoId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}/todos/${id}`);
    }
  };

  const handleTodoDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const newTodos = [...todos];
    const [reordered] = newTodos.splice(result.source.index, 1);
    newTodos.splice(result.destination.index, 0, reordered);
    setTodos(newTodos);
    try {
      const batch = writeBatch(db);
      newTodos.forEach((t, i) => {
        batch.update(doc(db, `trips/${tripId}/todos`, t.id), { order: i });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error updating todo order", error);
    }
  };
  
  // New item form state
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

  const totalCost = items.reduce((sum, item) => {
    if (item.type === 'flight' || item.type === 'train' || item.type === 'transport') return sum;
    return sum + (item.cost || 0);
  }, 0) + (trip?.flightCost || 0) + (trip?.trainCost || 0) + (trip?.transportCost || 0);

  useEffect(() => {
    const unsubscribeTrip = onSnapshot(doc(db, 'trips', tripId), (docSnap) => {
      if (docSnap.exists()) {
        setTrip({ id: docSnap.id, ...docSnap.data() } as Trip);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `trips/${tripId}`));

    const q = query(
      collection(db, `trips/${tripId}/items`),
      orderBy('order', 'asc')
    );

    const unsubscribeItems = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TripItem[];
      setItems(itemsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `trips/${tripId}/items`));

    return () => {
      unsubscribeTrip();
      unsubscribeItems();
    };
  }, [tripId]);

  // Update trip dates when items change
  useEffect(() => {
    if (!trip || items.length === 0) return;

    const startDates = items.map(i => i.startTime).filter(Boolean) as string[];
    const endDates = items.map(i => i.endTime).filter(Boolean) as string[];
    
    const minDate = startDates.length > 0 ? new Date(Math.min(...startDates.map(d => new Date(d).getTime()))).toISOString() : null;
    const maxDate = endDates.length > 0 ? new Date(Math.max(...endDates.map(d => new Date(d).getTime()))).toISOString() : minDate;

    if (trip.startDate !== minDate || trip.endDate !== maxDate) {
      updateDoc(doc(db, 'trips', tripId), {
        startDate: minDate,
        endDate: maxDate
      }).catch(console.error);
    }
  }, [items, trip?.startDate, trip?.endDate, tripId]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    const newItems = [...items];
    const [reorderedItem] = newItems.splice(sourceIndex, 1);
    newItems.splice(destinationIndex, 0, reorderedItem);

    // Optimistic update
    setItems(newItems);

    // Update orders in Firestore
    try {
      const batch = writeBatch(db);
      newItems.forEach((item, index) => {
        batch.update(doc(db, `trips/${tripId}/items`, item.id), { order: index });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}/items`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5000000) { // ~5MB limit
        alert("Datei ist zu groß. Bitte max. 5MB.");
        return;
      }
      setNewItemFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewItemFileData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      let endLat: number | undefined;
      let endLng: number | undefined;

      if (newItemLocation) {
        const address = newItemLocation.trim();
        try {
          const geocodingLib = await importLibrary('geocoding') as google.maps.GeocodingLibrary;
          const geocoder = new geocodingLib.Geocoder();
          const result = await geocoder.geocode({ address });
          if (result.results && result.results.length > 0) {
            lat = result.results[0].geometry.location.lat();
            lng = result.results[0].geometry.location.lng();
            console.log(`Geocoded "${address}" to ${lat}, ${lng}`);
          }
        } catch (e) {
          console.error("Geocoding failed for start location", e);
        }
      }

      if (newItemEndLocation) {
        const address = newItemEndLocation.trim();
        try {
          const geocodingLib = await importLibrary('geocoding') as google.maps.GeocodingLibrary;
          const geocoder = new geocodingLib.Geocoder();
          const result = await geocoder.geocode({ address });
          if (result.results && result.results.length > 0) {
            endLat = result.results[0].geometry.location.lat();
            endLng = result.results[0].geometry.location.lng();
            console.log(`Geocoded end "${address}" to ${endLat}, ${endLng}`);
          }
        } catch (e) {
          console.error("Geocoding failed for end location", e);
        }
      }

      // Pro-rata cost logic for flight, train, transport
      if ((newItemType === 'flight' || newItemType === 'train' || newItemType === 'transport') && newItemCost) {
        const costField = newItemType === 'flight' ? 'flightCost' : newItemType === 'train' ? 'trainCost' : 'transportCost';
        await updateDoc(doc(db, 'trips', tripId), {
          [costField]: parseFloat(newItemCost) || 0
        });
      }

      const newItem: Partial<TripItem> = {
        tripId,
        type: newItemType,
        title: newItemTitle,
        locationName: newItemLocation || undefined,
        lat,
        lng,
        endLocationName: newItemEndLocation || undefined,
        endLat,
        endLng,
        startTime: newItemStartTime ? new Date(newItemStartTime).toISOString() : undefined,
        endTime: newItemEndTime ? new Date(newItemEndTime).toISOString() : undefined,
        isAllDay: newItemAllDay,
        cost: newItemCost ? parseFloat(newItemCost) : undefined,
        bookingReference: newItemBookingRef || undefined,
        fileData: newItemFileData,
        fileName: newItemFileName,
        order: items.length,
        createdAt: new Date().toISOString(),
      };

      // If booking ref exists, sync file with other items sharing the same ref
      if (newItemBookingRef && !newItemFileData) {
        const sameRefItems = items.filter(i => i.bookingReference === newItemBookingRef);
        if (sameRefItems.length > 0) {
          newItem.fileData = sameRefItems[0].fileData;
          newItem.fileName = sameRefItems[0].fileName;
        }
      }

      const cleanItem = Object.fromEntries(Object.entries(newItem).filter(([_, v]) => v !== undefined));
      await addDoc(collection(db, `trips/${tripId}/items`), cleanItem);
      
      setIsAddItemOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `trips/${tripId}/items`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSaving(true);
    try {
      let lat = editingItem.lat;
      let lng = editingItem.lng;
      let endLat = editingItem.endLat;
      let endLng = editingItem.endLng;

      if (newItemLocation !== editingItem.locationName || lat === undefined) {
        if (newItemLocation) {
          const address = newItemLocation.trim();
          try {
            const geocodingLib = await importLibrary('geocoding') as google.maps.GeocodingLibrary;
            const geocoder = new geocodingLib.Geocoder();
            const result = await geocoder.geocode({ address });
            if (result.results && result.results.length > 0) {
              lat = result.results[0].geometry.location.lat();
              lng = result.results[0].geometry.location.lng();
              console.log(`Geocoded "${address}" to ${lat}, ${lng}`);
            }
          } catch (e) {
            console.error("Geocoding failed for start location", e);
          }
        } else {
          lat = undefined;
          lng = undefined;
        }
      }

      if (newItemEndLocation !== editingItem.endLocationName || endLat === undefined) {
        if (newItemEndLocation) {
          const address = newItemEndLocation.trim();
          try {
            const geocodingLib = await importLibrary('geocoding') as google.maps.GeocodingLibrary;
            const geocoder = new geocodingLib.Geocoder();
            const result = await geocoder.geocode({ address });
            if (result.results && result.results.length > 0) {
              endLat = result.results[0].geometry.location.lat();
              endLng = result.results[0].geometry.location.lng();
              console.log(`Geocoded end "${address}" to ${endLat}, ${endLng}`);
            }
          } catch (e) {
            console.error("Geocoding failed for end location", e);
          }
        } else {
          endLat = undefined;
          endLng = undefined;
        }
      }

      if ((newItemType === 'flight' || newItemType === 'train' || newItemType === 'transport') && newItemCost) {
        const costField = newItemType === 'flight' ? 'flightCost' : newItemType === 'train' ? 'trainCost' : 'transportCost';
        await updateDoc(doc(db, 'trips', tripId), {
          [costField]: parseFloat(newItemCost) || 0
        });
      }

      const updates: Partial<TripItem> = {
        type: newItemType,
        title: newItemTitle,
        locationName: newItemLocation || undefined,
        lat,
        lng,
        endLocationName: newItemEndLocation || undefined,
        endLat,
        endLng,
        startTime: newItemStartTime ? new Date(newItemStartTime).toISOString() : undefined,
        endTime: newItemEndTime ? new Date(newItemEndTime).toISOString() : undefined,
        isAllDay: newItemAllDay,
        cost: newItemCost ? parseFloat(newItemCost) : undefined,
        bookingReference: newItemBookingRef || undefined,
        fileData: newItemFileData,
        fileName: newItemFileName,
      };

      const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined));
      await updateDoc(doc(db, `trips/${tripId}/items`, editingItem.id), cleanUpdates);

      // Sync file across same booking reference if it changed
      if (newItemBookingRef && (newItemFileData !== editingItem.fileData)) {
        const sameRefItems = items.filter(i => i.bookingReference === newItemBookingRef && i.id !== editingItem.id);
        const syncData = Object.fromEntries(Object.entries({
          fileData: newItemFileData,
          fileName: newItemFileName
        }).filter(([_, v]) => v !== undefined));
        
        if (Object.keys(syncData).length > 0) {
          for (const item of sameRefItems) {
            await updateDoc(doc(db, `trips/${tripId}/items`, item.id), syncData);
          }
        }
      }

      setIsEditItemOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}/items/${editingItem.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setNewItemType('location');
    setNewItemTitle('');
    setNewItemLocation('');
    setNewItemEndLocation('');
    setNewItemStartTime('');
    setNewItemEndTime('');
    setNewItemAllDay(false);
    setNewItemCost('');
    setNewItemBookingRef('');
    setNewItemFileData(undefined);
    setNewItemFileName(undefined);
    setEditingItem(null);
  };

  const openEditDialog = (item: TripItem) => {
    setEditingItem(item);
    setNewItemType(item.type);
    setNewItemTitle(item.title);
    setNewItemLocation(item.locationName || '');
    setNewItemEndLocation(item.endLocationName || '');
    setNewItemStartTime(item.startTime ? format(new Date(item.startTime), item.isAllDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm") : '');
    setNewItemEndTime(item.endTime ? format(new Date(item.endTime), item.isAllDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm") : '');
    setNewItemAllDay(item.isAllDay || false);
    setNewItemCost(item.type === 'flight' ? (trip?.flightCost?.toString() || '') : item.type === 'train' ? (trip?.trainCost?.toString() || '') : item.type === 'transport' ? (trip?.transportCost?.toString() || '') : (item.cost?.toString() || ''));
    setNewItemBookingRef(item.bookingReference || '');
    setNewItemFileData(item.fileData);
    setNewItemFileName(item.fileName);
    setIsEditItemOpen(true);
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, `trips/${tripId}/items`, itemId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `trips/${tripId}/items/${itemId}`);
    }
  };

  const [isCopied, setIsCopied] = useState(false);

  const copyTripId = () => {
    navigator.clipboard.writeText(tripId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!trip) return <div>Lädt...</div>;

  const handleUpdateFlightCost = async (cost: string) => {
    try {
      await updateDoc(doc(db, 'trips', tripId), {
        flightCost: parseFloat(cost) || 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `trips/${tripId}`);
    }
  };

  const formatDate = (dateStr: string, isAllDay?: boolean) => {
    const date = new Date(dateStr);
    if (isAllDay) {
      return format(date, 'eee. dd.MM', { locale: de });
    }
    return format(date, "eee. dd.MM HH:mm 'Uhr'", { locale: de });
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b px-4 py-2 flex items-center justify-between bg-card sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base lg:text-lg font-bold truncate max-w-[150px] lg:max-w-none">{trip.title}</h1>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={copyTripId} title="Reise-ID kopieren">
                {isCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {totalCost > 0 && (
                <div className="text-[10px] lg:text-xs font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {totalCost.toFixed(2)}€
                </div>
              )}
              {trip.description && <p className="text-[10px] lg:text-xs text-muted-foreground truncate max-w-[100px] lg:max-w-none">{trip.description}</p>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {!isOnline && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-destructive/10 text-destructive rounded-full text-[10px] font-medium border border-destructive/20">
              <WifiOff className="h-3 w-3" />
              <span>Offline</span>
            </div>
          )}
          <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
            <DialogTrigger render={<Button size="sm" className="gap-1.5 h-8"><Plus className="h-3.5 w-3.5" />Hinzufügen</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Zum Reiseplan hinzufügen</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddItem} className="space-y-4 pt-4">
                <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Ganztägig</Label>
                    <p className="text-[10px] text-muted-foreground">Nur Datum anzeigen, keine Uhrzeit</p>
                  </div>
                  <Switch checked={newItemAllDay} onCheckedChange={setNewItemAllDay} />
                </div>
                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select value={newItemType} onValueChange={(v: any) => setNewItemType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="location">Ort</SelectItem>
                      <SelectItem value="flight">Flug</SelectItem>
                      <SelectItem value="accommodation">Unterkunft</SelectItem>
                      <SelectItem value="activity">Aktivität</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="train">Zug</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Titel</Label>
                  <Input value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{newItemType === 'flight' || newItemType === 'transport' || newItemType === 'train' ? 'Startort' : 'Ort'}</Label>
                    <Input value={newItemLocation} onChange={e => setNewItemLocation(e.target.value)} />
                  </div>
                  {(newItemType === 'flight' || newItemType === 'transport' || newItemType === 'train') && (
                    <div className="space-y-2">
                      <Label>Zielort</Label>
                      <Input value={newItemEndLocation} onChange={e => setNewItemEndLocation(e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{newItemType === 'accommodation' ? 'Check-in' : 'Startdatum'}</Label>
                    <Input type={newItemAllDay ? "date" : "datetime-local"} value={newItemStartTime} onChange={e => setNewItemStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{newItemType === 'accommodation' ? 'Check-out' : 'Ankunft/Ende'}</Label>
                    <Input type={newItemAllDay ? "date" : "datetime-local"} value={newItemEndTime} onChange={e => setNewItemEndTime(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{newItemType === 'flight' || newItemType === 'train' || newItemType === 'transport' ? 'Gesamtkosten (für alle Einträge)' : 'Kosten (€)'}</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={newItemCost} 
                      onChange={e => setNewItemCost(e.target.value)} 
                      placeholder="0.00"
                    />
                    {(newItemType === 'flight' || newItemType === 'train' || newItemType === 'transport') && <p className="text-[10px] text-muted-foreground">Wird auf alle verknüpften Einträge aufgeteilt</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Buchungsreferenz</Label>
                    <Input value={newItemBookingRef} onChange={e => setNewItemBookingRef(e.target.value)} placeholder="z.B. XYZ123" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Datei / Buchungsbestätigung (PDF)</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="file" 
                      accept="application/pdf" 
                      onChange={handleFileChange}
                      className="flex-1"
                    />
                    {newItemFileData && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => { setNewItemFileData(undefined); setNewItemFileName(undefined); }}
                        className="text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {newItemFileName && <p className="text-[10px] text-muted-foreground">Ausgewählt: {newItemFileName}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Wird gespeichert...
                    </>
                  ) : (
                    'Hinzufügen'
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditItemOpen} onOpenChange={setIsEditItemOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Eintrag bearbeiten</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditItem} className="space-y-4 pt-4">
                <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Ganztägig</Label>
                    <p className="text-[10px] text-muted-foreground">Nur Datum anzeigen, keine Uhrzeit</p>
                  </div>
                  <Switch checked={newItemAllDay} onCheckedChange={setNewItemAllDay} />
                </div>
                <div className="space-y-2">
                  <Label>Typ</Label>
                  <Select value={newItemType} onValueChange={(v: any) => setNewItemType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="location">Ort</SelectItem>
                      <SelectItem value="flight">Flug</SelectItem>
                      <SelectItem value="accommodation">Unterkunft</SelectItem>
                      <SelectItem value="activity">Aktivität</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="train">Zug</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Titel</Label>
                  <Input value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{newItemType === 'flight' || newItemType === 'transport' || newItemType === 'train' ? 'Startort' : 'Ort'}</Label>
                    <Input value={newItemLocation} onChange={e => setNewItemLocation(e.target.value)} />
                  </div>
                  {(newItemType === 'flight' || newItemType === 'transport' || newItemType === 'train') && (
                    <div className="space-y-2">
                      <Label>Zielort</Label>
                      <Input value={newItemEndLocation} onChange={e => setNewItemEndLocation(e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{newItemType === 'accommodation' ? 'Check-in' : 'Startdatum'}</Label>
                    <Input type={newItemAllDay ? "date" : "datetime-local"} value={newItemStartTime} onChange={e => setNewItemStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{newItemType === 'accommodation' ? 'Check-out' : 'Ankunft/Ende'}</Label>
                    <Input type={newItemAllDay ? "date" : "datetime-local"} value={newItemEndTime} onChange={e => setNewItemEndTime(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{newItemType === 'flight' || newItemType === 'train' || newItemType === 'transport' ? 'Gesamtkosten (für alle Einträge)' : 'Kosten (€)'}</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={newItemCost} 
                      onChange={e => setNewItemCost(e.target.value)} 
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Buchungsreferenz</Label>
                    <Input value={newItemBookingRef} onChange={e => setNewItemBookingRef(e.target.value)} placeholder="z.B. XYZ123" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Datei / Buchungsbestätigung (PDF)</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="file" 
                      accept="application/pdf" 
                      onChange={handleFileChange}
                      className="flex-1"
                    />
                    {newItemFileData && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => { setNewItemFileData(undefined); setNewItemFileName(undefined); }}
                        className="text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {newItemFileName && <p className="text-[10px] text-muted-foreground">Ausgewählt: {newItemFileName}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Wird gespeichert...
                    </>
                  ) : (
                    'Änderungen speichern'
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Toggle */}
        <div className="lg:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background/90 backdrop-blur-sm rounded-full shadow-lg border p-1 flex gap-1">
          <Button 
            variant={mobileView === 'timeline' ? 'default' : 'ghost'} 
            size="sm" 
            className="rounded-full px-4"
            onClick={() => setMobileView('timeline')}
          >
            Timeline
          </Button>
          <Button 
            variant={mobileView === 'todos' ? 'default' : 'ghost'} 
            size="sm" 
            className="rounded-full px-4"
            onClick={() => setMobileView('todos')}
          >
            To-Do
          </Button>
          <Button 
            variant={mobileView === 'map' ? 'default' : 'ghost'} 
            size="sm" 
            className="rounded-full px-4"
            onClick={() => setMobileView('map')}
          >
            Karte
          </Button>
        </div>

        {/* Desktop Toggle (Sidebar) */}
        <div className="hidden lg:flex absolute top-4 left-4 z-50 bg-background/90 backdrop-blur-sm rounded-md shadow-sm border p-1 gap-1">
          <Button 
            variant={mobileView === 'timeline' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-8 px-3 text-xs gap-1.5"
            onClick={() => setMobileView('timeline')}
          >
            <MapPin className="h-3.5 w-3.5" />
            Plan
          </Button>
          <Button 
            variant={mobileView === 'todos' ? 'secondary' : 'ghost'} 
            size="sm" 
            className="h-8 px-3 text-xs gap-1.5"
            onClick={() => setMobileView('todos')}
          >
            <ListTodo className="h-3.5 w-3.5" />
            To-Do
          </Button>
        </div>

        {/* Timeline Sidebar */}
        <div className={`w-full lg:w-1/3 border-r bg-muted/10 overflow-y-auto p-2 lg:p-4 pb-20 lg:pb-4 pt-16 lg:pt-16 ${mobileView === 'timeline' ? 'block' : 'hidden'} ${mobileView === 'todos' ? 'lg:hidden' : 'lg:block'}`}>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="timeline">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                  {items.map((item, index) => {
                    const Icon = typeIcons[item.type] || MapPin;
                    return (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided) => (
                          <div className="flex gap-2 group">
                            {/* Weekday Indicator Column */}
                            <div className="flex flex-col gap-1 pt-1 min-w-[28px] lg:min-w-[32px]">
                              {(() => {
                                if (!item.startTime) return null;
                                
                                const start = new Date(item.startTime);
                                const end = item.endTime ? new Date(item.endTime) : start;
                                
                                try {
                                  const days = eachDayOfInterval({ 
                                    start: startOfDay(start), 
                                    end: startOfDay(end) 
                                  });

                                  return days.map((day, i) => (
                                    <div 
                                      key={i} 
                                      className="text-[10px] font-bold text-muted-foreground bg-muted/50 rounded px-1 py-0.5 text-center leading-none"
                                      title={format(day, 'dd.MM.yyyy')}
                                    >
                                      {format(day, 'eee', { locale: de })}
                                    </div>
                                  ));
                                } catch (e) {
                                  return (
                                    <div className="text-[10px] font-bold text-muted-foreground bg-muted/50 rounded px-1 py-0.5 text-center leading-none">
                                      {format(start, 'eee', { locale: de })}
                                    </div>
                                  );
                                }
                              })()}
                            </div>

                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-card border rounded-lg p-3 lg:p-4 shadow-sm flex-1 flex gap-3 lg:gap-4 items-start cursor-pointer transition-all ${
                                selectedItemId === item.id ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'
                              } ${item.title.toUpperCase().includes('TBD') ? 'bg-orange-50/50 border-orange-200' : ''}`}
                              onClick={() => setSelectedItemId(item.id)}
                            >
                            <div className={`p-1.5 lg:p-2 rounded-full mt-1 ${
                              item.title.toUpperCase().includes('TBD') ? 'bg-orange-100 text-orange-600' : 'bg-primary/10 text-primary'
                            }`}>
                              <Icon className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-start">
                                <h4 className={`font-semibold text-sm lg:text-base ${item.title.toUpperCase().includes('TBD') ? 'text-orange-700' : ''}`}>
                                  {item.title}
                                </h4>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {item.fileData && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 text-primary" 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        const win = window.open();
                                        if (win) win.document.write(`<iframe src="${item.fileData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                      }}
                                      title="Datei öffnen"
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); openEditDialog(item); }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {item.description && (
                                <p className="text-xs text-primary font-medium mt-1 italic">
                                  {(() => {
                                    if ((item.type === 'transport' || item.type === 'train' || item.type === 'flight') && item.startTime && item.endTime) {
                                      const start = new Date(item.startTime);
                                      const end = new Date(item.endTime);
                                      if (end > start) {
                                        const duration = intervalToDuration({ start, end });
                                        return `Dauer: ${formatDuration(duration, { 
                                          locale: de,
                                          format: ['hours', 'minutes']
                                        })}`;
                                      }
                                    }
                                    return item.description;
                                  })()}
                                </p>
                              )}
                              {item.type === 'accommodation' && item.startTime && item.endTime && (
                                <p className="text-xs text-primary font-medium mt-1 italic">
                                  {(() => {
                                    const nights = differenceInCalendarDays(new Date(item.endTime), new Date(item.startTime));
                                    return `Dauer: ${nights} ${nights === 1 ? 'Nacht' : 'Nächte'}`;
                                  })()}
                                </p>
                              )}
                              {item.locationName && (
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <button
                                    type="button"
                                    className="text-sm text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors text-left"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const query = encodeURIComponent(item.locationName!);
                                      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                                    }}
                                  >
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="underline decoration-dotted underline-offset-2">{item.locationName}</span>
                                  </button>
                                  {item.endLocationName && (item.type === 'flight' || item.type === 'train' || item.type === 'transport') ? (
                                    <>
                                      <span className="text-muted-foreground">→</span>
                                      <button
                                        type="button"
                                        className="text-sm text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors text-left"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const query = encodeURIComponent(item.endLocationName!);
                                          window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                                        }}
                                      >
                                        <MapPin className="h-3 w-3 shrink-0" />
                                        <span className="underline decoration-dotted underline-offset-2">{item.endLocationName}</span>
                                      </button>
                                    </>
                                  ) : item.endLocationName ? (
                                    <span className="text-sm text-muted-foreground">→ {item.endLocationName}</span>
                                  ) : null}
                                </div>
                              )}
                              <div className="flex justify-between items-center mt-2">
                                <div className="text-xs text-muted-foreground">
                                  {item.startTime && (
                                    <p>{formatDate(item.startTime, item.isAllDay)}</p>
                                  )}
                                  {item.endTime && (
                                    <p className="text-[10px]">bis {formatDate(item.endTime, item.isAllDay)}</p>
                                  )}
                                </div>
                                {item.type !== 'flight' && item.type !== 'train' && item.type !== 'transport' && (
                                  <p className="text-xs font-bold text-primary">
                                    {(() => {
                                      if (item.bookingReference) {
                                        const sameRefItems = items.filter(i => i.bookingReference === item.bookingReference);
                                        const totalRefCost = sameRefItems.reduce((sum, i) => sum + (i.cost || 0), 0);
                                        if (sameRefItems.length > 1 && totalRefCost > 0) {
                                          return (
                                            <>
                                              <span className="text-[10px] text-muted-foreground font-normal mr-1">(anteilig)</span>
                                              {(totalRefCost / sameRefItems.length).toFixed(2)}€
                                            </>
                                          );
                                        }
                                      }
                                      return item.cost !== undefined ? `${item.cost.toFixed(2)}€` : null;
                                    })()}
                                  </p>
                                )}
                                {(item.type === 'flight' || item.type === 'train' || item.type === 'transport') && (
                                  <p className="text-xs font-bold text-primary">
                                    <span className="text-[10px] text-muted-foreground font-normal mr-1">(anteilig)</span>
                                    {(((item.type === 'flight' ? trip.flightCost : item.type === 'train' ? trip.trainCost : trip.transportCost) || 0) / (items.filter(i => i.type === item.type).length || 1)).toFixed(2)}€
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2 mt-2">
                                {item.bookingReference && (
                                  <p className="text-xs bg-muted inline-block px-2 py-1 rounded">
                                    Ref: {item.bookingReference}
                                  </p>
                                )}
                                {(item.type === 'transport' || item.type === 'flight' || item.type === 'train') && item.locationName && item.endLocationName && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-6 text-[10px] px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const travelMode = item.type === 'train' ? 'transit' : (item.type === 'flight' ? 'flight' : 'driving');
                                      window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(item.locationName!)}&destination=${encodeURIComponent(item.endLocationName!)}&travelmode=${travelMode}`, '_blank');
                                    }}
                                  >
                                    Route öffnen
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>

                    );
                  })}







                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>


          {items.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <p>Dein Reiseplan ist leer.</p>
              <p className="text-sm mt-2">Füge Einträge hinzu oder importiere ein PDF, um loszulegen.</p>
            </div>
          )}
        </div>

        {/* Todo List Sidebar/View */}
        <div className={`w-full lg:w-1/3 border-r bg-muted/10 overflow-y-auto p-2 lg:p-4 pb-20 lg:pb-4 pt-16 lg:pt-16 ${mobileView === 'todos' ? 'block' : 'hidden'}`}>
          <div className="max-w-md mx-auto">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-primary" />
              To-Do Liste
            </h2>
            
            <form onSubmit={handleAddTodo} className="flex gap-2 mb-6">
              <Input 
                value={newTodoText} 
                onChange={e => setNewTodoText(e.target.value)} 
                placeholder="Neue Aufgabe..." 
                className="flex-1"
              />
              <Button type="submit" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </form>

            <DragDropContext onDragEnd={handleTodoDragEnd}>
              <Droppable droppableId="todos">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {todos.map((todo, index) => (
                      <Draggable key={todo.id} draggableId={todo.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="flex items-center gap-2 bg-card border rounded-lg p-3 group shadow-sm"
                          >
                            <div {...provided.dragHandleProps} className="text-muted-foreground cursor-grab active:cursor-grabbing">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <div className={`flex-1 flex items-center gap-3 text-left transition-colors ${todo.completed ? 'text-muted-foreground' : ''}`}>
                              <button onClick={() => toggleTodo(todo)}>
                                {todo.completed ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                                ) : (
                                  <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                                )}
                              </button>
                              {editingTodoId === todo.id ? (
                                <Input 
                                  value={editingTodoText}
                                  onChange={e => setEditingTodoText(e.target.value)}
                                  onBlur={() => handleEditTodo(todo.id, editingTodoText)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleEditTodo(todo.id, editingTodoText);
                                    if (e.key === 'Escape') setEditingTodoId(null);
                                  }}
                                  autoFocus
                                  className="h-8"
                                />
                              ) : (
                                <span 
                                  className={`flex-1 cursor-text py-1 ${todo.completed ? 'line-through' : ''}`}
                                  onClick={() => {
                                    setEditingTodoId(todo.id);
                                    setEditingTodoText(todo.text);
                                  }}
                                >
                                  {todo.text}
                                </span>
                              )}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteTodo(todo.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {todos.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <p>Keine To-Dos vorhanden.</p>
              </div>
            )}
          </div>
        </div>

        {/* Map Area */}
        <div className={`flex-1 bg-muted relative z-0 overflow-hidden ${mobileView === 'map' ? 'block' : 'hidden lg:block'}`}>
          <Map items={items} selectedItemId={selectedItemId} onSelectItem={setSelectedItemId} />
        </div>
      </div>
    </div>
  );
}
