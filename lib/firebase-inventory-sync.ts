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

/**
 * Initialize Firebase sync on app start
 * Sets up real-time listeners for inventory, orders, kitchen items, and menu
 * Gracefully falls back to localStorage if permissions are denied
 */
export const initializeFirebaseSync = () => {
  if (typeof window === "undefined") return

  try {
    // Set up inventory items listener with error handling
    const inventoryRef = ref(database, "inventories/items")
    inventoryListener = onValue(
      inventoryRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const items = snapshot.val()
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
      (error) => {
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

    // Set up orders listener with error handling
    const ordersRef = ref(database, "inventories/orders")
    ordersListener = onValue(
      ordersRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const orders = snapshot.val()
          window.dispatchEvent(
            new CustomEvent("firebase-orders-updated", { detail: orders })
          )
          localStorage.setItem(
            "yellowbell_customer_orders",
            JSON.stringify(Object.values(orders))
          )
        }
      },
      (error) => {
        if (error.code === "PERMISSION_DENIED") {
          console.warn(
            "Firebase permission denied for inventories/orders. Using localStorage only."
          )
        } else {
          console.error("Firebase orders sync error:", error)
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
      (error) => {
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
      (error) => {
        if (error.code === "PERMISSION_DENIED") {
          console.warn(
            "Firebase permission denied for menu. Using localStorage only."
          )
        } else {
          console.error("Firebase menu sync error:", error)
        }
      }
    )

    console.log("Firebase sync initialized with menu support (with fallback to localStorage)")
  } catch (error) {
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
    await set(itemRef, {
      ...item,
      lastUpdated: new Date().toISOString(),
    })
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
 * Falls back silently if permissions denied
 */
export const updateMenuStockInFirebase = async (
  itemId: string,
  newStock: number,
  status: "in-stock" | "low-stock" | "out-of-stock"
) => {
  try {
    // Update both paths to keep them in sync:
    // 1. menu/{itemId} - for backward compatibility
    // 2. inventories/items/{itemId} - for the listener that watches this path
    const updateData = {
      stock: newStock,
      status: status,
      lastUpdated: new Date().toISOString(),
    }

    const menuItemRef = ref(database, `menu/${itemId}`)
    const inventoryItemRef = ref(database, `inventories/items/${itemId}`)

    await Promise.all([
      update(menuItemRef, updateData),
      update(inventoryItemRef, updateData),
    ])

    console.log(
      `Stock updated for item ${itemId}: ${newStock} (${status})`
    )
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error updating stock in Firebase:", error)
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

/**
 * Customer order to Firebase
 * Falls back silently if permissions denied
 */
export const saveOrderToFirebase = async (orderId: string, order: CustomerOrder) => {
  try {
    const orderRef = ref(database, `inventories/orders/${orderId}`)
    await set(orderRef, {
      ...order,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error: any) {
    if (error.code !== "PERMISSION_DENIED") {
      console.error("Error saving order to Firebase:", error)
    }
    // Silently fail for permission denied (app continues with localStorage)
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
