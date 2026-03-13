/**
 * Firebase Realtime Database Sync for Inventory
 * 
 * This module handles real-time synchronization of inventory data with Firebase RTDB.
 * It maintains a hybrid approach: localStorage for local caching and Firebase for real-time updates.
 * 
 * Database Structure:
 * /inventories/
 *   /items/ - Inventory items (food, containers, utensils)
 *   /categories/ - Category definitions and rules
 *   /orders/ - Customer orders
 *   /kitchen/ - Kitchen items and status
 *   /sync-metadata/ - Last sync timestamps and version info
 * /menu/
 *   /{itemId} - Menu items (food items with inventory linking)
 *     /linkedItems - Items required for this menu item
 */

import {
  ref,
  onValue,
  set,
  update,
  get,
  remove,
  Unsubscribe,
} from "firebase/database"
import { database } from "./firebase"
import { InventoryItem, CustomerOrder, KitchenItem } from "./inventory-store"

// Real-time listeners for cleanup
let inventoryListener: Unsubscribe | null = null
let ordersListener: Unsubscribe | null = null
let kitchenListener: Unsubscribe | null = null
let menuListener: Unsubscribe | null = null
let ordersPageListener: Unsubscribe | null = null

// Track recently updated items to prevent circular sync loops
// Maps itemId -> timestamp of when it was last updated locally
const recentlyUpdatedItems = new Map<string, number>()
const DEBOUNCE_DELAY_MS = 1500 // Ignore listener updates for 1.5 seconds after local update

/**
 * Mark an item as recently updated locally to prevent listener from overwriting it
 */
export const markItemAsLocallyUpdated = (itemId: string) => {
  recentlyUpdatedItems.set(itemId, Date.now())
  // Auto-cleanup after debounce period
  setTimeout(() => {
    recentlyUpdatedItems.delete(itemId)
  }, DEBOUNCE_DELAY_MS)
}

/**
 * Check if an item was recently updated locally and should be ignored from listener
 */
const isRecentlyUpdatedLocally = (itemId: string): boolean => {
  const lastUpdate = recentlyUpdatedItems.get(itemId)
  if (!lastUpdate) return false
  
  const timeSinceUpdate = Date.now() - lastUpdate
  return timeSinceUpdate < DEBOUNCE_DELAY_MS
}

/**
 * Normalize inventory items from Firebase
 * Ensures category values are consistent (raw-stocks -> raw-stock, etc)
 */
const normalizeFirebaseItems = (items: Record<string, any>): Record<string, any> => {
  const normalized: Record<string, any> = {}
  
  for (const [key, item] of Object.entries(items)) {
    // Normalize category: convert "raw-stocks" (plural) to "raw-stock" (singular)
    const normalizedCategory = item.category === "raw-stocks" ? "raw-stock" : item.category
    
    normalized[key] = {
      ...item,
      category: normalizedCategory,
    }
  }
  
  return normalized
}

/**
 * Force refresh inventory from Firebase and update all listeners
 * Useful for syncing when localStorage might be stale
 */
export const forceRefreshInventoryFromFirebase = async () => {
  try {
    const inventoryRef = ref(database, "inventories/items")
    const snapshot = await get(inventoryRef)
    
    if (snapshot.exists()) {
      let items = snapshot.val()
      // Normalize items before processing
      items = normalizeFirebaseItems(items)
      
      console.log('[firebase-inventory-sync] Force refreshed inventory from Firebase:', Object.keys(items).length, 'items')
      
      // Update localStorage immediately
      localStorage.setItem(
        "yellowbell_inventory_items",
        JSON.stringify(Object.values(items))
      )
      
      // Dispatch event to update UI
      window.dispatchEvent(
        new CustomEvent("firebase-inventory-updated", { detail: items })
      )
      
      return Object.values(items)
    }
    
    return []
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error('Error force refreshing inventory from Firebase:', error)
    }
    return []
  }
}

/**
 * Initialize Firebase sync on app start
 * Sets up real-time listeners for inventory, orders, kitchen items, and menu
 * Gracefully falls back to localStorage if permissions are denied
 */
// NOTE: "complete" is intentionally excluded here — kitchen needs to show complete orders
// (cooked but not yet delivered). Only truly final statuses are filtered out.
const DONE_STATUSES_SYNC = new Set(["delivered","served","cancelled","canceled","completed"])

