"use client"

import { useEffect } from "react"
import { initializeFirebaseSync, cleanupFirebaseSync, initializeCategoriesInFirebase, getCategoriesFromFirebase } from "@/lib/firebase-inventory-sync"
import { initializeFirestoreSync, cleanupFirestoreSync } from "@/lib/firestore-sync"

/**
 * Component to initialize Firebase sync on app startup
 * Should be placed at the root level of the app
 */
export function FirebaseSyncInitializer() {
  useEffect(() => {
    // Initialize Firestore sync for inventory
    try {
      initializeFirestoreSync()
    } catch (err) {
      console.warn("Firestore sync initialization encountered an error. App will use localStorage.", err)
    }

    // Expose a debug helper in development to manually sync localStorage -> Firestore
    // Usage in browser console: `window.syncLocalToFirestore()`
    try {
      // Attach only in browser/dev
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        import('@/lib/firestore-sync').then((mod) => {
          // @ts-ignore - attach for debugging
          window.syncLocalToFirestore = mod.syncLocalToFirestore
        }).catch(() => {
          // ignore
        })
      }
    } catch (err) {
      // ignore
    }

    // Initialize Firebase Realtime Database sync (for backward compatibility)
    try {
      initializeFirebaseSync()
    } catch (err) {
      console.warn("Firebase RTDB sync initialization encountered an error. App will use localStorage.")
    }

    // Initialize categories in Firebase and fetch them
    const initCategories = async () => {
      try {
        // First, ensure categories exist in Firebase
        await initializeCategoriesInFirebase()
        
        // Then fetch categories from Firebase to ensure we have the latest
        const categoriesFromFirebase = await getCategoriesFromFirebase()
        if (categoriesFromFirebase && typeof window !== 'undefined') {
          // Cache categories in localStorage for the app to use
          localStorage.setItem('firebase_categories', JSON.stringify(categoriesFromFirebase))
          console.log("Categories loaded from Firebase:", categoriesFromFirebase)
        }
      } catch (err) {
        console.warn("Firebase categories initialization skipped. Using localStorage only.", err)
      }
    }
    
    initCategories()

    // Set up event listeners for Firebase updates (optional enhancement)
    const handleInventoryUpdate = (event: Event) => {
      if (event instanceof CustomEvent) {
        console.debug("Firebase inventory update received")
      }
    }

    const handleOrdersUpdate = (event: Event) => {
      if (event instanceof CustomEvent) {
        console.debug("Firebase orders update received")
      }
    }

    const handleKitchenUpdate = (event: Event) => {
      if (event instanceof CustomEvent) {
        console.debug("Firebase kitchen update received")
      }
    }

    window.addEventListener("firebase-inventory-updated", handleInventoryUpdate)
    window.addEventListener("firebase-orders-updated", handleOrdersUpdate)
    window.addEventListener("firebase-kitchen-updated", handleKitchenUpdate)

    // Cleanup on unmount
    return () => {
      window.removeEventListener("firebase-inventory-updated", handleInventoryUpdate)
      window.removeEventListener("firebase-orders-updated", handleOrdersUpdate)
      window.removeEventListener("firebase-kitchen-updated", handleKitchenUpdate)
      cleanupFirebaseSync()
      cleanupFirestoreSync()
    }
  }, [])

  return null
}
