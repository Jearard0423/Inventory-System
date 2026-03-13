// This is a copy of inventory-store.ts with the deliveryMethod added to CustomerOrder interface
// The original file will be replaced with this one

export interface KitchenItem {
  id: string
  name: string
  totalOrdered: number
  totalCooked: number
  pending: number
  category: string
  orderId?: string
  orderedItemId?: string
  status?: 'pending' | 'cooking' | 'ready' | 'served' | 'to-cook' | 'cooked'
  customerName: string
  itemName: string
  cookedAt?: string
  quantity?: number
}

export interface InventoryItem {
  id: string
  name: string
  category: string
  stock: number
  price: number
  status: "in-stock" | "low-stock" | "out-of-stock"
  isUtensil?: boolean
  isContainer?: boolean
  linkedItems?: Array<{ itemId: string; ratio: number }>
}

export interface Order {
  id: string
  orderNumber: string
  customerName: string
  items: Array<{ id: string; name: string; quantity: number; price: number }>
  total: number
  date: string
  createdAt?: string
  status: "pending" | "completed"
  paymentStatus: "paid" | "not-paid"
  paymentMethod?: "cash" | "gcash"
  gcashPhone?: string
  gcashReference?: string
  deliveryPhone?: string
  deliveryAddress?: string
  deliveryType?: "Hand in" | "Lalamove"
  specialRequests?: string
  remarks?: string
  mealType?: string
  originalMealType?: string
  cookTime?: string
}

export interface OrderItem {
  name: string
  quantity: number
  price?: number
  id?: string
}

export interface CustomerOrder {
  id: string
  orderNumber?: string
  customerName: string
  orderedItems: OrderItem[]
  cookedItems: OrderItem[]
  status: "incomplete" | "complete" | "delivered" | "cooking" | "ready" | "served"
  createdAt: string
  date?: string          // delivery/cooking date (YYYY-MM-DD), set by date picker in new-order
  deliveryPhone?: string
  deliveryAddress?: string
  mealType?: string
  originalMealType?: string
  cookTime?: string
  deliveryMethod?: 'hand-in' | 'lalamove'
  isDelivery?: boolean
  paymentStatus?: 'paid' | 'unpaid'
  paymentMethod?: 'cash' | 'gcash'
  total?: number
  remarks?: string
  specialRequests?: string
}

// localStorage keys
const KITCHEN_ITEMS_KEY = 'yellowbell_kitchen_items';
const CUSTOMER_ORDERS_KEY = 'yellowbell_customer_orders';
const DELIVERY_ORDERS_KEY = 'yellowbell_delivery_orders';
const INVENTORY_ITEMS_KEY = 'yellowbell_inventory_items';
// Separate key for permanent order history (never pruned by kitchen cleanup)
const ORDER_HISTORY_KEY = 'yellowbell_order_history';

// Load data from localStorage
// define list and helper early so they are available during module evaluation
const ORDERS_TO_REMOVE: string[] = [
  'ORD-2952','ORD-9095','ORD-1423','ORD-1760',
  'ORD-1267','ORD-8444','ORD-4974','ORD-2941','ORD-5413','ORD-2852',
  // Latest screenshot stale orders
  'ORD-3053','ORD-2052'
];

// Utility to purge unwanted orders from a serialized array stored under `key`
function purgeOrdersFromKey(key: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    let arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return 0;
    const before = arr.length;
    arr = arr.filter((o: any) => {
      if (!o) return false;
      const onum = (o.orderNumber || '').toString().trim();
      const oid = (o.id || o.orderId || '').toString().trim();
      // also check kitchen items which use orderId
      return !ORDERS_TO_REMOVE.includes(onum) && !ORDERS_TO_REMOVE.includes(oid);
    });
    if (arr.length < before) {
      localStorage.setItem(key, JSON.stringify(arr));
      console.log(`[inventory-store] Purged ${before - arr.length} entries from ${key}`);
    }
    return before - arr.length;
  } catch (e) {
    console.warn(`[inventory-store] Failed to purge orders from ${key}:`, e);
    return 0;
  }
}

const loadFromLocalStorage = () => {
  if (typeof window !== 'undefined') {
    // make sure the unwanted orders are removed from storage before we read
    ['yellowbell_customer_orders','yellowbell_orders','yellowbell_delivery_orders','yellowbell_kitchen_items'].forEach(key => {
      purgeOrdersFromKey(key);
    });

    try {
      const kitchenItemsData = localStorage.getItem(KITCHEN_ITEMS_KEY);
      const customerOrdersData = localStorage.getItem(CUSTOMER_ORDERS_KEY);
      const deliveryOrdersData = localStorage.getItem(DELIVERY_ORDERS_KEY);
      const inventoryItemsData = localStorage.getItem(INVENTORY_ITEMS_KEY);
      
      const parsed = {
        kitchenItems: kitchenItemsData ? JSON.parse(kitchenItemsData) : [],
        customerOrders: customerOrdersData ? JSON.parse(customerOrdersData) : [],
        deliveryOrders: deliveryOrdersData ? JSON.parse(deliveryOrdersData) : [],
        inventoryItems: inventoryItemsData ? JSON.parse(inventoryItemsData) : []
      };

      // additional defensive filtering
      const filterOrders = (arr: any[]) => {
        if (!Array.isArray(arr)) return [];
        return arr.filter(o => {
          if (!o) return false;
          const onum = (o.orderNumber || '').toString().trim();
          const oid = (o.id || o.orderId || '').toString().trim();
          return !ORDERS_TO_REMOVE.includes(onum) && !ORDERS_TO_REMOVE.includes(oid);
        });
      };

      parsed.kitchenItems = parsed.kitchenItems.filter((item: any) => {
        const oid = (item.orderId || '').toString().trim();
        return !ORDERS_TO_REMOVE.includes(oid);
      });
      parsed.customerOrders = filterOrders(parsed.customerOrders);
      parsed.deliveryOrders = filterOrders(parsed.deliveryOrders);

      return parsed;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return {
        kitchenItems: [],
        customerOrders: [],
        deliveryOrders: [],
        inventoryItems: []
      };
    }
  }
  return {
    kitchenItems: [],
    customerOrders: [],
    deliveryOrders: [],
    inventoryItems: []
  };
};

// Save data to localStorage and optionally Firebase
const saveToLocalStorage = (key: string, data: any) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      
      // Dispatch events for real-time updates
      if (key === INVENTORY_ITEMS_KEY) {
        console.log('[inventory-store] Saving inventory to localStorage and syncing to Firebase...');
        window.dispatchEvent(new Event("inventory-updated"));
        // Also try to sync to Firebase asynchronously (inventory + menu)
        try {
          const { saveInventoryToFirebase, saveMenuToFirebase } = require('./firebase-inventory-sync');
          console.log('[inventory-store] Firebase sync functions loaded, syncing data...');
          saveInventoryToFirebase(data).catch((err: any) => {
            console.warn('Firebase inventory sync failed (non-critical):', err);
          });
          // Also sync menu items (food items from inventory)
          saveMenuToFirebase(data).catch((err: any) => {
            console.warn('Firebase menu sync failed (non-critical):', err);
          });
        } catch (err) {
          // Firebase sync not available, continue without it
          console.warn('[inventory-store] Firebase sync not available:', err);
        }
      }
      if (key === CUSTOMER_ORDERS_KEY) {
        window.dispatchEvent(new Event("orders-updated"));
      }
      if (key === KITCHEN_ITEMS_KEY) {
        window.dispatchEvent(new Event("kitchen-updated"));
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }
};

// Ingredient and container mapping for meals
const MEAL_INGREDIENTS_MAP: Record<string, { ingredient: string; category: string }> = {
  'Chicken Yangchow Meal': { ingredient: 'Roast Chicken', category: 'chicken' },
  'Liempo Meal': { ingredient: 'Roast Liempo Medium', category: 'liempo' },
  'Kare Kare Liempo Meal': { ingredient: 'Roast Liempo Medium', category: 'liempo' },
  'Sisig Meal': { ingredient: 'Sisig Family', category: 'sisig' },
};

