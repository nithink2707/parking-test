import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDvJI8qIjdywB3xzz4BCne_WpOeeNQA8rA",
  authDomain: "parking-a02cd.firebaseapp.com",
  projectId: "parking-a02cd",
  storageBucket: "parking-a02cd.firebasestorage.app",
  messagingSenderId: "257897731778",
  appId: "1:257897731778:web:b2560668fc72a2e3134d5b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
