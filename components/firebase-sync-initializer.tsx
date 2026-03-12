"use client"

import { useEffect } from "react"
import { initializeFirebaseSync, cleanupFirebaseSync, initializeCategoriesInFirebase, getCategoriesFromFirebase, loadOrdersPageFromFirebase, loadOrderHistoryFromFirebase } from "@/lib/firebase-inventory-sync"
import { initializeFirestoreSync, cleanupFirestoreSync } from "@/lib/firestore-sync"
import { startNotificationsListener, stopNotificationsListener } from "@/lib/notifications-store"

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

    // Load orders-page orders from Firebase so they survive logout / device switch
    try {
      loadOrdersPageFromFirebase().catch(() => {})
    } catch { /* non-critical */ }

    // Load order history from Firebase — RTDB REPLACES localStorage (no merge)
    // Pre-wipe the local history so ghosts can never survive a session restart
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('yellowbell_order_history')
      }
      loadOrderHistoryFromFirebase().catch(() => {})
    } catch { /* non-critical */ }

    // Start real-time notifications listener so all admins see the same notifications
    try {
      startNotificationsListener().catch(() => {})
    } catch { /* non-critical */ }

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
      if (event instanceof CustomEvent && Array.isArray(event.detail?.orders)) {
        // Keep the in-memory customerOrders array in sync with RTDB
        // This is the missing link — without this, kitchen/delivery/dashboard
        // read stale in-memory data even after Firebase fires a deletion/update
        try {
          const { setCustomerOrdersFromRTDB } = require('@/lib/inventory-store')
          setCustomerOrdersFromRTDB(event.detail.orders)
        } catch { /* non-critical */ }
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
      stopNotificationsListener().catch(() => {})
    }
  }, [])

  return null
}