// Raw stock deduction mapping
export const RAW_STOCK_DEDUCTION_MAP: Record<string, { rawStock: string; amount: number }> = {
  'Roast Chicken': { rawStock: 'Whole Chicken', amount: 1 },
  'Chicken Yangchow Meal': { rawStock: 'Whole Chicken', amount: 0.25 },
  'Roast Liempo Jumbo': { rawStock: 'Whole Liempo', amount: 1 },
  'Roast Liempo Medium': { rawStock: 'Whole Liempo', amount: 0.5 },
  'Sisig Family': { rawStock: 'Whole Liempo', amount: 0.5 },
  'Sisig Sharing': { rawStock: 'Whole Liempo', amount: 0.5 },
  'Sisig Party Tray': { rawStock: 'Whole Liempo', amount: 0.5 },
  'Liempo Meal': { rawStock: 'Whole Liempo', amount: 0.5 },
  'Kare Kare Liempo Meal': { rawStock: 'Whole Liempo', amount: 0.5 },
  'Sisig Meal': { rawStock: 'Whole Liempo', amount: 0.5 },
};

// Container mapping by category
const CONTAINER_MAP: Record<string, string> = {
  'chicken': 'Paper Box',
  'liempo': 'Paper Box',
  'sisig': 'Paper Box',
  'meals': 'Paper Box',
  'rice': 'Paper Box',
};

// Save inventory item to Firestore - will be imported from firestore-sync
// This is defined here as a wrapper for now
export const saveInventoryItemToFirebase = async (item: InventoryItem) => {
  try {
    // Async import to avoid circular dependency
    const { saveInventoryToFirestore } = await import('./firestore-sync');
    await saveInventoryToFirestore(item);
  } catch (error) {
    console.warn('Firestore save failed:', error);
  }
};

// Load initial data from localStorage (this will purge unwanted orders first)

// ensure purge helper is available before reading
// (the purge logic defined later will run here via function hoisting)
const initialData = loadFromLocalStorage();

// sanitize anything loaded just in case
if (initialData) {
  const filterOrders = (arr: any[]) => {
    if (!Array.isArray(arr)) return [];
    return arr.filter(o => {
      if (!o) return false;
      const onum = (o.orderNumber || '').toString().trim();
      const oid = (o.id || o.orderId || '').toString().trim();
      return !ORDERS_TO_REMOVE.includes(onum) && !ORDERS_TO_REMOVE.includes(oid);
    });
  };
  initialData.kitchenItems = initialData.kitchenItems.filter((item: any) => {
    const oid = (item.orderId || '').toString().trim();
    return !ORDERS_TO_REMOVE.includes(oid);
  });
  initialData.customerOrders = filterOrders(initialData.customerOrders);
  initialData.deliveryOrders = filterOrders(initialData.deliveryOrders);
}

// In-memory storage for kitchen items (loaded from localStorage)
let kitchenItems: KitchenItem[] = initialData.kitchenItems;

// Customer orders: seed from localStorage immediately so the UI is never blank on load.
// Firebase RTDB will overwrite this within seconds via the firebase-orders-updated event.
// This means future-dated orders are always visible, even before Firebase responds.
let customerOrders: CustomerOrder[] = (() => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOMER_ORDERS_KEY);
    if (!raw) return [];
    const parsed: CustomerOrder[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Only exclude hardcoded bad orders — keep everything else including future orders
    return parsed.filter(o => {
      if (!o) return false;
      const onum = (o.orderNumber || '').toString().trim();
      const oid  = (o.id || '').toString().trim();
      return !ORDERS_TO_REMOVE.includes(onum) && !ORDERS_TO_REMOVE.includes(oid);
    });
  } catch { return []; }
})();

// In-memory storage for delivery orders (loaded from localStorage)
let deliveryOrders: CustomerOrder[] = initialData.deliveryOrders;

// In-memory storage for inventory items (loaded from localStorage)
let inventoryItems: InventoryItem[] = initialData.inventoryItems;

// Generate a unique ID
const generateId = () => Math.random().toString(36).substr(2, 9);

// Generate a simple order number
const generateOrderNumber = () => {
  const sequence = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
  return `ORD-${sequence}`;
};


// Initialize with sample customer orders if empty
const initializeCustomerOrders = () => {
  // If there are any persisted orders, filter out the known unwanted ones
  try {
    if (Array.isArray(customerOrders) && customerOrders.length > 0) {
      const before = customerOrders.length;
      customerOrders = customerOrders.filter(o => {
        if (!o) return false;
        const onum = (o.orderNumber || '').toString().trim();
        const oid = (o.id || '').toString().trim();
        return !ORDERS_TO_REMOVE.includes(onum) && !ORDERS_TO_REMOVE.includes(oid);
      });
      if (customerOrders.length < before) {
        try {
          saveToLocalStorage(CUSTOMER_ORDERS_KEY, customerOrders);
          console.log(`[inventory-store] Removed ${before - customerOrders.length} unwanted orders from localStorage`);
        } catch (e) {
          console.warn('[inventory-store] Failed to persist order cleanup to localStorage', e);
        }
      }
    }
  } catch (err) {
    console.warn('[inventory-store] Error during initializeCustomerOrders cleanup:', err);
  }

  if (customerOrders.length === 0) {
    customerOrders = [];
  }
};

// Force reset inventory to new menu items
const resetInventoryToNewMenu = () => {
  const newInventoryItems: InventoryItem[] = [
    // Raw Stocks (main inventory)
    { id: 'raw1', name: 'Whole Chicken', category: 'raw-stock', stock: 10, price: 0, status: 'in-stock' },
    { id: 'raw2', name: 'Whole Liempo', category: 'raw-stock', stock: 10, price: 0, status: 'in-stock' },
    
    // Food Items Only (visible to customers) - linked to raw stocks
    { id: '1', name: 'Roast Chicken', category: 'chicken', stock: 10, price: 360, status: 'in-stock', linkedItems: [{ itemId: 'raw1', ratio: 1 }] },
    { id: '2', name: 'Chicken Yangchow Meal', category: 'meals', stock: 10, price: 160, status: 'in-stock', linkedItems: [{ itemId: 'raw1', ratio: 0.25 }] },
    { id: '3', name: 'Roast Liempo Jumbo', category: 'liempo', stock: 10, price: 590, status: 'in-stock', linkedItems: [{ itemId: 'raw2', ratio: 1 }] },
    { id: '4', name: 'Roast Liempo Medium', category: 'liempo', stock: 10, price: 295, status: 'in-stock', linkedItems: [{ itemId: 'raw2', ratio: 0.5 }] },
    { id: '5', name: 'Sisig Family', category: 'sisig', stock: 10, price: 299, status: 'in-stock', linkedItems: [{ itemId: 'raw2', ratio: 0.5 }] },
    { id: '6', name: 'Sisig Sharing', category: 'sisig', stock: 10, price: 150, status: 'in-stock', linkedItems: [{ itemId: 'raw2', ratio: 0.25 }] },
    { id: '7', name: 'Sisig Party Tray', category: 'sisig', stock: 10, price: 1550, status: 'in-stock', linkedItems: [{ itemId: 'raw2', ratio: 1 }] },
    { id: '8', name: 'Liempo Meal', category: 'meals', stock: 10, price: 190, status: 'in-stock', linkedItems: [{ itemId: 'raw2', ratio: 0.5 }] },
    { id: '9', name: 'Kare Kare Liempo Meal', category: 'meals', stock: 10, price: 195, status: 'in-stock', linkedItems: [{ itemId: 'raw2', ratio: 0.5 }] },
    { id: '10', name: 'Sisig Meal', category: 'meals', stock: 10, price: 190, status: 'in-stock', linkedItems: [{ itemId: 'raw2', ratio: 0.5 }] },
    { id: '11', name: 'Yang Chow Party Tray', category: 'rice', stock: 10, price: 360, status: 'in-stock' },
    { id: '12', name: 'Yang Chow Sharing', category: 'rice', stock: 10, price: 260, status: 'in-stock' },
    
    // Containers (hidden from menu, only for inventory tracking)
    { id: '14', name: 'Small Container', category: 'container', stock: 10, price: 10, status: 'in-stock', isContainer: true },
    { id: '15', name: 'Medium Container', category: 'container', stock: 10, price: 15, status: 'in-stock', isContainer: true },
    { id: '16', name: 'Big Container', category: 'container', stock: 10, price: 20, status: 'in-stock', isContainer: true },
    { id: '17', name: 'Paper Box', category: 'container', stock: 10, price: 8, status: 'in-stock', isContainer: true },
    
    // Utensils (hidden from menu, only for inventory tracking)
    { id: '18', name: 'Fork', category: 'utensil', stock: 10, price: 5, status: 'in-stock', isUtensil: true },
    { id: '19', name: 'Spoon', category: 'utensil', stock: 10, price: 5, status: 'in-stock', isUtensil: true },
  ];
  
  inventoryItems = [...newInventoryItems];
  
  // Save to localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(inventoryItems));
      console.log('Inventory reset to new menu items');
    } catch (error) {
      console.error('Error saving updated inventory to localStorage:', error);
    }
  }
};