// IMPORTANT: We use the delivery date (o.date / cookTime date), NOT createdAt.
// Orders placed today for 3 days from now must NOT be purged just because
// createdAt is >24hrs old. We only purge if the scheduled delivery day has passed.
const isStaleOrder = (o: any): boolean => {
  const status = (o.status || "").toLowerCase()
  if (DONE_STATUSES_SYNC.has(status)) return true
  if (status === "incomplete" || status === "cooking" || status === "ready") {
    // Use scheduled delivery date (o.date = YYYY-MM-DD set by date picker)
    // Fall back to createdAt only if no delivery date is set
    let deliveryDate: Date | null = null
    if (o.date) {
      // o.date is "YYYY-MM-DD" — parse as local date (no timezone shift)
      const [y, m, d] = o.date.split("-").map(Number)
      deliveryDate = new Date(y, m - 1, d)
      deliveryDate.setHours(23, 59, 59, 999) // end of delivery day
    } else if (o.createdAt) {
      // No delivery date — fall back to createdAt + generous 7-day window
      deliveryDate = new Date(new Date(o.createdAt).getTime() + 7 * 24 * 3600000)
    }
    if (!deliveryDate) return false
    // Stale if the delivery date has passed by more than 28 hours (gives same-day buffer)
    const phOffset = new Date().getTimezoneOffset() * 60000 + 8 * 3600000
    const phNow = Date.now() + phOffset
    const hoursPassedSinceDelivery = (phNow - deliveryDate.getTime()) / 3600000
    return hoursPassedSinceDelivery > 28
  }
  return false
}

