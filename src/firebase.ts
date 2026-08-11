// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDoTmF4pEdUHZrIEOlhjwQ-oS9gpPrq-ak",
  authDomain: "sistema-tickets-65e1e.firebaseapp.com",
  projectId: "sistema-tickets-65e1e",
  storageBucket: "sistema-tickets-65e1e.firebasestorage.app",
  messagingSenderId: "301520421943",
  appId: "1:301520421943:web:ce1ed8db7bdf3d9b212bb2",
  measurementId: "G-34DF5QD0BW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app);
const auth = getAuth(app);

export { app, db, functions, auth };