// Initialize with sample inventory items if empty AND localStorage is empty
// This prevents hardcoded defaults from overwriting Firebase data
// Raw stocks MUST come from Firebase, not from hardcoded defaults
const initializeInventoryItems = () => {
  // Skip initialization - inventory should be loaded from Firebase
  // Only fall back to defaults if absolutely necessary (no localStorage, no Firebase)
  if (inventoryItems.length === 0) {
    console.log('[inventory-store] Inventory is empty - waiting for Firebase data or localStorage fallback...');
    // Don't auto-populate with defaults here
    // Firebase listener will populate this when data arrives
  }
};

// Export the reset function so we can call it manually if needed
export const resetInventoryMenu = () => {
  resetInventoryToNewMenu();
};

// Initialize data
initializeCustomerOrders();
initializeInventoryItems();

// Note: removed unconditional reset here so inventory persists across reloads.

// Get current stock for a specific item
export const getItemStock = (itemId: string): number => {
  const item = inventoryItems.find(inv => inv.id === itemId);
  return item?.stock || 0;
};

// Check if item can be ordered in requested quantity
export const canOrderItem = (itemId: string, quantity: number): boolean => {
  // reuse the detail helper and ignore the message
  return getOrderLimitMessage(itemId, quantity) === null;
};

// Determine why an item cannot be ordered (returns null if it's fine)
export const getOrderLimitMessage = (itemId: string, quantity: number): string | null => {
  const menuItem = inventoryItems.find(it => it.id === itemId);
  if (!menuItem) return `Item not found`;

  // check own stock first
  if (menuItem.stock < quantity) {
    return `Only ${menuItem.stock} unit${menuItem.stock === 1 ? '' : 's'} of ${menuItem.name} in stock`;
  }

  // linked items ratios
  if (menuItem.linkedItems && menuItem.linkedItems.length > 0) {
    for (const link of menuItem.linkedItems) {
      const linked = inventoryItems.find(i => i.id === link.itemId);
      if (!linked) return `Required raw item missing`;
      const required = link.ratio * quantity;
      if ((linked.stock || 0) < required) {
        return `Only ${linked.stock} unit${linked.stock === 1 ? '' : 's'} of ${linked.name} available (need ${required})`;
      }
    }
  }

  // raw deduction map
  const rawDeduction = RAW_STOCK_DEDUCTION_MAP[menuItem.name];
  if (rawDeduction) {
    const raw = inventoryItems.find(i => i.name === rawDeduction.rawStock);
    if (!raw) return `Required raw stock ${rawDeduction.rawStock} missing`;
    const requiredRaw = rawDeduction.amount * quantity;
    if ((raw.stock || 0) < requiredRaw) {
      return `Only ${raw.stock} unit${raw.stock === 1 ? '' : 's'} of ${raw.name} available (need ${requiredRaw})`;
    }
  }

  return null;
};

// Check if all items in cart can be ordered
export const canOrderCart = (cartItems: Array<{ id: string; quantity: number }>): boolean => {
  return cartItems.every(item => canOrderItem(item.id, item.quantity));
};

// Get aggregated kitchen items by name, showing total quantities for today
export const getAggregatedKitchenItems = (): Record<string, { total: number; cooked: number; pending: number; items: KitchenItem[] }> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayItems = kitchenItems.filter(item => {
    const order = customerOrders.find(o => o.id === item.orderId);
    if (!order) return false;
    
    const itemDate = new Date(order.createdAt);
    itemDate.setHours(0, 0, 0, 0);
    
    // ignore items belonging to completed/delivered orders
    return itemDate.getTime() === today.getTime() && order.status !== 'complete' && order.status !== 'delivered';
  });
  
  const grouped: Record<string, { total: number; cooked: number; pending: number; items: KitchenItem[] }> = {};
  
  todayItems.forEach(item => {
    if (!grouped[item.itemName]) {
      grouped[item.itemName] = {
        total: 0,
        cooked: 0,
        pending: 0,
        items: []
      };
    }
    
    const quantity = item.quantity || 1;
    grouped[item.itemName].total += quantity;
    grouped[item.itemName].items.push(item);
    
    if (item.status === 'cooked') {
      grouped[item.itemName].cooked += quantity;
    } else {
      grouped[item.itemName].pending += quantity;
    }
  });
  
  return grouped;
};


export const getKitchenItems = (): KitchenItem[] => {
  return [...kitchenItems];
};

export const updateKitchenItems = (items: KitchenItem[]): void => {
  kitchenItems = [...items];
  saveToLocalStorage(KITCHEN_ITEMS_KEY, kitchenItems);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('kitchen-updated'));
  }
  // Sync to Firebase RTDB so ALL admins see kitchen changes in real-time
  try {
    const { database } = require('./firebase');
    const { ref, set } = require('firebase/database');
    const kitchenMap: Record<string, any> = {};
    kitchenItems.forEach((item: KitchenItem) => { if (item.id) kitchenMap[item.id] = item; });
    set(ref(database, 'inventories/kitchen'), kitchenMap).catch(() => {});
  } catch { /* non-critical */ }
};

export const getCustomerOrders = (): CustomerOrder[] => {
  // Always return from in-memory array which is kept in sync with Firebase RTDB.
  // This avoids ghost orders that persist in localStorage after deletion.
  return [...customerOrders];
};

// Expose a way for Firebase listener to directly replace the in-memory array
// without going through localStorage — prevents stale/ghost orders.
export const setCustomerOrdersFromRTDB = (orders: CustomerOrder[]): void => {
  customerOrders = [...orders];
  // Also update localStorage so offline fallback is current
  saveToLocalStorage(CUSTOMER_ORDERS_KEY, customerOrders);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('customer-orders-updated'));
  }
};

export const updateCustomerOrders = (orders: CustomerOrder[]): void => {
  customerOrders = [...orders];
  saveToLocalStorage(CUSTOMER_ORDERS_KEY, customerOrders);
  // Sync every order to Firebase RTDB so all admins see status changes in real-time
  try {
    const { updateOrderInFirebase } = require('./firebase-inventory-sync');
    customerOrders.forEach((order: CustomerOrder) => {
      updateOrderInFirebase(order.id, {
        status: order.status,
        cookedItems: order.cookedItems || [],
        paymentStatus: order.paymentStatus,
      }).catch(() => {});
    });
  } catch { /* non-critical */ }
};

/**
 * Order History Archive - permanent storage that survives kitchen cleanup.
 * Delivered/completed orders are written here so the history page always has them.
 */