export const initializeFirebaseSync = () => {
  if (typeof window === "undefined") return

  try {
    console.log('[firebase-inventory-sync] Initializing Firebase sync...')

    // ─── IMMEDIATE STALE-ORDER NUKE ───────────────────────────────────────────
    // Wipe yellowbell_customer_orders from localStorage RIGHT NOW, synchronously,
    // before the async RTDB listener fires. This prevents any component that reads
    // localStorage during the RTDB round-trip from seeing the 60+ ghost orders.
    // RTDB onValue will repopulate with fresh active orders within milliseconds.
    localStorage.setItem("yellowbell_customer_orders", "[]")
    window.dispatchEvent(new CustomEvent("firebase-orders-updated", { detail: { orders: [] } }))
    window.dispatchEvent(new Event("customer-orders-updated"))
    console.log("[firebase-inventory-sync] Cleared stale customer orders from localStorage — awaiting RTDB...")
    // ─────────────────────────────────────────────────────────────────────────

    // Force refresh inventory from Firebase
    forceRefreshInventoryFromFirebase().catch(err => {
      console.warn('[firebase-inventory-sync] Initial Firebase refresh failed, will use real-time listener:', err)
    })
    const inventoryRef = ref(database, "inventories/items")
    inventoryListener = onValue(
      inventoryRef,
      (snapshot) => {
        if (snapshot.exists()) {
          let items = snapshot.val()
          // Normalize items from Firebase
          items = normalizeFirebaseItems(items)
          console.log('[firebase-inventory-sync] Real-time inventory update received:', Object.keys(items).length, 'items')
          
          // Dispatch event for UI components to refresh
          window.dispatchEvent(
            new CustomEvent("firebase-inventory-updated", { detail: items })
          )
          
          // Also update localStorage
          localStorage.setItem(
            "yellowbell_inventory_items",
            JSON.stringify(Object.values(items))
          )
        }
      },
      (error: any) => {
        if (error.code === "PERMISSION_DENIED") {
          console.warn(
            "Firebase permission denied for inventories/items. Using localStorage only. " +
            "Please update Firebase security rules in the console."
          )
        } else {
          console.error("Firebase inventory sync error:", error)
        }
      }
    )

    // RTDB is the single source of truth for orders.
    // On every push, fully replace localStorage with ONLY non-finished orders from RTDB.
    // This permanently clears any stale orders (e.g. the 68-order ghost problem).
    // DONE_STATUSES_SYNC defined at module level

    // An order is considered stale/done if:
    // 1. Its status is explicitly a done status (delivered, served, cancelled, etc.), OR
    // 2. Its status is "incomplete" AND its DELIVERY DATE has passed by more than 24 hours
    //
    // isStaleOrder defined at module level above
    const ordersRef = ref(database, "inventories/orders")
    ordersListener = onValue(
      ordersRef,
      (snapshot) => {
        try {
          let activeOrders: any[] = []
          if (snapshot.exists()) {
            const rtdbOrders: Record<string, any> = snapshot.val()
            const staleIds: string[] = []
            activeOrders = Object.values(rtdbOrders).filter((o: any) => {
              if (isStaleOrder(o)) {
                staleIds.push(o.id || o.orderId)
                return false
              }
              return true
            })
            console.log(`[firebase-sync] RTDB → localStorage: ${activeOrders.length} active orders, ${staleIds.length} stale removed`)
            // Asynchronously delete stale orders from RTDB so they never come back
            if (staleIds.length > 0) {
              const cleanupUpdates: Record<string, null> = {}
              staleIds.forEach(id => { if (id) cleanupUpdates[id] = null })
              update(ordersRef, cleanupUpdates).then(() => {
                console.log(`[firebase-sync] Deleted ${staleIds.length} stale orders from RTDB:`, staleIds.slice(0,5))
              }).catch(err => console.warn("[firebase-sync] RTDB stale order cleanup failed:", err))
            }
          } else {
            console.log("[firebase-sync] RTDB has no orders — cleared localStorage")
          }
          // Write to localStorage
          localStorage.setItem("yellowbell_customer_orders", JSON.stringify(activeOrders))
          // Pass activeOrders as event detail so inventory-store.ts in-memory
          // customerOrders array also gets replaced (prevents stale array overwriting localStorage)
          window.dispatchEvent(new CustomEvent("firebase-orders-updated", { detail: { orders: activeOrders } }))
          window.dispatchEvent(new Event("customer-orders-updated"))
        } catch (e) {
          console.warn("[firebase-sync] Orders sync error:", e)
        }
      },
      (error: any) => {
        if (error.code === "PERMISSION_DENIED") {
          console.warn("Firebase permission denied for inventories/orders. Using localStorage only.")
        } else {
          console.error("Firebase orders sync error:", error)
        }
      }
    )

    // Set up ordersPage listener — syncs yellowbell_orders (orders page) across all admins.
    // When any admin deletes, edits, or pays an order, all other admins see it instantly.
    const ordersPageRef = ref(database, "ordersPage")
    ordersPageListener = onValue(
      ordersPageRef,
      (snapshot) => {
        try {
          const remoteOrders: any[] = snapshot.exists() ? Object.values(snapshot.val()) : []
          // Merge: for each order, keep whichever copy has the newer lastUpdated
          // This ensures payment/edit changes from any device always win
          const localOrders: any[] = JSON.parse(localStorage.getItem("yellowbell_orders") || "[]")
          const localMap = new Map(localOrders.map((o: any) => [o.id, o]))
          const remoteMap = new Map(remoteOrders.map((o: any) => [o.id, o]))
          // Remote (Firebase) is the source of truth.
          // Only keep local orders that ALSO exist in Firebase.
          // This means: if another admin deletes an order, it disappears from every client.
          // The only exception: orders created in the last 10 seconds that haven't synced yet.
          const now = Date.now()
          const merged: any[] = []
          // Remote (Firebase) ALWAYS wins — it is the single source of truth.
          // Any edit by any admin goes to Firebase first, so remote is always correct.
          // Never let a stale local copy override a Firebase edit from another admin.
          remoteMap.forEach((remote, id) => {
            merged.push(remote)
          })
          // Only keep local-only orders if they were just created (within 10s) — not yet synced to Firebase.
          // This prevents ghost orders from re-appearing after another admin deletes them.
          localMap.forEach((local, id) => {
            if (!remoteMap.has(id)) {
              const createdTs = new Date(local.createdAt || 0).getTime()
              if (now - createdTs < 10000) merged.push(local) // brand new, not synced yet
            }
          })
          localStorage.setItem("yellowbell_orders", JSON.stringify(merged))
          window.dispatchEvent(new Event("orders-updated"))
          console.log(`[firebase-sync] ordersPage → localStorage: ${merged.length} orders`)
        } catch (e) {
          console.warn("[firebase-sync] ordersPage sync error:", e)
        }
      },
      (error: any) => {
        if (error.code !== "PERMISSION_DENIED") {
          console.error("Firebase ordersPage sync error:", error)
        }
      }
    )

    // Set up kitchen items listener with error handling
    const kitchenRef = ref(database, "inventories/kitchen")
    kitchenListener = onValue(
      kitchenRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const items = snapshot.val()
          window.dispatchEvent(
            new CustomEvent("firebase-kitchen-updated", { detail: items })
          )
          localStorage.setItem(
            "yellowbell_kitchen_items",
            JSON.stringify(Object.values(items))
          )
        }
      },
      (error: any) => {
        if (error.code === "PERMISSION_DENIED") {
          console.warn(
            "Firebase permission denied for inventories/kitchen. Using localStorage only."
          )
        } else {
          console.error("Firebase kitchen sync error:", error)
        }
      }
    )

    // Set up menu listener with error handling
    // Menu items are food items from inventory (no containers, utensils, or raw stock)
    const menuRef = ref(database, "menu")
    menuListener = onValue(
      menuRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const menuItems = snapshot.val()
          
          // Sync menu changes back to inventories/items path
          for (const itemId in menuItems) {
            const menuItem = menuItems[itemId]
            if (menuItem.stock !== undefined || menuItem.status) {
              await syncMenuToInventoryItems(itemId, menuItem)
            }
          }
          
          window.dispatchEvent(
            new CustomEvent("firebase-menu-updated", { detail: menuItems })
          )
          // Menu is derived from inventory, so we sync to localStorage separately
          localStorage.setItem(
            "yellowbell_menu_items",
            JSON.stringify(Object.values(menuItems))
          )
        }
      },
      (error: any) => {
        if (error.code === "PERMISSION_DENIED") {
          console.warn(
            "Firebase permission denied for menu. Using localStorage only."
          )
        } else {
          console.error("Firebase menu sync error:", error)
        }
      }
    )

    // Set up salesOrders listener — syncs completed/paid orders to sales page
    const salesOrdersRef = ref(database, "inventories/salesOrders")
    onValue(
      salesOrdersRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const salesOrders = Object.values(snapshot.val())
          localStorage.setItem("yellowbell_rtdb_sales_orders", JSON.stringify(salesOrders))
          window.dispatchEvent(new CustomEvent("firebase-sales-updated", { detail: salesOrders }))
          console.log(`[firebase-sync] Sales orders synced: ${salesOrders.length} orders`)
        }
      },
      (error: any) => {
        if (error.code !== "PERMISSION_DENIED") {
          console.error("Firebase salesOrders sync error:", error)
        }
      }
    )

    console.log("Firebase sync initialized with menu support (with fallback to localStorage)")
  } catch (error: any) {
    console.error("Failed to initialize Firebase sync:", error)
    console.log("Falling back to localStorage only")
  }
}

