// Script to create a Firebase test account
// Run with: node create-test-account.js

import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDkcM54XOQa3J_RM9J4z-Vd9uxzYi7C-UA",
  authDomain: "inventory-system-cc7dc.firebaseapp.com",
  databaseURL: "https://inventory-system-cc7dc-default-rtdb.firebaseio.com",
  projectId: "inventory-system-cc7dc",
  storageBucket: "inventory-system-cc7dc.firebasestorage.app",
  messagingSenderId: "493052328252",
  appId: "1:493052328252:web:315693026bb585eaed4639",
  measurementId: "G-6SCR0N9VH7",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const testEmail = "admin@yellowbell.com";
const testPassword = "Admin123!";

async function createTestAccount() {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      testEmail,
      testPassword
    );
    console.log("✅ Test account created successfully!");
    console.log("📧 Email:", testEmail);
    console.log("🔑 Password:", testPassword);
    console.log("👤 User ID:", userCredential.user.uid);
  } catch (error: any) {
    if (error.code === "auth/email-already-in-use") {
      console.log("✅ Test account already exists!");
      console.log("📧 Email:", testEmail);
      console.log("🔑 Password:", testPassword);
    } else {
      console.error("❌ Error creating account:", error.message);
    }
  }
}

createTestAccount();