export const getOrderHistory = (): CustomerOrder[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ORDER_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const archiveOrderToHistory = (order: CustomerOrder): void => {
  if (typeof window === 'undefined') return;
  try {
    const history = getOrderHistory();
    // Only archive if not already there
    if (!history.find(h => h.id === order.id)) {
      history.unshift(order);
      localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(history));
    } else {
      // Update existing record (e.g. status changed)
      const updated = history.map(h => h.id === order.id ? { ...h, ...order } : h);
      localStorage.setItem(ORDER_HISTORY_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('[inventory-store] Failed to archive order to history:', e);
  }
};

// Listen for Firebase real-time updates and update in-memory state accordingly.
// We avoid calling `saveToLocalStorage` here to prevent a loop back to Firebase.
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('firebase-inventory-updated', (ev: Event) => {
      if (ev instanceof CustomEvent && ev.detail) {
        try {
          const items = Object.values(ev.detail as any) as InventoryItem[]
          inventoryItems = items
          try {
            localStorage.setItem(INVENTORY_ITEMS_KEY, JSON.stringify(inventoryItems))
          } catch (err) {
            console.warn('Failed to write inventory to localStorage from Firebase update', err)
          }
          window.dispatchEvent(new Event('inventory-updated'))
        } catch (err) {
          console.error('Error applying firebase-inventory-updated:', err)
        }
      }
    })

    window.addEventListener('firebase-orders-updated', (ev: Event) => {
      if (ev instanceof CustomEvent && ev.detail) {
        try {
          // New format: { orders: CustomerOrder[] } — RTDB active orders replace in-memory array entirely
          const activeOrders: CustomerOrder[] = Array.isArray(ev.detail?.orders)
            ? ev.detail.orders
            : Array.isArray(Object.values(ev.detail))
              ? Object.values(ev.detail as any) as CustomerOrder[]
              : []

          // Replace in-memory array with RTDB truth — no merge, no stale data
          customerOrders = activeOrders
          console.log(`[inventory-store] in-memory customerOrders replaced: ${customerOrders.length} active orders`)

          try {
            localStorage.setItem(CUSTOMER_ORDERS_KEY, JSON.stringify(customerOrders))
          } catch (err) {
            console.warn('Failed to write customer orders to localStorage from Firebase update', err)
          }
          window.dispatchEvent(new Event('orders-updated'))
        } catch (err) {
          console.error('Error applying firebase-orders-updated:', err)
        }
      }
    })

    window.addEventListener('firebase-kitchen-updated', (ev: Event) => {
      if (ev instanceof CustomEvent && ev.detail) {
        try {
          const items = Object.values(ev.detail as any) as KitchenItem[]
          kitchenItems = items
          try {
            localStorage.setItem(KITCHEN_ITEMS_KEY, JSON.stringify(kitchenItems))
          } catch (err) {
            console.warn('Failed to write kitchen items to localStorage from Firebase update', err)
          }
          window.dispatchEvent(new Event('kitchen-updated'))
        } catch (err) {
          console.error('Error applying firebase-kitchen-updated:', err)
        }
      }
    })

    // Menu updates are stored under yellowbell_menu_items; some components may use this key
    window.addEventListener('firebase-menu-updated', (ev: Event) => {
      if (ev instanceof CustomEvent && ev.detail) {
        try {
          const menu = Object.values(ev.detail as any)
          try {
            localStorage.setItem('yellowbell_menu_items', JSON.stringify(menu))
          } catch (err) {
            console.warn('Failed to write menu items to localStorage from Firebase update', err)
          }
          // Dispatch inventory-updated so menu-consuming components reload from store/getInventory/getMenuItems
          window.dispatchEvent(new Event('inventory-updated'))
        } catch (err) {
          console.error('Error applying firebase-menu-updated:', err)
        }
      }
    })
  } catch (err) {
    // Non-fatal; if window listeners can't be attached, app will use localStorage
    console.warn('Could not attach Firebase update listeners in inventory-store:', err)
  }
}

export const markItemAsCooked = (itemId: string, quantity?: number, orderId?: string): boolean => {
  const item = kitchenItems.find(item => item.id === itemId);
  if (!item) return false;
  
  const cookQuantity = quantity || 1;
  item.totalCooked += cookQuantity;
  item.pending = Math.max(0, item.totalOrdered - item.totalCooked);
  item.status = 'cooked';
  item.cookedAt = new Date().toISOString();
  
  if (orderId) {
    const order = customerOrders.find(o => o.id === orderId);
    if (order) {
      // Try to locate which orderedItem this kitchen item corresponds to
      const orderedItemId = item.orderedItemId;
      let cookedSource: OrderItem | undefined;
      if (orderedItemId) {
        cookedSource = order.orderedItems.find(i => i.id === orderedItemId);
      }
      // Fallback: match by name
      if (!cookedSource) {
        cookedSource = order.orderedItems.find(i => i.name === item.itemName);
      }

      if (cookedSource) {
        if (!order.cookedItems) order.cookedItems = [];
        const existingCookedItem = order.cookedItems.find(i => i.name === cookedSource!.name);
        if (existingCookedItem) {
          existingCookedItem.quantity += cookQuantity;
        } else {
          order.cookedItems.push({ name: cookedSource.name, quantity: cookQuantity });
        }
      }

      // Update order status if all items are cooked
      const allCooked = order.orderedItems.every(orderedItem => {
        const cooked = order.cookedItems?.find(c => c.name === orderedItem.name);
        return cooked && cooked.quantity >= orderedItem.quantity;
      });

      if (allCooked) {
        order.status = 'complete';
        // Archive to permanent history immediately so it survives logout
        archiveOrderToHistory(order);
        // Sync to Firebase RTDB history so it persists across devices
        try {
          const { syncOrderToRTDB } = require('./rtdb-sync');
          syncOrderToRTDB(order).catch(() => {});
        } catch { /* non-critical */ }
      } else {
        order.status = 'cooking';
      }
    }
  }
  
  // Update the kitchen items
  updateKitchenItems([...kitchenItems]);
  // Persist customer orders update for downstream views
  saveToLocalStorage(CUSTOMER_ORDERS_KEY, customerOrders);
  // Persist kitchen items update
  saveToLocalStorage(KITCHEN_ITEMS_KEY, kitchenItems);
  return true;
};

// Helper function to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Add a new order
interface NewOrder {
  customerName: string;
  items: OrderItem[];
  deliveryPhone?: string;
  deliveryAddress?: string;
  mealType?: string;
  deliveryMethod?: 'hand-in' | 'lalamove';
  paymentStatus?: 'paid' | 'unpaid';
  total?: number;
  remarks?: string;
  specialRequests?: string;
}

export const addCustomerOrder = (order: NewOrder): CustomerOrder => {
  const newOrder: CustomerOrder = {
    id: generateId(),
    orderNumber: generateOrderNumber(),
    customerName: order.customerName,
    orderedItems: order.items.map(item => ({
      ...item,
      id: generateId(),
      price: item.price || 0
    })),
    cookedItems: [],
    status: 'incomplete',
    createdAt: new Date().toISOString(),
    deliveryPhone: order.deliveryPhone,
    deliveryAddress: order.deliveryAddress,
    mealType: order.mealType,
    deliveryMethod: order.deliveryMethod,
    paymentStatus: order.paymentStatus || 'unpaid',
    total: order.total || order.items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0),
    remarks: order.remarks,
    specialRequests: order.specialRequests,
    isDelivery: !!order.deliveryAddress
  };

  // Update kitchen items with new order quantities
  order.items.forEach(orderedItem => {
    // Find the corresponding orderedItem (with generated id) for mapping
    const mappedOrderedItem = newOrder.orderedItems.find(i => i.name === orderedItem.name);
    let kitchenItem = kitchenItems.find(item => item.name === orderedItem.name);
    if (!kitchenItem) {
      kitchenItem = {
        id: generateId(),
        name: orderedItem.name,
        totalOrdered: 0,
        totalCooked: 0,
        pending: 0,
        category: 'other',
        orderId: newOrder.id,
        orderedItemId: mappedOrderedItem?.id,
        status: 'to-cook',
        customerName: order.customerName,
        itemName: orderedItem.name,
        quantity: orderedItem.quantity
      };
      kitchenItems.push(kitchenItem);
    }
    
    kitchenItem.totalOrdered += orderedItem.quantity;
    kitchenItem.pending = kitchenItem.totalOrdered - (kitchenItem.totalCooked || 0);
    kitchenItem.status = 'to-cook';
  });

  // Add to customer orders
  customerOrders = [newOrder, ...customerOrders];
  
  return newOrder;
};

// When an order is delivered we also want to sync it to RTDB for history
// and log an analytics event. This keeps delivery and kitchen pages in sync.
export const markOrderAsDelivered = (orderId: string): boolean => {
  const orderIndex = customerOrders.findIndex(order => order.id === orderId);
  if (orderIndex === -1) return false;
  
  customerOrders[orderIndex].status = 'delivered';

  // Archive to permanent history so order-history page always has it
  archiveOrderToHistory(customerOrders[orderIndex]);

  // attempt to sync with RTDB (non-blocking)
  try {
    // require lazily to avoid circular dependency when importing from other modules
    const { syncOrderToRTDB, logOrderEvent } = require("./rtdb-sync");
    const order = customerOrders[orderIndex];
    syncOrderToRTDB(order).catch(() => {});
    logOrderEvent(order.id, order.customerName, 'delivered').catch(() => {});
  } catch (e) {
    // if RTDB isn't available just ignore
    console.warn("RTDB sync unavailable:", e);
  }
  
  // Update kitchen items
  kitchenItems = kitchenItems.map(item => {
    if (item.orderId === orderId) {
      return { ...item, status: 'served' };
    }
    return item;
  });
  
  // Persist changes
  saveToLocalStorage(CUSTOMER_ORDERS_KEY, customerOrders);
  saveToLocalStorage(KITCHEN_ITEMS_KEY, kitchenItems);

  // Sync status + kitchen to Firebase so all admins see delivery instantly
  try {
    const { updateOrderInFirebase } = require('./firebase-inventory-sync');
    updateOrderInFirebase(orderId, { status: 'delivered' }).catch(() => {});
  } catch { /* non-critical */ }
  try {
    const { database } = require('./firebase');
    const { ref, set } = require('firebase/database');
    const kitchenMap: Record<string, any> = {};
    kitchenItems.forEach((item: KitchenItem) => { if (item.id) kitchenMap[item.id] = item; });
    set(ref(database, 'inventories/kitchen'), kitchenMap).catch(() => {});
  } catch { /* non-critical */ }

  // Also update the regular orders list so Orders page moves it to history
  if (typeof window !== 'undefined') {
    try {
      const existingOrders = JSON.parse(localStorage.getItem("yellowbell_orders") || "[]")
      const updatedOrders = existingOrders.map((o: any) => o.id === orderId ? { ...o, status: 'complete' } : o)
      localStorage.setItem("yellowbell_orders", JSON.stringify(updatedOrders))
      window.dispatchEvent(new Event('orders-updated'))
      // Sync status change to Firebase ordersPage node
      try {
        const { updateOrderInFirebase } = require('./firebase-inventory-sync')
        updateOrderInFirebase(orderId, { status: 'complete' }).catch(() => {})
      } catch { /* non-critical */ }
    } catch (e) {
      // ignore
    }
  }
  
  // Dispatch events for UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event("orders-updated"));
    window.dispatchEvent(new Event("delivery-updated"));
    window.dispatchEvent(new Event("customer-orders-updated"));
    window.dispatchEvent(new Event("kitchen-updated"));
  }
  
  return true;
};