/**
 * Clean up Firebase listeners
 */
export const cleanupFirebaseSync = () => {
  if (inventoryListener) inventoryListener()
  if (ordersListener) ordersListener()
  if (kitchenListener) kitchenListener()
  if (menuListener) menuListener()
  if (ordersPageListener) ordersPageListener()
}

/**
 * Save inventory item to Firebase
 * Falls back silently if permissions denied
 */
export const saveInventoryItemToFirebase = async (
  itemId: string,
  item: InventoryItem
) => {
  try {
    const itemRef = ref(database, `inventories/items/${itemId}`)
    // Remove undefined values before saving to Firebase
    const cleanItem = cleanUndefined({
      ...item,
      lastUpdated: new Date().toISOString(),
    })
    await set(itemRef, cleanItem)
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error saving inventory item to Firebase:", error)
    }
    // Silently fail for permission denied (app continues with localStorage)
  }
}

/**
 * Save multiple inventory items to Firebase
 * Falls back silently if permissions denied
 */
export const saveInventoryToFirebase = async (items: InventoryItem[]) => {
  try {
    const inventoryRef = ref(database, "inventories/items")
    const updates: Record<string, any> = {}
    const itemIds: string[] = []

    items.forEach((item) => {
      // Normalize category: convert "raw-stocks" to "raw-stock" for consistency
      const normalizedCategory = item.category === "raw-stocks" ? "raw-stock" : item.category

      // Create a clean object without undefined values
      const itemData: Record<string, any> = {
        id: item.id,
        name: item.name,
        category: normalizedCategory,
        stock: item.stock,
        price: item.price,
        status: item.status,
        lastUpdated: new Date().toISOString(),
      }

      // Only add linkedItems if it exists and is not empty
      if (item.linkedItems && item.linkedItems.length > 0) {
        itemData.linkedItems = item.linkedItems
      }

      // Only add optional fields if they are defined
      if (item.isUtensil !== undefined) itemData.isUtensil = item.isUtensil
      if (item.isContainer !== undefined) itemData.isContainer = item.isContainer

      updates[item.id] = itemData
      itemIds.push(item.id)
    })

    await update(inventoryRef.parent!, updates)
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error saving inventory to Firebase:", error)
    }
    // Silently fail for permission denied (app continues with localStorage)
  }
}

/**
 * Save menu item to Firebase (with linked items for inventory tracking)
 * Falls back silently if permissions denied
 */
export const saveMenuItemToFirebase = async (itemId: string, item: InventoryItem) => {
  try {
    const menuItemRef = ref(database, `menu/${itemId}`)
    await set(menuItemRef, {
      id: item.id,
      name: item.name,
      category: item.category,
      stock: item.stock,
      price: item.price,
      status: item.status,
      linkedItems: item.linkedItems || [],
      lastUpdated: new Date().toISOString(),
    })
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error saving menu item to Firebase:", error)
    }
    // Silently fail for permission denied (app continues with localStorage)
  }
}

/**
 * Save all menu items to Firebase
 * Menu items are the food items from inventory (excluding containers, utensils, raw stock)
 * Falls back silently if permissions denied
 */
export const saveMenuToFirebase = async (menuItems: InventoryItem[]) => {
  try {
    const menuRef = ref(database, "menu")
    const updates: Record<string, any> = {}

    menuItems.forEach((item) => {
      if (!item.isUtensil && !item.isContainer && item.category !== 'raw-stock') {
        updates[item.id] = {
          id: item.id,
          name: item.name,
          category: item.category,
          stock: item.stock,
          price: item.price,
          status: item.status,
          linkedItems: item.linkedItems || [],
          lastUpdated: new Date().toISOString(),
        }
      }
    })

    if (Object.keys(updates).length > 0) {
      await update(menuRef.parent!, updates)
      console.log(`[firebase-inventory-sync] Synced ${Object.keys(updates).length} menu items to Firebase`)
    }
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error saving menu to Firebase:", error)
    }
    // Silently fail for permission denied (app continues with localStorage)
  }
}

