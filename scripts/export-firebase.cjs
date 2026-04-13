const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('../REDACTED-firebase-adminsdk.json');

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'REDACTED_PROJECT_ID'
}, 'app');

const db = admin.firestore(app);
db.settings({
  databaseId: '(default)'
});

async function exportData() {
  // List all collections first
  console.log('Listing collections...');
  const collections = await db.listCollections();
  console.log('Collections:', collections.map(c => c.id));
  const outputDir = path.join(__dirname, 'firebase-export');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Export trips collection
  console.log('Exporting trips...');
  const tripsSnapshot = await db.collection('trips').get();
  const trips = [];
  tripsSnapshot.forEach(doc => {
    trips.push({ id: doc.id, ...doc.data() });
  });
  fs.writeFileSync(path.join(outputDir, 'trips.json'), JSON.stringify(trips, null, 2));
  console.log(`Exported ${trips.length} trips`);

  // Export todos and items subcollections for each trip
  const todosExport = [];
  const itemsExport = [];

  for (const trip of trips) {
    const tripId = trip.id;
    
    // Export todos
    const todosSnapshot = await db.collection(`trips/${tripId}/todos`).get();
    todosSnapshot.forEach(doc => {
      todosExport.push({ tripId, id: doc.id, ...doc.data() });
    });

    // Export items
    const itemsSnapshot = await db.collection(`trips/${tripId}/items`).get();
    itemsSnapshot.forEach(doc => {
      itemsExport.push({ tripId, id: doc.id, ...doc.data() });
    });
  }

  fs.writeFileSync(path.join(outputDir, 'todos.json'), JSON.stringify(todosExport, null, 2));
  fs.writeFileSync(path.join(outputDir, 'items.json'), JSON.stringify(itemsExport, null, 2));

  console.log(`Exported ${todosExport.length} todos`);
  console.log(`Exported ${itemsExport.length} items`);
  console.log('Done! Data exported to', outputDir);

  process.exit(0);
}

exportData().catch(err => {
  console.error('Error exporting data:', err);
  process.exit(1);
});