export const markOrderAsUndelivered = (orderId: string): boolean => {
  const orderIndex = customerOrders.findIndex(order => order.id === orderId);
  if (orderIndex === -1) return false;
  
  customerOrders[orderIndex].status = 'complete';
  
  // Update kitchen items
  kitchenItems = kitchenItems.map(item => {
    if (item.orderId === orderId) {
      return { ...item, status: 'cooked' };
    }
    return item;
  });
  
  // Persist changes
  saveToLocalStorage(CUSTOMER_ORDERS_KEY, customerOrders);
  saveToLocalStorage(KITCHEN_ITEMS_KEY, kitchenItems);

  // Sync undo-delivery to Firebase so all admins see it instantly
  try {
    const { updateOrderInFirebase } = require('./firebase-inventory-sync');
    updateOrderInFirebase(orderId, { status: 'complete' }).catch(() => {});
  } catch { /* non-critical */ }
  try {
    const { database } = require('./firebase');
    const { ref, set } = require('firebase/database');
    const kitchenMap: Record<string, any> = {};
    kitchenItems.forEach((item: KitchenItem) => { if (item.id) kitchenMap[item.id] = item; });
    set(ref(database, 'inventories/kitchen'), kitchenMap).catch(() => {});
  } catch { /* non-critical */ }
  
  // Dispatch events for UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event("orders-updated"));
    window.dispatchEvent(new Event("delivery-updated"));
  }
  
  return true;
};

export const getMissingItems = (orderIdOrOrder: string | CustomerOrder): Array<{ needed: number; name: string }> => {
  const order = typeof orderIdOrOrder === 'string' 
    ? customerOrders.find(order => order.id === orderIdOrOrder)
    : orderIdOrOrder;
    
  if (!order) return [];
  
  const missingItems: Array<{ needed: number; name: string }> = [];
  
  order.orderedItems.forEach(orderedItem => {
    const cookedItem = order.cookedItems?.find(item => item.name === orderedItem.name);
    if (!cookedItem || cookedItem.quantity < orderedItem.quantity) {
      const missingQty = orderedItem.quantity - (cookedItem?.quantity || 0);
      missingItems.push({ needed: missingQty, name: orderedItem.name });
    }
  });
  
  return missingItems;
};

export const getDeliveryOrders = (): CustomerOrder[] => {
  return customerOrders.filter(order => order.isDelivery);
};

export const getOrderById = (orderId: string): CustomerOrder | undefined => {
  return customerOrders.find(order => order.id === orderId);
};

export const getLowStockItems = (threshold: number = 5): InventoryItem[] => {
  return inventoryItems.filter(item => item.stock <= threshold && item.status === 'low-stock');
};

export const getInventoryItems = (): InventoryItem[] => {
  return [...inventoryItems];
};

export const updateInventoryItem = (itemId: string, newStock: number, threshold: number = 5): boolean => {
  const item = inventoryItems.find(item => item.id === itemId);
  if (!item) return false;
  
  item.stock = newStock;
  
  // Update status based on stock level
  if (newStock === 0) {
    item.status = 'out-of-stock';
  } else if (newStock <= threshold) {
    item.status = 'low-stock';
  } else {
    item.status = 'in-stock';
  }
  
  // Save to localStorage - this triggers Firebase sync via saveToLocalStorage
  saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems);

  // Also persist the single item to Firestore if available
  try {
    // Async import to avoid circular dependency when running server-side
    const { saveInventoryToFirestore } = require('./firestore-sync');
    // saveInventoryToFirestore expects an InventoryItem and returns a Promise
    try {
      console.debug('[inventory-store] saving inventory item to Firestore:', item.id, item.name)
    } catch (e) {}
    Promise.resolve(saveInventoryToFirestore(item)).catch((err: any) => {
      console.warn('Failed to save inventory item to Firestore (non-critical):', err);
    });
  } catch (err) {
    // Firestore sync not available in this environment - ignore silently
  }

  // Sync menu item to Firebase RTDB if this is a menu item (not container/utensil/raw-stock)
  if (!item.isUtensil && !item.isContainer && item.category !== 'raw-stock') {
    try {
      const { updateMenuStockInFirebase } = require('./firebase-inventory-sync');
      console.log('[inventory-store] Syncing menu stock to Firebase RTDB:', item.id, newStock);
      Promise.resolve(updateMenuStockInFirebase(itemId, newStock, item.status, item.linkedItems)).catch((err: any) => {
        console.warn('Failed to update menu stock in Firebase (non-critical):', err);
      });
    } catch (err) {
      // Firebase sync not available in this environment - ignore silently
      console.warn('[inventory-store] Firebase sync not available:', err);
    }
  } else {
    // Sync raw-stock, containers, and utensils to inventories/items directly
    try {
      const { updateInventoryItemInFirebase } = require('./firebase-inventory-sync');
      console.log('[inventory-store] Syncing inventory item to Firebase RTDB:', item.id, newStock);
      Promise.resolve(updateInventoryItemInFirebase(item)).catch((err: any) => {
        console.warn('Failed to update inventory item in Firebase (non-critical):', err);
      });
    } catch (err) {
      // Firebase sync not available in this environment - ignore silently
      console.warn('[inventory-store] Firebase sync not available:', err);
    }
  }
  
  // Dispatch event for UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('inventory-updated'));
  }
  
  return true;
};

export const getInventory = (): InventoryItem[] => {
  return [...inventoryItems];
};

// Get only food items (visible to customers in menu)
export const getMenuItems = (): InventoryItem[] => {
  return inventoryItems.filter(item => !item.isUtensil && !item.isContainer && item.category !== 'raw-stock');
};

/**
 * Force refresh inventory from Firebase
 * Useful when local state might be stale or out of sync
 * Can be called manually by the UI when needed
 */
export const forceRefreshInventoryFromFirebase = async (): Promise<InventoryItem[]> => {
  try {
    const { forceRefreshInventoryFromFirebase: fbRefresh } = await import('./firebase-inventory-sync');
    console.log('[inventory-store] Triggering force refresh from Firebase...');
    const items = await fbRefresh();
    if (items && items.length > 0) {
      inventoryItems = items as InventoryItem[];
      console.log('[inventory-store] Force refresh successful, loaded', items.length, 'items');
      window.dispatchEvent(new Event('inventory-updated'));
    }
    return items as InventoryItem[];
  } catch (err) {
    console.error('[inventory-store] Force refresh from Firebase failed:', err);
    return [];
  }
};