/**
 * Update menu item stock in Firebase (reflecting inventory changes)
 * Includes linkedItems to ensure ingredient relationships are preserved
 * Falls back silently if permissions denied
 */
export const updateMenuStockInFirebase = async (
  itemId: string,
  newStock: number,
  status: "in-stock" | "low-stock" | "out-of-stock",
  linkedItems?: Array<{ itemId: string; ratio: number }>
) => {
  try {
    // Update both paths to keep them in sync:
    // 1. menu/{itemId} - for backward compatibility
    // 2. inventories/items/{itemId} - for the listener that watches this path
    const updateData: Record<string, any> = {
      stock: newStock,
      status: status,
      lastUpdated: new Date().toISOString(),
    }

    // Include linkedItems if provided to maintain ingredient relationships
    if (linkedItems && linkedItems.length > 0) {
      updateData.linkedItems = linkedItems
    }

    const menuItemRef = ref(database, `menu/${itemId}`)
    const inventoryItemRef = ref(database, `inventories/items/${itemId}`)

    await Promise.all([
      update(menuItemRef, updateData),
      update(inventoryItemRef, updateData),
    ])

    console.log(
      `Stock updated for item ${itemId}: ${newStock} (${status})${linkedItems && linkedItems.length > 0 ? ` with ${linkedItems.length} linked items` : ""}`
    )
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error updating stock in Firebase:", error)
    }
    // Silently fail for permission denied (app continues with localStorage)
  }
}

/**
 * Update inventory item in Firebase (for raw-stock, containers, utensils, etc.)
 * Updates the item in inventories/items path for real-time sync
 * Falls back silently if permissions denied
 */
export const updateInventoryItemInFirebase = async (item: InventoryItem) => {
  try {
    const inventoryItemRef = ref(database, `inventories/items/${item.id}`)
    const updateData: Record<string, any> = {
      stock: item.stock,
      status: item.status,
      lastUpdated: new Date().toISOString(),
    }

    await update(inventoryItemRef, updateData)

    console.log(
      `Inventory item updated in Firebase: ${item.id} (${item.name}), stock: ${item.stock}`
    )
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error updating inventory item in Firebase:", error)
    }
    // Silently fail for permission denied (app continues with localStorage)
  }
}

/**
 * Get menu from Firebase
 * Returns empty array if permission denied or error occurs
 */
export const getMenuFromFirebase = async () => {
  try {
    const menuRef = ref(database, "menu")
    const snapshot = await get(menuRef)
    if (snapshot.exists()) {
      return Object.values(snapshot.val())
    }
    return []
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error fetching menu from Firebase:", error)
    }
    return []
  }
}

// Utility function to remove undefined values from objects (Firebase doesn't allow undefined)
const cleanUndefined = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item))
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = cleanUndefined(value)
      }
      return acc
    }, {} as any)
  }
  return obj
}

/**
 * Customer order to Firebase
 * Falls back silently if permissions denied
 */
export const saveOrderToFirebase = async (orderId: string, order: CustomerOrder) => {
  try {
    const orderRef = ref(database, `inventories/orders/${orderId}`)
    // Remove undefined values before saving to Firebase
    const cleanOrder = cleanUndefined({
      ...order,
      lastUpdated: new Date().toISOString(),
    })
    await set(orderRef, cleanOrder)
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error saving order to Firebase:", error)
    }
    // Silently fail for permission denied (app continues with localStorage)
  }
}

/**
 * Patch specific fields of an existing order in Firebase RTDB.
 * Used when admin edits cookTime, mealType, date, customerName etc.
 * so the updated delivery time is used by reminders on all devices.
 */
export const updateOrderInFirebase = async (orderId: string, patch: Record<string, any>) => {
  try {
    const { update } = await import("firebase/database")
    const cleanPatch = cleanUndefined({ ...patch, lastUpdated: new Date().toISOString() })

    // Patch BOTH nodes in parallel so every listener fires on every device
    await Promise.all([
      // /inventories/orders — read by kitchen, delivery, reminders
      update(ref(database, `inventories/orders/${orderId}`), cleanPatch),
      // /ordersPage — read by the orders page real-time listener
      update(ref(database, `ordersPage/${orderId}`), cleanPatch),
    ])
    console.log(`[firebase-sync] Order ${orderId} patched in RTDB (both nodes):`, Object.keys(cleanPatch))
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error updating order in Firebase:", error)
    }
  }
}

/**
 * Update inventory stock in Firebase
 * Falls back silently if permissions denied
 */
