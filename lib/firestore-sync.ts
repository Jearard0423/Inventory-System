/**
 * Firestore Sync for Inventory
 * Handles real-time synchronization of inventory with Firestore
 */

import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  getDocs,
  Unsubscribe,
  query,
  where,
  Timestamp,
} from "firebase/firestore"
import { firestore } from "./firebase"
import type { InventoryItem } from "./inventory-store"

let inventoryListener: Unsubscribe | null = null
let isInitialized = false

/**
 * Load all inventory items from Firestore
 */
export const loadInventoryFromFirestore = async (): Promise<InventoryItem[]> => {
  try {
    const inventoryRef = collection(firestore, "inventory")
    const snapshot = await getDocs(inventoryRef)
    
    const items: InventoryItem[] = []
    snapshot.forEach((doc) => {
      const data = doc.data()
      items.push({
        id: doc.id,
        name: data.name || "",
        category: data.category || "others",
        stock: data.stock || 0,
        price: data.price || 0,
        status: data.status || "in-stock",
        isUtensil: data.isUtensil || false,
        isContainer: data.isContainer || false,
      })
    })
    
    console.log(`Loaded ${items.length} items from Firestore`)
    
    // Save to localStorage for offline access
    if (typeof window !== "undefined") {
      localStorage.setItem("yellowbell_inventory_items", JSON.stringify(items))
      window.dispatchEvent(new Event("inventory-updated"))
    }
    
    return items
  } catch (error) {
    console.error("Error loading inventory from Firestore:", error)
    return []
  }
}

/**
 * Save inventory item to Firestore
 */
export const saveInventoryToFirestore = async (item: InventoryItem): Promise<void> => {
  try {
    const docRef = doc(firestore, "inventory", item.id)
    await setDoc(docRef, {
      ...item,
      updatedAt: Timestamp.now(),
    })
    console.log(`[firestore-sync] Saved item to Firestore:`, item.id, item.name)
  } catch (error) {
    console.error("[firestore-sync] Error saving inventory to Firestore:", error)
  }
}

/**
 * Set up real-time listener for inventory changes
 */
export const setupInventoryListener = (): (() => void) => {
  if (!firestore || typeof window === "undefined") {
    return () => {}
  }

  try {
    const inventoryRef = collection(firestore, "inventory")
    
    inventoryListener = onSnapshot(
      inventoryRef,
      (snapshot) => {
        const items: InventoryItem[] = []
        snapshot.forEach((doc) => {
          const data = doc.data()
          items.push({
            id: doc.id,
            name: data.name || "",
            category: data.category || "others",
            stock: data.stock || 0,
            price: data.price || 0,
            status: data.status || "in-stock",
            isUtensil: data.isUtensil || false,
            isContainer: data.isContainer || false,
          })
        })

        // Update localStorage
        localStorage.setItem("yellowbell_inventory_items", JSON.stringify(items))
        
        // Dispatch event for UI update
        window.dispatchEvent(new Event("inventory-updated"))
        
        console.log("Inventory synced from Firestore:", items.length, "items")
      },
      (error) => {
        if (error.code === "permission-denied") {
          console.warn("Firestore permission denied. Make sure your security rules allow reads.")
        } else {
          console.error("Firestore listener error:", error)
        }
      }
    )

    return () => {
      if (inventoryListener) {
        inventoryListener()
        inventoryListener = null
      }
    }
  } catch (error) {
    console.error("Error setting up inventory listener:", error)
    return () => {}
  }
}

/**
 * Initialize Firestore sync on app start
 */
export const initializeFirestoreSync = async () => {
  if (isInitialized) return
  
  try {
    // Load initial data
    await loadInventoryFromFirestore()
    
    // Set up real-time listener
    setupInventoryListener()
    
    isInitialized = true
    console.log("Firestore sync initialized")
  } catch (error) {
    console.error("Error initializing Firestore sync:", error)
  }
}

/**
 * Clean up listeners
 */
export const cleanupFirestoreSync = () => {
  if (inventoryListener) {
    inventoryListener()
    inventoryListener = null
  }
}

/**
 * Sync localStorage inventory to Firestore (manual debug helper).
 * Writes each local item to the `inventory` collection using the item's `id` as doc id.
 */
export const syncLocalToFirestore = async (): Promise<void> => {
  try {
    if (typeof window === 'undefined') return

    const local = localStorage.getItem('yellowbell_inventory_items')
    if (!local) {
      console.log('No local inventory found to sync')
      return
    }

    const items: InventoryItem[] = JSON.parse(local)
    for (const item of items) {
      try {
        const docRef = doc(firestore, 'inventory', item.id)
        await setDoc(docRef, {
          ...item,
          updatedAt: Timestamp.now(),
        })
      } catch (err) {
        console.error('Failed to write item to Firestore:', item.id, err)
      }
    }

    console.log('Synced local inventory to Firestore:', items.length, 'items')
  } catch (error) {
    console.error('Error syncing local inventory to Firestore:', error)
  }
}