export const updateInventory = (items: InventoryItem[]): void => {
  // Handle linked items: bidirectional stock management
  // When a derived item stock increases, consume raw materials
  // When a derived item stock decreases, restore raw materials
  console.log('[inventory-store] updateInventory called with', items.length, 'items');
  const currentItems = [...inventoryItems];
  items.forEach(newItem => {
    const currentItem = currentItems.find(item => item.id === newItem.id);
    if (currentItem) {
      const stockChange = newItem.stock - currentItem.stock;
      console.log(`[inventory-store] Stock change for ${newItem.name}: ${currentItem.stock} → ${newItem.stock}`);
      
      if (newItem.linkedItems && newItem.linkedItems.length > 0) {
        newItem.linkedItems.forEach(link => {
          const linkedItem = items.find(item => item.id === link.itemId);
          if (linkedItem) {
            // When derived item stock increases, consume from linked items
            // When derived item stock decreases, restore to linked items
            const linkedChange = stockChange * link.ratio;
            linkedItem.stock = Math.max(0, linkedItem.stock - linkedChange);
            linkedItem.status = getStockStatus(linkedItem.stock);
          }
        });
      }
    }
  });

  inventoryItems = [...items];
  console.log('[inventory-store] Saving inventory to localStorage and syncing to Firebase...');
  saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems);
  
  // Sync to Firebase RTDB for real-time updates
  // Sync ALL items to inventories/items (including raw-stock, containers, utensils)
  items.forEach((item) => {
    try {
      const { updateMenuStockInFirebase, updateInventoryItemInFirebase } = require('./firebase-inventory-sync');
      console.log('[inventory-store] Syncing', item.name, 'stock to Firebase RTDB:', item.stock);
      
      // Sync menu items to menu path (for backward compatibility and linked items)
      if (!item.isUtensil && !item.isContainer && item.category !== 'raw-stock') {
        Promise.resolve(updateMenuStockInFirebase(item.id, item.stock, item.status, item.linkedItems)).catch((err: any) => {
          console.warn('Failed to update menu stock in Firebase (non-critical):', err);
        });
      } else {
        // Sync all other items (raw-stock, containers, utensils) to inventories/items directly
        Promise.resolve(updateInventoryItemInFirebase(item)).catch((err: any) => {
          console.warn('Failed to update inventory item in Firebase (non-critical):', err);
        });
      }
    } catch (err) {
      // Firebase sync not available in this environment - ignore
      console.warn('[inventory-store] Firebase sync not available:', err);
    }
  });
};

export const reduceStock = (itemId: string, quantity: number): boolean => {
  const item = inventoryItems.find(item => item.id === itemId);
  if (!item || item.stock < quantity) return false;
  
  item.stock -= quantity;
  
  // Update status based on stock level
  if (item.stock === 0) {
    item.status = 'out-of-stock';
  } else if (item.stock <= 5) {
    item.status = 'low-stock';
  }
  
  // Save to localStorage
  saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems);
  
  // Sync to Firebase RTDB for real-time updates
  if (!item.isUtensil && !item.isContainer && item.category !== 'raw-stock') {
    try {
      const { updateMenuStockInFirebase } = require('./firebase-inventory-sync');
      Promise.resolve(updateMenuStockInFirebase(itemId, item.stock, item.status, item.linkedItems)).catch((err: any) => {
        console.warn('Failed to update stock in Firebase (non-critical):', err);
      });
    } catch (err) {
      // Firebase sync not available - app continues with localStorage
    }
  } else {
    // Sync raw-stock, containers, and utensils to inventories/items directly
    try {
      const { updateInventoryItemInFirebase } = require('./firebase-inventory-sync');
      Promise.resolve(updateInventoryItemInFirebase(item)).catch((err: any) => {
        console.warn('Failed to update inventory item in Firebase (non-critical):', err);
      });
    } catch (err) {
      // Firebase sync not available - app continues with localStorage
    }
  }
  
  return true;
};

export const reduceUtensilsForMeal = (mealType: string): boolean => {
  // Find utensils and reduce their stock
  const utensils = inventoryItems.filter(item => item.isUtensil);
  let success = true;
  
  utensils.forEach(utensil => {
    if (utensil.stock > 0) {
      utensil.stock -= 1;
      if (utensil.stock === 0) {
        utensil.status = 'out-of-stock';
      } else if (utensil.stock <= 5) {
        utensil.status = 'low-stock';
      }
    } else {
      success = false;
    }
  });
  
  // Save to localStorage
  saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems);
  
  return success;
};

export const restoreUtensilsForQuantity = (quantity: number): boolean => {
  const utensils = inventoryItems.filter(item => item.isUtensil);
  if (utensils.length === 0) return false;

  utensils.forEach(utensil => {
    utensil.stock += quantity;
    utensil.status = getStockStatus(utensil.stock);
  });

  saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems);
  return true;
};

// Restore containers for an item (adds back quantity)
export const restoreContainerForItem = (itemName: string, quantity: number = 1): boolean => {
  let containerName = '';

  if (!itemName.includes('Roast Liempo Jumbo') && !itemName.includes('Roast Liempo Medium')) {
    if (itemName.includes('Sisig Sharing')) {
      containerName = 'Small Container';
    } else if (itemName.includes('Sisig Family') || itemName.includes('Yang Chow Sharing')) {
      containerName = 'Medium Container';
    } else if (itemName.includes('Sisig Party Tray') || itemName.includes('Yang Chow Party Tray')) {
      containerName = 'Big Container';
    } else if (itemName.includes('Chicken Yangchow Meal') || itemName.includes('Liempo Meal') || itemName.includes('Kare Kare Liempo Meal') || itemName.includes('Sisig Meal')) {
      containerName = 'Paper Box';
    }
  }

  if (containerName) {
    const container = inventoryItems.find(item => item.name === containerName && item.isContainer);
    if (container) {
      container.stock += quantity;
      container.status = getStockStatus(container.stock);
      saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems);
      return true;
    }
  }

  return false;
};

// Determine whether an item requires utensils when ordered
export const requiresUtensils = (menuItem?: InventoryItem | null): boolean => {
  if (!menuItem) return false;
  // Utensils apply to all meal/food categories except 'sisig' and 'rice' and excluding containers/utensils themselves
  if (menuItem.isContainer || menuItem.isUtensil) return false;
  const cat = (menuItem.category || '').toLowerCase();
  if (cat === 'sisig' || cat === 'rice') return false;
  return true;
};

export const reduceContainerForItem = (itemName: string, quantity: number = 1): boolean => {
  let success = true;
  let containerName = '';
  
  // Determine which container to use based on item name
  if (itemName.includes('Sisig Sharing')) {
    containerName = 'Small Container';
  } else if (itemName.includes('Sisig Family') || itemName.includes('Yang Chow Sharing')) {
    containerName = 'Medium Container';
  } else if (itemName.includes('Sisig Party Tray') || itemName.includes('Yang Chow Party Tray')) {
    containerName = 'Big Container';
  } else if (itemName.includes('Chicken Yangchow Meal') || itemName.includes('Liempo Meal') || itemName.includes('Kare Kare Liempo Meal') || itemName.includes('Sisig Meal')) {
    containerName = 'Paper Box';
  }
  
  if (containerName) {
    const container = inventoryItems.find(item => item.name === containerName && item.isContainer);
    if (container && container.stock >= quantity) {
      container.stock -= quantity;
      if (container.stock === 0) {
        container.status = 'out-of-stock';
      } else if (container.stock <= 5) {
        container.status = 'low-stock';
      }
      
      // Save to localStorage
      saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems);
    } else {
      success = false;
    }
  }
  
  return success;
};

