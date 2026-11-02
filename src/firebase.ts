// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAuth, initializeAuth, inMemoryPersistence, type Auth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Caché local (IndexedDB): al recargar, los listeners pintan primero lo que
// ya estaba guardado y después sincronizan con el servidor, en vez de
// esperar a descargar todo de nuevo. Compartida entre pestañas.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
const functions = getFunctions(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Segunda instancia de Auth, solo para que un admin cree cuentas: si se
// creara con `auth`, Firebase cambiaría la sesión del admin a la cuenta
// nueva. En memoria, sin persistir nada en el navegador.
let authCuentas: Auth | null = null;
const getAuthCuentas = () => {
  authCuentas ??= initializeAuth(initializeApp(firebaseConfig, "cuentas"), { persistence: inMemoryPersistence });
  return authCuentas;
};

export { app, db, functions, auth, storage, getAuthCuentas };
