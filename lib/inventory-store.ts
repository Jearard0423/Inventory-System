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
  deliveryPhone?: string
  deliveryAddress?: string
  mealType?: string
  originalMealType?: string
  cookTime?: string
  deliveryMethod?: 'hand-in' | 'lalamove'
  isDelivery?: boolean
  paymentStatus?: 'paid' | 'unpaid'
  total?: number
  remarks?: string
  specialRequests?: string
}

// localStorage keys
const KITCHEN_ITEMS_KEY = 'yellowbell_kitchen_items';
const CUSTOMER_ORDERS_KEY = 'yellowbell_customer_orders';
const DELIVERY_ORDERS_KEY = 'yellowbell_delivery_orders';
const INVENTORY_ITEMS_KEY = 'yellowbell_inventory_items';

// Load data from localStorage
const loadFromLocalStorage = () => {
  if (typeof window !== 'undefined') {
    try {
      const kitchenItemsData = localStorage.getItem(KITCHEN_ITEMS_KEY);
      const customerOrdersData = localStorage.getItem(CUSTOMER_ORDERS_KEY);
      const deliveryOrdersData = localStorage.getItem(DELIVERY_ORDERS_KEY);
      const inventoryItemsData = localStorage.getItem(INVENTORY_ITEMS_KEY);
      
      return {
        kitchenItems: kitchenItemsData ? JSON.parse(kitchenItemsData) : [],
        customerOrders: customerOrdersData ? JSON.parse(customerOrdersData) : [],
        deliveryOrders: deliveryOrdersData ? JSON.parse(deliveryOrdersData) : [],
        inventoryItems: inventoryItemsData ? JSON.parse(inventoryItemsData) : []
      };
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
        window.dispatchEvent(new Event("inventory-updated"));
        // Also try to sync to Firebase asynchronously
        try {
          const { saveInventoryToFirebase } = require('./firebase-inventory-sync');
          saveInventoryToFirebase(data).catch((err: any) => {
            console.warn('Firebase sync failed (non-critical):', err);
          });
        } catch (err) {
          // Firebase sync not available, continue without it
        }
      }
      if (key === CUSTOMER_ORDERS_KEY) {
        window.dispatchEvent(new Event("orders-updated"));
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }
};

// Load initial data from localStorage
const initialData = loadFromLocalStorage();

// In-memory storage for kitchen items (loaded from localStorage)
let kitchenItems: KitchenItem[] = initialData.kitchenItems;

// In-memory storage for customer orders (loaded from localStorage)
let customerOrders: CustomerOrder[] = initialData.customerOrders;

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
  if (customerOrders.length === 0) {
    customerOrders = [];
  }
};

// Force reset inventory to new menu items
const resetInventoryToNewMenu = () => {
  const newInventoryItems: InventoryItem[] = [
    // Food Items Only (visible to customers)
    { id: '1', name: 'Roast Chicken', category: 'chicken', stock: 10, price: 360, status: 'in-stock' },
    { id: '2', name: 'Chicken Yangchow Meal', category: 'meals', stock: 10, price: 160, status: 'in-stock' },
    { id: '3', name: 'Roast Liempo Jumbo', category: 'liempo', stock: 10, price: 590, status: 'in-stock' },
    { id: '4', name: 'Roast Liempo Medium', category: 'liempo', stock: 10, price: 295, status: 'in-stock' },
    { id: '5', name: 'Sisig Family', category: 'sisig', stock: 10, price: 299, status: 'in-stock' },
    { id: '6', name: 'Sisig Sharing', category: 'sisig', stock: 10, price: 150, status: 'in-stock' },
    { id: '7', name: 'Sisig Party Tray', category: 'sisig', stock: 10, price: 1550, status: 'in-stock' },
    { id: '8', name: 'Liempo Meal', category: 'meals', stock: 10, price: 190, status: 'in-stock' },
    { id: '9', name: 'Kare Kare Liempo Meal', category: 'meals', stock: 10, price: 195, status: 'in-stock' },
    { id: '10', name: 'Sisig Meal', category: 'meals', stock: 10, price: 190, status: 'in-stock' },
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

// Initialize with sample inventory items if empty
const initializeInventoryItems = () => {
  if (inventoryItems.length === 0) {
    resetInventoryToNewMenu();
  }
};

// Export the reset function so we can call it manually if needed
export const resetInventoryMenu = () => {
  resetInventoryToNewMenu();
};

// Initialize data
initializeCustomerOrders();
initializeInventoryItems();

// Reset all stock to 10 units for testing
resetInventoryToNewMenu();


export const getKitchenItems = (): KitchenItem[] => {
  return [...kitchenItems];
};

export const updateKitchenItems = (items: KitchenItem[]): void => {
  kitchenItems = [...items];
  // In a real app, you would save to a database here
};

export const getCustomerOrders = (): CustomerOrder[] => {
  return [...customerOrders];
};

export const updateCustomerOrders = (orders: CustomerOrder[]): void => {
  customerOrders = [...orders];
  // In a real app, you would save to a database here
};

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
      // Update the status of the cooked item in the order
      const cookedItem = order.orderedItems.find(i => i.id === itemId);
      if (cookedItem) {
        if (!order.cookedItems) order.cookedItems = [];
        const existingCookedItem = order.cookedItems.find(i => i.id === itemId);
        if (existingCookedItem) {
          existingCookedItem.quantity += cookQuantity;
        } else {
          order.cookedItems.push({ ...cookedItem, quantity: cookQuantity });
        }
      }
      
      // Update order status if all items are cooked
      const allCooked = order.orderedItems.every(orderedItem => {
        const cooked = order.cookedItems?.find(c => c.name === orderedItem.name);
        return cooked && cooked.quantity >= orderedItem.quantity;
      });
      
      if (allCooked) {
        order.status = 'ready';
      } else {
        order.status = 'cooking';
      }
    }
  }
  
  // Update the kitchen items
  updateKitchenItems([...kitchenItems]);
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