export const saveOrder = (order: Omit<Order, 'id' | 'orderNumber' | 'createdAt'> & { createdAt?: string }): Order => {
  const newOrder: Order = {
    ...order,
    id: generateId(),
    orderNumber: generateOrderNumber(),
    createdAt: order.createdAt || new Date().toISOString(),
  };
  
  // Convert to CustomerOrder format and add to customer orders
  const customerOrder: CustomerOrder = {
    id: newOrder.id,
    orderNumber: newOrder.orderNumber,
    customerName: newOrder.customerName,
    orderedItems: newOrder.items.map(item => ({
      ...item,
      id: generateId()
    })),
    cookedItems: [],
    status: (newOrder.status === 'completed' ? 'complete' : 'incomplete') as "incomplete" | "complete" | "delivered" | "cooking" | "ready" | "served",
    createdAt: newOrder.createdAt || new Date().toISOString(),
    date: (newOrder as any).date,          // delivery/cooking date (YYYY-MM-DD) — required by reminder engine
    deliveryPhone: newOrder.deliveryPhone,
    deliveryAddress: newOrder.deliveryAddress,
    mealType: newOrder.mealType,
    originalMealType: newOrder.originalMealType,
    cookTime: newOrder.cookTime,
    deliveryMethod: newOrder.deliveryAddress ? 'lalamove' : 'hand-in',
    isDelivery: !!newOrder.deliveryAddress,
    paymentStatus: newOrder.paymentStatus === 'paid' ? 'paid' : 'unpaid',
    total: newOrder.total,
    remarks: newOrder.remarks,
    specialRequests: newOrder.specialRequests
  };
  
  customerOrders = [customerOrder, ...customerOrders];
  
  // Reduce stock for each ordered item
  newOrder.items.forEach(orderedItem => {
    const inventoryList = getInventory();
    const menuItem = inventoryList.find(item => item.id === orderedItem.id);
    const availableMenuStock = menuItem?.stock || 0;

    // If there is enough prepared/menu stock, consume it first and skip raw deductions
    if (availableMenuStock >= orderedItem.quantity) {
      reduceStock(orderedItem.id, orderedItem.quantity);
    } else {
      // Consume whatever prepared/menu stock exists
      if (availableMenuStock > 0) {
        reduceStock(orderedItem.id, availableMenuStock);
      }

      // Remaining quantity must be produced from raw stock (if mapping exists)
      const remaining = orderedItem.quantity - availableMenuStock;

      // If this meal maps to a parent ingredient (e.g., Chicken Yangchow -> Roast Chicken), reduce that ingredient for the remaining
      const ingredient = MEAL_INGREDIENTS_MAP[orderedItem.name];
      if (ingredient) {
        const ingredientItem = inventoryList.find(item => item.name === ingredient.ingredient);
        if (ingredientItem) {
          reduceStock(ingredientItem.id, remaining);
        }
      }

      // Reduce raw stock based on item type for the remaining quantity
      const rawStockDeduction = RAW_STOCK_DEDUCTION_MAP[orderedItem.name];
      if (rawStockDeduction) {
        const rawStockItem = inventoryList.find(item => item.name === rawStockDeduction.rawStock);
        if (rawStockItem) {
          const totalDeduction = rawStockDeduction.amount * remaining;
          if (totalDeduction > 0) reduceStock(rawStockItem.id, totalDeduction);
        }
      }
    }

    // If there was no menu stock at all and the meal has an ingredient mapping (already handled above),
    // ensure we still reduce the ingredient when menu stock satisfied part of the order above.
    // (ingredient deduction for full orders where menu stock covered all units is not needed)

    // Reduce container stock for all sold units (packaging used regardless of source)
    reduceContainerForItem(orderedItem.name, orderedItem.quantity);

    // Reduce utensils for applicable items (all meal/food categories except sisig and rice)
    if (requiresUtensils(menuItem)) {
      for (let i = 0; i < orderedItem.quantity; i++) {
        reduceUtensilsForMeal("meal");
      }
    }
  });

  // Dispatch inventory update event for real-time refresh
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event("inventory-updated"));
  }

  // Update kitchen items: create one kitchen entry per unit ordered (so kitchen can mark individual units)
  newOrder.items.forEach(orderedItem => {
    // Find the mapped orderedItem id generated in customerOrder
    const mappedOrderedItem = customerOrder.orderedItems.find(i => i.name === orderedItem.name);
    for (let i = 0; i < orderedItem.quantity; i++) {
      const kitchenItem = {
        id: generateId(),
        name: orderedItem.name,
        totalOrdered: 1,
        totalCooked: 0,
        pending: 1,
        category: 'other',
        orderId: customerOrder.id,
        orderedItemId: mappedOrderedItem?.id,
        status: 'to-cook',
        customerName: newOrder.customerName,
        itemName: orderedItem.name,
        quantity: 1
      } as KitchenItem;
      kitchenItems.push(kitchenItem);
    }
  });
  
  // Save to localStorage
  saveToLocalStorage(CUSTOMER_ORDERS_KEY, customerOrders);
  saveToLocalStorage(KITCHEN_ITEMS_KEY, kitchenItems);
  
  // Sync kitchen items to Firebase so ALL admins see the new items in kitchen view
  try {
    const { database } = require('./firebase');
    const { ref, set } = require('firebase/database');
    const kitchenMap: Record<string, any> = {};
    kitchenItems.forEach((item: KitchenItem) => { if (item.id) kitchenMap[item.id] = item; });
    set(ref(database, 'inventories/kitchen'), kitchenMap).catch(() => {});
  } catch { /* non-critical */ }

  // Also save to Firebase RTDB for persistence
  if (typeof window !== 'undefined') {
    try {
      const { saveOrderToFirebase } = require('./firebase-inventory-sync');
      saveOrderToFirebase(customerOrder.id, customerOrder).catch((err: any) => {
        console.warn('Firebase order sync failed (non-critical):', err);
      });
    } catch (err) {
      console.warn('[inventory-store] Firebase sync not available:', err);
    }
  }
  
  // Dispatch multiple events for real-time updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event("kitchen-updated"));
    window.dispatchEvent(new Event("customer-orders-updated"));
  }
  
  // Also save to orders format for compatibility with orders page
  if (typeof window !== 'undefined') {
    try {
      const existingOrders = JSON.parse(localStorage.getItem("yellowbell_orders") || "[]");
      const orderForOrdersPage = {
        id: newOrder.id,
        orderNumber: newOrder.orderNumber,
        customerName: newOrder.customerName,
        items: newOrder.items,
        total: newOrder.total,
        date: newOrder.date,
        createdAt: newOrder.createdAt,
        status: "pending",
        paymentStatus: newOrder.paymentStatus,
        paymentMethod: newOrder.paymentMethod,
        gcashPhone: newOrder.gcashPhone,
        gcashReference: newOrder.gcashReference,
        deliveryPhone: newOrder.deliveryPhone,
        deliveryAddress: newOrder.deliveryAddress,
        specialRequests: newOrder.specialRequests,
        remarks: newOrder.remarks,
        mealType: newOrder.mealType,
        originalMealType: newOrder.originalMealType,
        cookTime: newOrder.cookTime,
        deliveryType: newOrder.deliveryType,
      };
      
      existingOrders.unshift(orderForOrdersPage);
      localStorage.setItem("yellowbell_orders", JSON.stringify(existingOrders));
      window.dispatchEvent(new Event("orders-updated"));

      // Sync to Firebase so orders survive logout / device switch
      try {
        const { saveOrdersPageToFirebase } = require('./firebase-inventory-sync');
        saveOrdersPageToFirebase(orderForOrdersPage.id, orderForOrdersPage).catch(() => {});
      } catch { /* non-critical */ }
      
      // Create notification for new order
      const { saveNotification } = require("./notifications-store");
      saveNotification({
        type: "order",
        title: "New Order Placed",
        message: `Order #${newOrder.orderNumber} for ${newOrder.customerName} - ₱${newOrder.total}`,
        priority: newOrder.deliveryType === "Lalamove" ? "high" : "medium"
      });
      
      // Create delivery notification if applicable
      if (newOrder.deliveryType === "Lalamove" && newOrder.deliveryAddress) {
        saveNotification({
          type: "delivery",
          title: "Delivery Order",
          message: `Lalamove delivery requested for Order #${newOrder.orderNumber}`,
          priority: "high"
        });
      }
      
    } catch (error) {
      console.error('Error saving to orders localStorage:', error);
    }
  }
  
  return newOrder;
};