export const updateInventoryStockInFirebase = async (
  itemId: string,
  newStock: number
) => {
  try {
    const itemRef = ref(database, `inventories/items/${itemId}`)
    await update(itemRef, {
      stock: newStock,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error updating stock in Firebase:", error)
    }
    // Silently fail for permission denied (app continues with localStorage)
  }
}

/**
 * Get all categories from Firebase
 * Returns null if permission denied or error occurs
 */
export const getCategoriesFromFirebase = async () => {
  try {
    const categoriesRef = ref(database, "inventories/categories")
    const snapshot = await get(categoriesRef)
    if (snapshot.exists()) {
      return snapshot.val()
    }
    return null
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error fetching categories from Firebase:", error)
    }
    return null
  }
}

/**
 * Initialize categories in Firebase if they don't exist
 * Silently fails if permission denied
 */
export const initializeCategoriesInFirebase = async () => {
  try {
    const categories = {
      chicken: { name: "Chicken", requiresUtensils: true },
      liempo: { name: "Liempo", requiresUtensils: true },
      meals: { name: "Meals", requiresUtensils: true },
      sisig: { name: "Sisig", requiresUtensils: false },
      rice: { name: "Rice", requiresUtensils: false },
      "raw-stock": { name: "Raw Stocks", requiresUtensils: false, isRawStock: true },
      container: { name: "Container", requiresUtensils: false, isContainer: true },
      utensil: { name: "Utensil", requiresUtensils: false, isUtensil: true },
    }

    const categoriesRef = ref(database, "inventories/categories")
    await set(categoriesRef, categories)
    console.log("Categories initialized in Firebase")
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error initializing categories in Firebase:", error)
    }
    // Silently continue - app works with localStorage
  }
}

/**
 * Get inventory item from Firebase
 * Returns null if permission denied or error occurs
 */
export const getInventoryItemFromFirebase = async (itemId: string) => {
  try {
    const itemRef = ref(database, `inventories/items/${itemId}`)
    const snapshot = await get(itemRef)
    if (snapshot.exists()) {
      return snapshot.val()
    }
    return null
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error fetching item from Firebase:", error)
    }
    return null
  }
}

/**
 * Get all inventory from Firebase
 * Returns empty array if permission denied or error occurs
 */
export const getAllInventoryFromFirebase = async () => {
  try {
    const inventoryRef = ref(database, "inventories/items")
    const snapshot = await get(inventoryRef)
    if (snapshot.exists()) {
      return Object.values(snapshot.val())
    }
    return []
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error fetching inventory from Firebase:", error)
    }
    return []
  }
}

/**
 * Sync local inventory to Firebase (for bulk operations)
 * Silently fails if permission denied
 */
export const syncLocalToFirebase = async () => {
  try {
    if (typeof window === "undefined") return

    const localInventory = localStorage.getItem("yellowbell_inventory_items")
    const localOrders = localStorage.getItem("yellowbell_customer_orders")
    const localKitchen = localStorage.getItem("yellowbell_kitchen_items")

    if (localInventory) {
      const items = JSON.parse(localInventory)
      await saveInventoryToFirebase(items)
      // Also sync menu items (food items from inventory)
      await saveMenuToFirebase(items)
    }

    if (localOrders) {
      const orders = JSON.parse(localOrders)
      const ordersRef = ref(database, "inventories/orders")
      const updates: Record<string, any> = {}
      orders.forEach((order: CustomerOrder) => {
        updates[order.id] = {
          ...order,
          lastUpdated: new Date().toISOString(),
        }
      })
      await update(ordersRef.parent!, updates)
    }

    console.log("Local data synced to Firebase successfully (including menu)")
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error syncing local data to Firebase:", error)
    }
    // Continue silently - app works with localStorage
  }
}

/**
 * Test Firebase connection
 * Returns false if permission denied
 */
export const testFirebaseConnection = async (): Promise<boolean> => {
  try {
    const testRef = ref(database, "inventories/test")
    await set(testRef, { timestamp: new Date().toISOString() })
    await remove(testRef)
    console.log("Firebase connection test passed")
    return true
  } catch (error: any) {
    if (error.code === "PERMISSION_DENIED") {
      console.warn(
        "Firebase PERMISSION_DENIED. App will use localStorage. " +
        "Update Firebase security rules to enable read/write access."
      )
      return false
    }
    console.error("Firebase connection test failed:", error)
    return false
  }
}

/**
 * Sync menu changes back to inventories/items path
 * Called by menu listener to keep both paths in sync when manual edits occur
 */
export const syncMenuToInventoryItems = async (
  itemId: string,
  menuItemData: any
) => {
  try {
    const inventoryRef = ref(database, `inventories/items/${itemId}`)
    // Only sync relevant fields: stock and status
    const syncData = {
      stock: menuItemData.stock,
      status: menuItemData.status,
      lastUpdated: menuItemData.lastUpdated,
    }
    await update(inventoryRef, syncData)
    console.log(`Menu change synced to inventories/items/${itemId}`)
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error syncing menu to inventory items:", error)
    }
  }
}
/**
 * Save the orders-page format order to Firebase RTDB under /ordersPage/{id} AND /inventories/orders/{id}
 * Writing to both nodes ensures every real-time listener on every device fires immediately.
 */
