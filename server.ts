import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "./src/lib/firebase.ts";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  limit, 
  writeBatch, 
  setDoc 
} from "firebase/firestore";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

import multer from "multer";
import fs from "fs";

// Initialize Admin SDK for legacy tasks
let adminApp: admin.app.App;
try {
  if (!admin.apps.length) {
    const projId = firebaseConfig.projectId;
    if (projId && projId !== "YOUR_PROJECT_ID") {
      console.log(`Initializing Admin SDK for Project: ${projId}`);
      adminApp = admin.initializeApp({ projectId: projId });
    } else {
      adminApp = admin.initializeApp();
    }
  } else {
    adminApp = admin.app();
  }
} catch (error: any) {
  console.error("Admin init error:", error.message);
  adminApp = admin.app();
}

const dbId = firebaseConfig.firestoreDatabaseId;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.resolve(process.cwd(), "uploads");
console.log(`Setting up uploads directory at: ${uploadsDir}`);

if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log("Uploads directory created successfully.");
  } catch (err) {
    console.error("Failed to create uploads directory:", err);
  }
} else {
  console.log("Uploads directory already exists.");
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Re-verify directory exists on each upload just in case
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Verify DB connection on startup
  try {
    console.log(`Verifying Firestore connection (DB: ${dbId || '(default)'})...`);
    const q = query(collection(db, "_health_test"), limit(1));
    await getDocs(q);
    console.log("Firestore verified successfully.");
  } catch (e: any) {
    console.error(`Firestore verification FAILED: ${e.message}`);
  }

  app.use(express.json());
  app.use("/uploads", express.static(uploadsDir));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Image Upload Endpoint
  app.post("/api/upload", (req, res) => {
    console.log("Upload request headers:", req.headers["content-type"]);
    
    upload.single("image")(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          console.error("Multer-specific error:", err.code, err.message);
          return res.status(400).json({ error: `Upload error: ${err.message} (${err.code})` });
        }
        console.error("General upload error:", err);
        return res.status(500).json({ error: `Server upload error: ${err.message}` });
      }

      try {
        if (!req.file) {
          console.warn("Upload middleware finished but no file was found in request.");
          return res.status(400).json({ error: "No file uploaded" });
        }
        
        const imageUrl = `/uploads/${req.file.filename}`;
        console.log("File successfully uploaded to:", req.file.path);
        console.log("Returning public URL:", imageUrl);
        
        res.json({ success: true, imageUrl });
      } catch (error: any) {
        console.error("Error processing successful upload:", error);
        res.status(500).json({ error: "Error after upload: " + error.message });
      }
    });
  });

  // Health check for uploads directory
  app.get("/api/upload/health", (req, res) => {
    const exists = fs.existsSync(uploadsDir);
    const files = exists ? fs.readdirSync(uploadsDir) : [];
    res.json({ 
      exists, 
      path: uploadsDir, 
      fileCount: files.length,
      files: files.slice(0, 5) // Show first 5
    });
  });

  // Function to calculate distance (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Booking Matching Service (Search only)
  app.post("/api/bookings/match", async (req, res) => {
    try {
      const { serviceType, ownerId, userLocation } = req.body;

      // 1. Query for real registered mechanics first
      let allMechanics: any[] = [];
      try {
        const q = query(collection(db, "users"), where("role", "==", "mechanic"));
        const usersSnap = await getDocs(q);
        allMechanics = usersSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(m => m.id !== ownerId); // Exclude the requester
      } catch (e: any) {
        console.error("Error querying users collection:", e.message);
      }

      // 2. Fallback to seeded mechanics if no real ones
      if (allMechanics.length === 0) {
        try {
          const q = query(collection(db, "mechanics"), where("isAvailable", "==", true));
          const mechanicsSnap = await getDocs(q);
          allMechanics = mechanicsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e: any) {
          console.error("Error querying mechanics collection:", e.message);
        }
      }

      // 3. Last fallback to mock data
      if (allMechanics.length === 0) {
        allMechanics = [
          { id: "mock_1", name: "Alex Rivera", specialty: "Engine Specialist", rating: 4.9, reviewsCount: 124, distance: "1.2 km", isAvailable: true },
          { id: "mock_2", name: "Sarah Chen", specialty: "Electrical Expert", rating: 4.8, reviewsCount: 89, distance: "2.5 km", isAvailable: true }
        ];
      }
      
      // Filter by specialty or offered services (case insensitive)
      const matchedMechanics = allMechanics.filter((m: any) => {
        if (!serviceType) return true;
        
        const searchTerms = serviceType.toLowerCase().split(' ');
        const firstTerm = searchTerms[0];

        // Check specialty string
        const matchesSpecialty = m.specialty && 
          String(m.specialty).toLowerCase().includes(firstTerm);

        // Check offeredServices array
        const matchesOffered = Array.isArray(m.offeredServices) && 
          m.offeredServices.some((s: string) => s.toLowerCase().includes(firstTerm));

        return matchesSpecialty || matchesOffered;
      });

      // Return all matches
      res.json({ 
        success: true, 
        mechanics: (matchedMechanics.length > 0 ? matchedMechanics : allMechanics).map((m: any) => {
            let distanceStr = m.distance || "2.1 km";
            if (userLocation && m.location) {
                const d = calculateDistance(userLocation.lat, userLocation.lng, m.location.lat, m.location.lng);
                distanceStr = `${d.toFixed(1)} km`;
            }
            return {
                id: m.id,
                name: m.name || "Pro Mechanic",
                rating: m.rating || 5.0,
                reviews: m.reviewsCount || m.reviews || 0,
                specialty: m.specialty || "General Mechanic",
                distance: distanceStr,
                location: m.location || null,
                avatar: m.avatar || m.photoURL || ""
            };
        })
      });

    } catch (error: any) {
      console.error("Match Error:", error);
      res.status(500).json({ 
        error: error.message || "Internal server error during matching"
      });
    }
  });

  // Final Booking Confirmation
  app.post("/api/bookings/confirm", async (req, res) => {
    try {
      const { ownerId, mechanicId, serviceType, carModel, date, time } = req.body;

      if (!ownerId || !mechanicId || !serviceType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // 1. Create the booking document
      const bookingData = {
        ownerId,
        mechanicId,
        serviceType,
        carModel,
        date,
        time,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "bookings"), bookingData);

      // 2. Trigger notification
      await addDoc(collection(db, "notifications"), {
        recipientId: mechanicId,
        title: "New Service Request",
        message: `You have a new ${serviceType} request for a ${carModel}.`,
        type: "booking_new",
        relatedId: docRef.id,
        read: false,
        createdAt: serverTimestamp()
      });

      res.json({ success: true, bookingId: docRef.id });
    } catch (error: any) {
      console.error("Confirm Booking Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 2. SOS Alert Endpoint
  app.post("/api/sos/alert", async (req, res) => {
    // SOS creation is now handled in SOSModule.tsx for security rule compliance
    res.json({ success: true, message: "SOS logged via client SDK." });
  });

  // 3. Shop & Marketplace Endpoints
  app.post("/api/shop/seed", async (req, res) => {
    // This is now handled in AdminDashboard.tsx for security rule compliance
    res.json({ success: true, message: "Use the Admin Panel to seed products directly from the client." });
  });

  app.post("/api/shop/checkout", async (req, res) => {
    // Order creation is now handled in ShopModule.tsx for security rule compliance
    res.json({ 
      success: true, 
      message: "Checkout processed via client SDK. This endpoint is now a placeholder." 
    });
  });

  // --- Profile Service ---
  app.get("/api/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const requesterId = req.headers['x-user-id'] || req.headers['x-admin-id'];
      
      if (!requesterId) return res.status(401).json({ error: "Auth required" });
      if (requesterId !== userId) {
        // Only allow if requester is admin
        const adminUser = await getDoc(doc(db, "users", requesterId as string));
        if (adminUser.data()?.role !== 'admin') {
          return res.status(403).json({ error: "Unauthorized" });
        }
      }

      const userDoc = await getDoc(doc(db, "users", userId));
      if (!userDoc.exists()) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ success: true, profile: { id: userDoc.id, ...userDoc.data() } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const requesterId = req.headers['x-user-id'] || req.headers['x-admin-id'];
      const updates = req.body;

      if (!requesterId) return res.status(401).json({ error: "Auth required" });
      if (requesterId !== userId) {
        // Only allow if requester is admin
        const adminUser = await getDoc(doc(db, "users", requesterId as string));
        if (adminUser.data()?.role !== 'admin') {
          return res.status(403).json({ error: "Unauthorized" });
        }
      }
      
      // Prevent role change via this endpoint
      delete updates.role;
      delete updates.createdAt;
      
      await updateDoc(doc(db, "users", userId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      
      res.json({ success: true, message: "Profile updated" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Admin Panel Service ---
  // Middleware to check if requester is admin (Simulated for demo)
  const isAdminRequest = async (req: any, res: any, next: any) => {
    try {
      const adminId = req.headers['x-admin-id']; // In real app, verify Firebase ID Token
      if (!adminId) return res.status(401).json({ error: "Admin ID required" });
      
      const adminUser = await getDoc(doc(db, "users", adminId as string));
      
      // Override for the specific admin email
      if (adminUser.exists() && (adminUser.data()?.role === 'admin' || adminUser.data()?.email === 'nathy202444@gmail.com')) {
        next();
      } else {
        res.status(403).json({ error: "Unauthorized access" });
      }
    } catch (error: any) {
      console.error("Admin Auth Error:", error.message);
      // For the demo, if we have a hardcoded admin email in request (from frontend) and encounter DB error,
      // we might want to check the email if passed, but usually we just return 403
      res.status(403).json({ error: "Security check failed: " + error.message });
    }
  };

  app.get("/api/admin/metrics", isAdminRequest, async (req, res) => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const bookingsSnap = await getDocs(collection(db, "bookings"));
      const ordersSnap = await getDocs(collection(db, "orders"));
      
      const metrics = {
        totalUsers: usersSnap.size,
        activeBookings: bookingsSnap.docs.filter(d => d.data().status === 'pending').length,
        completedBookings: bookingsSnap.docs.filter(d => d.data().status === 'completed').length,
        totalRevenue: ordersSnap.docs.reduce((acc, d) => acc + (d.data().totalAmount || 0), 0),
        timestamp: new Date().toISOString()
      };
      
      res.json({ success: true, metrics });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/logs", isAdminRequest, async (req, res) => {
    try {
      const q = query(collection(db, "admin_logs"), orderBy("createdAt", "desc"), limit(50));
      const logsSnap = await getDocs(q);
        
      const logs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ success: true, logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/users/:userId/status", isAdminRequest, async (req, res) => {
    try {
      const { userId } = req.params;
      const { status, adminId, reason } = req.body;
      
      if (!['active', 'suspended'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      await updateDoc(doc(db, "users", userId), { status });
      
      // Log the action
      await addDoc(collection(db, "admin_logs"), {
        adminId,
        action: `USER_${status.toUpperCase()}`,
        targetId: userId,
        details: reason || "No reason provided",
        createdAt: serverTimestamp()
      });
      
      res.json({ success: true, message: `User status set to ${status}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Self-seeding endpoint
  app.post("/api/admin/seed-mechanics", async (req, res) => {
    try {
      console.log("Seeding mechanics via Server API...");
      const mechanics = [
        {
          id: "mech_1",
          name: "Alex Rivera",
          specialty: "Engine Specialist",
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
          rating: 4.7,
          reviewsCount: 56,
          distance: "3.1 km",
          isAvailable: true,
          location: { lat: -1.3031, lng: 36.8475 }
        }
      ];

      const batch = writeBatch(db);
      for (const mech of mechanics) {
        const { id, ...data } = mech;
        const ref = doc(db, "mechanics", id);
        batch.set(ref, { ...data, updatedAt: serverTimestamp() });
      }
      await batch.commit();

      res.json({ success: true, message: "Mechanics seeded successfully" });
    } catch (error: any) {
      console.error("Seed error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Auto-seed if empty
    try {
        const q = query(collection(db, "mechanics"), limit(1));
        const snap = await getDocs(q);
        if (snap.empty) {
            console.log("Auto-seeding mechanics...");
            const mechanics = [
                { id: "mech_1", name: "Alex Rivera", specialty: "Engine Specialist", offeredServices: ["Routine", "Car Repair", "Diagnostics"], rating: 4.9, reviewsCount: 124, distance: "1.2 km", isAvailable: true, location: { lat: -1.2833, lng: 36.8167 } },
                { id: "mech_2", name: "Sarah Chen", specialty: "Electrical Expert", offeredServices: ["Electrical", "Diagnostics"], rating: 4.8, reviewsCount: 89, distance: "2.5 km", isAvailable: true, location: { lat: -1.2921, lng: 36.8219 } },
                { id: "mech_3", name: "Marcus Johnson", specialty: "General Maintenance", offeredServices: ["Routine", "Car Repair", "Car Wash"], rating: 4.7, reviewsCount: 56, distance: "3.1 km", isAvailable: true, location: { lat: -1.3031, lng: 36.8475 } }
            ];
            const batch = writeBatch(db);
            mechanics.forEach(m => {
                const { id, ...data } = m;
                batch.set(doc(db, "mechanics", id), { 
                  ...data, 
                  updatedAt: serverTimestamp() 
                });
            });
            await batch.commit();
            console.log("Auto-seeding complete.");
        }
    } catch (e: any) {
        console.error("Auto-seed failed:", e.message);
    }
  });
}

startServer();
