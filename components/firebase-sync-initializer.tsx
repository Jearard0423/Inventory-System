"use client"

import { useEffect } from "react"
import { initializeFirebaseSync, cleanupFirebaseSync, initializeCategoriesInFirebase } from "@/lib/firebase-inventory-sync"

/**
 * Component to initialize Firebase sync on app startup
 * Should be placed at the root level of the app
 */
export function FirebaseSyncInitializer() {
  useEffect(() => {
    // Initialize Firebase sync with error handling
    try {
      initializeFirebaseSync()
    } catch (err) {
      console.warn("Firebase sync initialization encountered an error. App will use localStorage.")
    }

    // Initialize categories in Firebase if not already done
    // Silently fails if permissions denied
    initializeCategoriesInFirebase().catch((err) => {
      console.warn("Firebase categories initialization skipped. Using localStorage only.")
    })

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
    }
  }, [])

  return null
}
