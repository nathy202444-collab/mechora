import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

const mechanics = [
  {
    id: "mech_1",
    name: "Alex Rivera",
    specialty: "Engine Specialist",
    offeredServices: ["Routine Maintenance", "Car Repair", "Car Diagnostics"],
    rating: 4.9,
    reviewsCount: 124,
    distance: "1.2 km",
    isAvailable: true,
    location: { lat: -1.2833, lng: 36.8167 }
  },
  {
    id: "mech_2",
    name: "Sarah Chen",
    specialty: "Electrical Expert",
    offeredServices: ["Electrical Repair", "Car Diagnostics"],
    rating: 4.8,
    reviewsCount: 89,
    distance: "2.5 km",
    isAvailable: true,
    location: { lat: -1.2921, lng: 36.8219 }
  },
  {
    id: "mech_3",
    name: "Marcus Johnson",
    specialty: "General Maintenance",
    offeredServices: ["Routine Maintenance", "Car Repair", "Car Wash"],
    rating: 4.7,
    reviewsCount: 56,
    distance: "3.1 km",
    isAvailable: true,
    location: { lat: -1.3031, lng: 36.8475 }
  }
];

async function seed() {
  console.log("Seeding mechanics with Client SDK...");
  for (const mech of mechanics) {
    const { id, ...data } = mech;
    await setDoc(doc(db, "mechanics", id), {
        ...data,
        updatedAt: serverTimestamp()
    });
    console.log(`Added mechanic: ${mech.name}`);
  }
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(console.error);