export const saveOrdersPageToFirebase = async (orderId: string, order: any) => {
  try {
    const { set, ref: fbRef } = await import("firebase/database")
    const clean = cleanUndefined({ ...order, lastUpdated: new Date().toISOString() })
    await Promise.all([
      set(fbRef(database, `ordersPage/${orderId}`), clean),
      set(fbRef(database, `inventories/orders/${orderId}`), clean),
    ])
  } catch (error: any) {
    if (error?.code !== "PERMISSION_DENIED") {
      console.warn("[firebase-sync] saveOrdersPageToFirebase failed:", error)
    }
  }
}

/**
 * Load all orders-page orders from Firebase RTDB and merge into localStorage.
 * Called once on app init so yellowbell_orders is always populated from Firebase.
 */
/**
 * Fetch orders from RTDB once immediately (not a listener).
 * Called on every page mount so admins see current data instantly
 * without waiting for the onValue listener to fire its first event.
 */
/**
 * Fetch kitchen items from RTDB immediately on page mount.
 * Ensures all admins see the correct kitchen state without waiting for onValue.
 */
/**
 * Rebuild kitchen items from /inventories/orders if /inventories/kitchen is missing items.
 * Called on kitchen page mount to ensure all orders have corresponding kitchen items.
 * This handles the case where orders were placed before kitchen→Firebase sync was deployed.
 */
export const rebuildKitchenFromOrders = async (): Promise<void> => {
  if (typeof window === 'undefined') return
  try {
    const { get, ref: dbRef, set: dbSet } = await import('firebase/database')
    const [ordersSnap, kitchenSnap] = await Promise.all([
      get(dbRef(database, 'inventories/orders')),
      get(dbRef(database, 'inventories/kitchen')),
    ])

    if (!ordersSnap.exists()) return

    const orders = Object.values(ordersSnap.val() as Record<string, any>)
    const FINAL = new Set(['delivered', 'served', 'cancelled', 'canceled', 'completed'])
    const activeOrders = orders.filter((o: any) => !FINAL.has((o.status || '').toLowerCase()))

    // Get existing kitchen items
    const existingKitchen: Record<string, any> = kitchenSnap.exists() ? kitchenSnap.val() : {}
    const existingOrderIds = new Set(
      Object.values(existingKitchen).map((k: any) => k.orderId)
    )

    // Find active orders that have NO kitchen items yet
    const missingOrders = activeOrders.filter((o: any) => !existingOrderIds.has(o.id))
    if (missingOrders.length === 0) {
      console.log('[firebase-sync] rebuildKitchenFromOrders: all orders have kitchen items')
      return
    }

    console.log(`[firebase-sync] rebuilding kitchen items for ${missingOrders.length} orders missing from /inventories/kitchen`)

    // Build kitchen items for missing orders
    const newKitchenItems: Record<string, any> = { ...existingKitchen }
    missingOrders.forEach((order: any) => {
      const items = order.orderedItems || order.items || []
      items.forEach((item: any) => {
        const id = `${order.id}_${item.name}`.replace(/[^a-zA-Z0-9_]/g, '_')
        newKitchenItems[id] = {
          id,
          orderId: order.id,
          customerName: order.customerName,
          name: item.name,
          itemName: item.name,
          quantity: item.quantity,
          totalOrdered: item.quantity,
          totalCooked: 0,
          pending: item.quantity,
          status: 'to-cook',
          category: 'other',
          cookedItems: order.cookedItems || [],
        }
      })
    })

    // Write rebuilt kitchen items to Firebase
    await dbSet(dbRef(database, 'inventories/kitchen'), newKitchenItems)
    const itemsArray = Object.values(newKitchenItems)
    localStorage.setItem('yellowbell_kitchen_items', JSON.stringify(itemsArray))
    window.dispatchEvent(new CustomEvent('firebase-kitchen-updated', { detail: newKitchenItems }))
    window.dispatchEvent(new Event('kitchen-updated'))
    console.log(`[firebase-sync] rebuilt ${itemsArray.length} kitchen items from ${activeOrders.length} active orders`)
  } catch (e) {
    console.warn('[firebase-sync] rebuildKitchenFromOrders failed:', e)
  }
}

export const fetchKitchenNow = async (): Promise<void> => {
  if (typeof window === 'undefined') return
  try {
    const { get, ref: dbRef } = await import('firebase/database')
    const snap = await get(dbRef(database, 'inventories/kitchen'))
    if (snap.exists()) {
      const items = snap.val()
      const itemsArray = Object.values(items)
      localStorage.setItem('yellowbell_kitchen_items', JSON.stringify(itemsArray))
      window.dispatchEvent(new CustomEvent('firebase-kitchen-updated', { detail: items }))
      window.dispatchEvent(new Event('kitchen-updated'))
      console.log(`[firebase-sync] fetchKitchenNow: ${itemsArray.length} kitchen items loaded`)
    }
  } catch (e) {
    console.warn('[firebase-sync] fetchKitchenNow failed:', e)
  }
}