export const markOrderAsDelivered = (orderId: string): boolean => {
  const orderIndex = customerOrders.findIndex(order => order.id === orderId);
  if (orderIndex === -1) return false;
  
  customerOrders[orderIndex].status = 'delivered';
  
  // Update kitchen items
  kitchenItems = kitchenItems.map(item => {
    if (item.orderId === orderId) {
      return { ...item, status: 'served' };
    }
    return item;
  });
  
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
  
  // Save to localStorage
  saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems);
  
  return true;
};

export const getInventory = (): InventoryItem[] => {
  return [...inventoryItems];
};

// Get only food items (visible to customers in menu)
export const getMenuItems = (): InventoryItem[] => {
  return inventoryItems.filter(item => !item.isUtensil && !item.isContainer);
};

export const updateInventory = (items: InventoryItem[]): void => {
  inventoryItems = [...items];
  saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems);
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

// Restore utensils by quantity (adds back 1 per utensil per quantity)
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
    // Reduce main item stock
    reduceStock(orderedItem.id, orderedItem.quantity);
    
    // Reduce container stock
    reduceContainerForItem(orderedItem.name, orderedItem.quantity);
    
    // Reduce utensils for applicable items (all meal/food categories except sisig and rice)
    const inventory = getInventory();
    const menuItem = inventory.find(item => item.id === orderedItem.id);
    if (requiresUtensils(menuItem)) {
      // Reduce 1 of each utensil per ordered item
      for (let i = 0; i < orderedItem.quantity; i++) {
        reduceUtensilsForMeal("meal");
      }
    }
  });

  // Dispatch inventory update event for real-time refresh
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event("inventory-updated"));
  }

  // Update kitchen items
  newOrder.items.forEach(orderedItem => {
    let kitchenItem = kitchenItems.find(item => item.name === orderedItem.name);
    if (!kitchenItem) {
      kitchenItem = {
        id: generateId(),
        name: orderedItem.name,
        totalOrdered: 0,
        totalCooked: 0,
        pending: 0,
        category: 'other',
        orderId: customerOrder.id,
        status: 'to-cook',
        customerName: newOrder.customerName,
        itemName: orderedItem.name,
        quantity: orderedItem.quantity
      };
      kitchenItems.push(kitchenItem);
    }
    
    kitchenItem.totalOrdered += orderedItem.quantity;
    kitchenItem.pending = kitchenItem.totalOrdered - (kitchenItem.totalCooked || 0);
    kitchenItem.status = 'to-cook';
  });
  
  // Save to localStorage
  saveToLocalStorage(CUSTOMER_ORDERS_KEY, customerOrders);
  saveToLocalStorage(KITCHEN_ITEMS_KEY, kitchenItems);
  
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
export const restoreStockForOrder = (order: { items: { id: string; quantity: number }[] }): boolean => {
  let success = true;
  
  order.items.forEach((orderItem) => {
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
      
      // Restore container stock if applicable
      restoreContainerForItem(item.name, orderItem.quantity);

      // Restore utensils if this item requires utensils
      if (requiresUtensils(item)) {
        restoreUtensilsForQuantity(orderItem.quantity);
      }

      // Save to localStorage
      saveToLocalStorage(INVENTORY_ITEMS_KEY, inventoryItems);
    } else {
      success = false;
    }
  });
  
  return success;
};
