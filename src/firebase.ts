import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDVcrzmlBtYWZUF_GCO6J3g1wsMlhmzBGY",
  authDomain: "panaderialya-5f4ca.firebaseapp.com",
  projectId: "panaderialya-5f4ca",
  storageBucket: "panaderialya-5f4ca.firebasestorage.app",
  messagingSenderId: "308153885059",
  appId: "1:308153885059:web:c8344bcdf911b1857456b6",
  measurementId: "G-MZ90S79XCS"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
