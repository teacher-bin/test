import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCQmDCL-PuN2A9AgOzIpObCeNtvIFDJmhU",
  authDomain: "studio-8412089884-f8185.firebaseapp.com",
  projectId: "studio-8412089884-f8185",
  storageBucket: "studio-8412089884-f8185.firebasestorage.app",
  messagingSenderId: "928283224778",
  appId: "1:928283224778:web:01cb08827402140aace233"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
