import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCxLE6OfXSk18pOEp55p7sRv6BRNFsuWE4",
    authDomain: "tuskiran-a12ea.firebaseapp.com",
    projectId: "tuskiran-a12ea",
    storageBucket: "tuskiran-a12ea.firebasestorage.app",
    messagingSenderId: "1012552487231",
    appId: "1:1012552487231:web:6d16367209623d58b9838a",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