export const fetchOrdersNow = async (): Promise<void> => {
  if (typeof window === 'undefined') return
  try {
    const { get, ref: dbRef } = await import('firebase/database')
    const snap = await get(dbRef(database, 'inventories/orders'))
    if (snap.exists()) {
      const raw = snap.val()
      const orders = Object.values(raw as Record<string, any>).filter((o: any) => !isStaleOrder(o))
      localStorage.setItem('yellowbell_customer_orders', JSON.stringify(orders))
      window.dispatchEvent(new CustomEvent('firebase-orders-updated', { detail: { orders } }))
      window.dispatchEvent(new Event('customer-orders-updated'))
      console.log(`[firebase-sync] fetchOrdersNow: ${orders.length} orders loaded instantly`)
    } else {
      localStorage.setItem('yellowbell_customer_orders', JSON.stringify([]))
      window.dispatchEvent(new CustomEvent('firebase-orders-updated', { detail: { orders: [] } }))
    }
  } catch (e) {
    console.warn('[firebase-sync] fetchOrdersNow failed:', e)
  }
}

export const loadOrdersPageFromFirebase = async (): Promise<void> => {
  try {
    const { get, ref: fbRef } = await import("firebase/database")
    const snap = await get(fbRef(database, "ordersPage"))
    if (!snap.exists()) return
    const remote: any[] = Object.values(snap.val())
    // Merge with existing localStorage orders (local takes precedence on same id)
    const existing: any[] = (() => {
      try { return JSON.parse(localStorage.getItem("yellowbell_orders") || "[]") } catch { return [] }
    })()
    const existingIds = new Set(existing.map((o: any) => o.id))
    const merged = [...existing]
    remote.forEach(o => { if (o?.id && !existingIds.has(o.id)) merged.push(o) })
    localStorage.setItem("yellowbell_orders", JSON.stringify(merged))
    window.dispatchEvent(new Event("orders-updated"))
    console.log(`[firebase-sync] Loaded ${remote.length} orders from Firebase ordersPage, merged ${merged.length - existing.length} new`)
  } catch (err) {
    console.warn("[firebase-sync] loadOrdersPageFromFirebase failed:", err)
  }
}

/**
 * Load order history from Firebase RTDB /orderHistory node.
 * RTDB is the single source of truth — localStorage history is REPLACED, not merged.
 * This eliminates ghost orders that accumulated in localStorage from old sessions.
 */
export const loadOrderHistoryFromFirebase = async (): Promise<void> => {
  try {
    const { get, ref: fbRef } = await import("firebase/database")
    const HISTORY_KEY = 'yellowbell_order_history'

    // Fetch both history and active orders in parallel
    const [histSnap, activeSnap] = await Promise.all([
      get(fbRef(database, "orderHistory")),
      get(fbRef(database, "inventories/orders")),
    ])

    // Active order IDs — these should NOT appear in history
    const activeIds = new Set<string>()
    if (activeSnap.exists()) {
      Object.values(activeSnap.val() as Record<string, any>).forEach((o: any) => {
        if (o?.id) activeIds.add(o.id)
      })
    }

    if (!histSnap.exists()) {
      // No RTDB history at all — wipe localStorage history to remove ghosts
      localStorage.setItem(HISTORY_KEY, JSON.stringify([]))
      window.dispatchEvent(new Event("orders-updated"))
      return
    }

    // Use RTDB as the ONLY source — filter out anything still active
    const remote: any[] = Object.values(histSnap.val() as Record<string, any>)
      .filter((o: any) => o?.id && !activeIds.has(o.id))

    remote.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

    // REPLACE localStorage entirely — no merging, no ghost accumulation
    localStorage.setItem(HISTORY_KEY, JSON.stringify(remote))
    window.dispatchEvent(new Event("orders-updated"))
    console.log(`[firebase-sync] Order history replaced: ${remote.length} orders from RTDB (active IDs excluded: ${activeIds.size})`)
  } catch (err) {
    console.warn("[firebase-sync] loadOrderHistoryFromFirebase failed:", err)
  }
}
/**
 * Delete an order from all Firebase RTDB nodes so all admins see the deletion instantly.
 * Removes from /inventories/orders/{id} AND /ordersPage/{id}
 */
export const deleteOrderFromFirebase = async (orderId: string): Promise<void> => {
  try {
    const { remove } = await import("firebase/database")
    await Promise.all([
      remove(ref(database, `inventories/orders/${orderId}`)),
      remove(ref(database, `ordersPage/${orderId}`)),
    ])
    console.log(`[firebase-sync] Deleted order ${orderId} from Firebase`)
  } catch (err: any) {
    if (err?.code !== 'PERMISSION_DENIED') {
      console.warn('[firebase-sync] deleteOrderFromFirebase failed:', err)
    }
  }
}