export const addMenuItem = (item: Omit<InventoryItem, 'id'>): InventoryItem => {
  const newItem: InventoryItem = {
    ...item,
    id: generateId(),
  };
  
  inventoryItems = [newItem, ...inventoryItems];
  
  // Save to localStorage
  saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems);
  
  // Save to Firebase
  saveInventoryItemToFirebase(newItem);
  
  // Create notification for new menu item
  if (typeof window !== 'undefined') {
    try {
      const { saveNotification } = require("./notifications-store");
      saveNotification({
        type: "inventory",
        title: "New Menu Item Added",
        message: `${newItem.name} added to ${newItem.category} - Stock: ${newItem.stock}, Price: ₱${newItem.price}`,
        priority: "low"
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }
  
  return newItem;
};

export const deleteMenuItem = (itemId: string): boolean => {
  const index = inventoryItems.findIndex(item => item.id === itemId);
  if (index === -1) return false;
  
  const deletedItem = inventoryItems[index];
  inventoryItems.splice(index, 1);
  
  // Save to localStorage
  saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems);
  
  // Create notification for deleted menu item
  if (typeof window !== 'undefined') {
    try {
      const { saveNotification } = require("./notifications-store");
      saveNotification({
        type: "inventory",
        title: "Menu Item Deleted",
        message: `${deletedItem.name} removed from ${deletedItem.category}`,
        priority: "medium"
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }
  
  return true;
};

export const getStockStatus = (stock: number): "in-stock" | "low-stock" | "out-of-stock" => {
  if (stock === 0) {
    return 'out-of-stock';
  } else if (stock <= 5) {
    return 'low-stock';
  } else {
    return 'in-stock';
  }
};

// Check stock and show warnings when adding items to cart
export const checkAndWarnStockForItem = (item: { id: string; name: string; quantity: number }) => {
  const warnings: string[] = [];
  
  // Check main item stock
  const mainItem = inventoryItems.find(inv => inv.id === item.id);
  if (mainItem && mainItem.stock <= 5) {
    warnings.push(`${item.name}: Low stock warning (${mainItem.stock} units remaining)`);
  }

  // Check container availability (excluding Roast Liempo Jumbo and Medium)
  let containerName = '';
  if (!item.name.includes('Roast Liempo Jumbo') && !item.name.includes('Roast Liempo Medium')) {
    if (item.name.includes('Sisig Sharing')) {
      containerName = 'Small Container';
    } else if (item.name.includes('Sisig Family') || item.name.includes('Yang Chow Sharing')) {
      containerName = 'Medium Container';
    } else if (item.name.includes('Sisig Party Tray') || item.name.includes('Yang Chow Party Tray')) {
      containerName = 'Big Container';
    } else if (item.name.includes('Chicken Yangchow Meal') || item.name.includes('Liempo Meal') || item.name.includes('Kare Kare Liempo Meal') || item.name.includes('Sisig Meal')) {
      containerName = 'Paper Box';
    }
  }

  if (containerName) {
    const container = inventoryItems.find(inv => inv.name === containerName && inv.isContainer);
    if (container) {
      // Check if container stock is insufficient for the quantity being added
      if (container.stock === 0) {
        warnings.push(`${containerName} is OUT OF STOCK`);
      } else if (container.stock < item.quantity) {
        warnings.push(`${containerName}: Need ${item.quantity - container.stock} more`);
      } else if (container.stock <= 5) {
        warnings.push(`${containerName}: Low stock (${container.stock} left)`);
      }
    }
  }

  // Check utensil availability for meals
  const menuItem = inventoryItems.find(inv => inv.id === item.id);
  if (requiresUtensils(menuItem)) {
    const utensils = inventoryItems.filter(inv => inv.isUtensil);
    utensils.forEach(utensil => {
      // Check if utensil stock is insufficient for the quantity being added
      if (utensil.stock === 0) {
        warnings.push(`${utensil.name} is OUT OF STOCK`);
      } else if (utensil.stock < item.quantity) {
        warnings.push(`${utensil.name}: Need ${item.quantity - utensil.stock} more`);
      } else if (utensil.stock <= 5) {
        warnings.push(`${utensil.name}: Low stock (${utensil.stock} left)`);
      }
    });
  }

  // Show notifications if there are warnings
  if (warnings.length > 0) {
    showStockNotification(warnings, false);
  }
};

// Check total cart stock requirements and show warnings
export const checkTotalCartStockRequirements = (cartItems: Array<{ id: string; name: string; quantity: number }>) => {
  const warnings: string[] = [];
  
  // Calculate total meals in cart
  const totalMeals = cartItems
    .filter(item => {
      const menuItem = inventoryItems.find(inv => inv.id === item.id);
      return requiresUtensils(menuItem);
    })
    .reduce((total, item) => total + item.quantity, 0);
  
  // Calculate container requirements
  const containerRequirements: Record<string, number> = {};
  
  cartItems.forEach(item => {
    let containerName = '';
    if (!item.name.includes('Roast Liempo Jumbo') && !item.name.includes('Roast Liempo Medium')) {
      if (item.name.includes('Sisig Sharing')) {
        containerName = 'Small Container';
      } else if (item.name.includes('Sisig Family') || item.name.includes('Yang Chow Sharing')) {
        containerName = 'Medium Container';
      } else if (item.name.includes('Sisig Party Tray') || item.name.includes('Yang Chow Party Tray')) {
        containerName = 'Big Container';
      } else if (item.name.includes('Chicken Yangchow Meal') || item.name.includes('Liempo Meal') || item.name.includes('Kare Kare Liempo Meal') || item.name.includes('Sisig Meal')) {
        containerName = 'Paper Box';
      }
    }
    
    if (containerName) {
      containerRequirements[containerName] = (containerRequirements[containerName] || 0) + item.quantity;
    }
  });
  
  // Check container stock against total requirements
  Object.entries(containerRequirements).forEach(([containerName, requiredQty]) => {
    const container = inventoryItems.find(inv => inv.name === containerName && inv.isContainer);
    if (container) {
      if (container.stock === 0) {
        warnings.push(`${containerName} is OUT OF STOCK`);
      } else if (container.stock < requiredQty) {
        warnings.push(`${containerName}: Need ${requiredQty - container.stock} more`);
      } else if (container.stock <= 5) {
        warnings.push(`${containerName}: Low stock (${container.stock} left)`);
      }
    }
  });
  
  // Check utensil stock against total meals
  if (totalMeals > 0) {
    const utensils = inventoryItems.filter(inv => inv.isUtensil);
    utensils.forEach(utensil => {
      if (utensil.stock === 0) {
        warnings.push(`${utensil.name} is OUT OF STOCK`);
      } else if (utensil.stock < totalMeals) {
        warnings.push(`${utensil.name}: Need ${totalMeals - utensil.stock} more`);
      } else if (utensil.stock <= 5) {
        warnings.push(`${utensil.name}: Low stock (${utensil.stock} left)`);
      }
    });
  }
  
  // Show notifications if there are warnings
  if (warnings.length > 0) {
    showStockNotification(warnings, false);
  }
};
import { saveNotification } from './notifications-store';

export const showStockNotification = (warnings: string[], isError: boolean = false) => {
  if (typeof window === 'undefined') return;
  
  warnings.forEach((warning) => {
    const isOutOfStock = warning.includes('OUT OF STOCK');
    
    // Save to notification system instead of showing toast
    saveNotification({
      type: isOutOfStock ? 'inventory' : 'inventory',
      title: isOutOfStock ? 'Out of Stock' : 'Low Stock',
      message: warning,
      priority: isOutOfStock ? 'high' : 'medium',
    });
  });
};
export const increaseStock = (itemId: string, amount: number): boolean => {
  const item = inventoryItems.find(i => i.id === itemId)
  if (!item) return false
  item.stock += amount
  item.status = getStockStatus(item.stock)
  saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems)
  return true
}

export const restoreStockForOrder = (order: { items: { id: string; name: string; quantity: number }[] }): boolean => {
  let success = true;
  
  // Restore both menu item stock, ingredient stock (for meals),
  // and raw stock based on RAW_STOCK_DEDUCTION_MAP (mirrors saveOrder logic)
  order.items.forEach((orderItem) => {
    // 1. Restore main item stock
    const item = inventoryItems.find(item => item.id === orderItem.id);
    if (item) {
      item.stock += orderItem.quantity;
      
      // Update status based on new stock level
      if (item.stock === 0) {
        item.status = 'out-of-stock';
      } else if (item.stock <= 5) {
        item.status = 'low-stock';
      } else {
        item.status = 'in-stock';
      }
    } else {
      success = false;
    }

    // 1a. Restore ingredient stock if this item is a meal with a mapped ingredient
    const ingredient = MEAL_INGREDIENTS_MAP[orderItem.name];
    if (ingredient) {
      const ingredientItem = inventoryItems.find(i => i.name === ingredient.ingredient);
      if (ingredientItem) {
        ingredientItem.stock += orderItem.quantity;
        if (ingredientItem.stock === 0) {
          ingredientItem.status = 'out-of-stock';
        } else if (ingredientItem.stock <= 5) {
          ingredientItem.status = 'low-stock';
        } else {
          ingredientItem.status = 'in-stock';
        }
      }
    }

    // 2. Restore raw stock based on item type (matches saveOrder deduction)
    const rawStockDeduction = RAW_STOCK_DEDUCTION_MAP[orderItem.name];
    if (rawStockDeduction) {
      const rawStockItem = inventoryItems.find(item => item.name === rawStockDeduction.rawStock);
      if (rawStockItem) {
        const totalRestore = rawStockDeduction.amount * orderItem.quantity;
        rawStockItem.stock += totalRestore;
        
        // Update status based on new stock level
        if (rawStockItem.stock === 0) {
          rawStockItem.status = 'out-of-stock';
        } else if (rawStockItem.stock <= 5) {
          rawStockItem.status = 'low-stock';
        } else {
          rawStockItem.status = 'in-stock';
        }
      }
    }

    // 3. Restore container stock if applicable
    restoreContainerForItem(orderItem.name, orderItem.quantity);

    // 4. Restore utensils if this item requires utensils
    if (requiresUtensils(item)) {
      restoreUtensilsForQuantity(orderItem.quantity);
    }
  });
  
  // Save to localStorage
  saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems);
  
  return success;
};