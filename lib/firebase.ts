"use client"

import { initializeApp } from "firebase/app"
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth"
import { getDatabase } from "firebase/database"

const firebaseConfig = {
  apiKey: "AIzaSyDkcM54XOQa3J_RM9J4z-Vd9uxzYi7C-UA",
  authDomain: "inventory-system-cc7dc.firebaseapp.com",
  databaseURL: "https://inventory-system-cc7dc-default-rtdb.firebaseio.com",
  projectId: "inventory-system-cc7dc",
  storageBucket: "inventory-system-cc7dc.firebasestorage.app",
  messagingSenderId: "493052328252",
  appId: "1:493052328252:web:315693026bb585eaed4639",
  measurementId: "G-6SCR0N9VH7",
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const database = getDatabase(app)

export { auth, database, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, firebaseSignOut }
