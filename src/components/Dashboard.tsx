import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Trip } from '../types';
import { useAuth } from './AuthProvider';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { format } from 'date-fns';

export function Dashboard({ onSelectTrip }: { onSelectTrip: (tripId: string) => void }) {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTripTitle, setNewTripTitle] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'trips'),
      where('collaboratorIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tripsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Trip[];
      
      // Also get trips where user is owner (since array-contains might not cover owner if not in array, but we should put owner in collaboratorIds to make it easier, or use an OR query. Firestore OR queries are supported now, but let's just ensure owner is in collaboratorIds).
      setTrips(tripsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trips');
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTripTitle.trim()) return;

    try {
      const newTrip = {
        title: newTripTitle,
        ownerId: user.uid,
        collaboratorIds: [user.uid],
        createdAt: new Date().toISOString(),
      };
      
      const docRef = await addDoc(collection(db, 'trips'), newTrip);
      setIsDialogOpen(false);
      setNewTripTitle('');
      onSelectTrip(docRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'trips');
    }
  };

  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [joinTripId, setJoinTripId] = useState('');

  const handleJoinTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinTripId.trim()) return;

    try {
      const tripRef = doc(db, 'trips', joinTripId.trim());
      const tripSnap = await getDoc(tripRef);
      
      if (tripSnap.exists()) {
        const tripData = tripSnap.data() as Trip;
        if (!tripData.collaboratorIds.includes(user.uid)) {
          await updateDoc(tripRef, {
            collaboratorIds: [...tripData.collaboratorIds, user.uid]
          });
        }
        setIsJoinDialogOpen(false);
        setJoinTripId('');
        onSelectTrip(tripRef.id);
      } else {
        alert("Reise nicht gefunden!");
      }
    } catch (error) {
      console.error("Error joining trip", error);
      alert("Beitritt zur Reise fehlgeschlagen. Bitte überprüfe die ID.");
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-6">
        <h1 className="text-4xl font-bold tracking-tight">Meine Reisen</h1>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
            <DialogTrigger render={<Button variant="outline" className="w-full sm:w-auto h-11 px-6">Reise beitreten</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Einer Reise beitreten</DialogTitle>
                <DialogDescription className="mt-2">
                  Um einer bestehenden Reise beizutreten, frage den Ersteller nach der Reise-ID. 
                  Der Ersteller findet diese in der Reiseansicht oben neben dem Titel (Kopieren-Symbol).
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleJoinTrip} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="tripId">Reise-ID</Label>
                  <Input 
                    id="tripId" 
                    value={joinTripId} 
                    onChange={(e) => setJoinTripId(e.target.value)} 
                    placeholder="Reise-ID hier einfügen"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-11">Beitreten</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger render={<Button className="w-full sm:w-auto h-11 px-6">Neue Reise erstellen</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Reise erstellen</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTrip} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Name der Reise</Label>
                  <Input 
                    id="title" 
                    value={newTripTitle} 
                    onChange={(e) => setNewTripTitle(e.target.value)} 
                    placeholder="z.B. Sommer in Italien"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-11">Erstellen</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed">
          <h3 className="text-lg font-medium text-muted-foreground">Noch keine Reisen</h3>
          <p className="text-sm text-muted-foreground mt-1">Erstelle deine erste Reise, um loszulegen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map(trip => (
            <Card key={trip.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelectTrip(trip.id)}>
              <CardHeader>
                <CardTitle>{trip.title}</CardTitle>
                <CardDescription>
                  {trip.startDate && trip.endDate 
                    ? `${format(new Date(trip.startDate), 'dd.MM.yyyy')} - ${format(new Date(trip.endDate), 'dd.MM.yyyy')}`
                    : 'Daten nicht festgelegt'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {trip.description || 'Keine Beschreibung'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
