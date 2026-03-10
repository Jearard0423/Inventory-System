import { restoreStockForOrder, getInventory } from "./inventory-store"

export interface Order {
  id: string
  orderNumber: string
  customerName: string
  items: Array<{ id: string; name: string; price: number; quantity: number }>
  total: number
  date: string
  createdAt?: string
  status: "pending" | "completed"
  paymentStatus: "paid" | "not-paid"
  paymentMethod?: "cash" | "gcash"
  gcashPhone?: string
  gcashReference?: string
  specialRequests?: string
  remarks?: string
  mealType?: string
  originalMealType?: string
  cookTime?: string
  isPreparedOrder?: boolean
}

export const getOrders = (): Order[] => {
  if (typeof window === "undefined") return []
  const stored = localStorage.getItem("yellowbell_orders")
  const orders = stored ? JSON.parse(stored) : []
  
  // Normalize statuses and add order numbers for old entries
  return orders.map((order: Order) => {
    // treat anything not explicitly 'pending' as completed
    const normalizedStatus = order.status === 'pending' ? 'pending' : 'completed'

    if (!order.orderNumber) {
      // Generate a simple order number for existing orders
      const orderDate = new Date(order.date)
      const dateStr = orderDate.getFullYear().toString().slice(-2) + 
                      (orderDate.getMonth() + 1).toString().padStart(2, '0') + 
                      orderDate.getDate().toString().padStart(2, '0')
      const sequenceNumber = Math.floor(Math.random() * 900 + 100).toString()
      return {
        ...order,
        status: normalizedStatus,
        orderNumber: `#${dateStr}-${sequenceNumber}`
      }
    }
    return {
      ...order,
      status: normalizedStatus,
    }
  })
}

export const generateOrderNumber = (): string => {
  const today = new Date()
  const dateStr = today.getFullYear().toString().slice(-2) + 
                  (today.getMonth() + 1).toString().padStart(2, '0') + 
                  today.getDate().toString().padStart(2, '0')
  
  const existingOrders = getOrders()
  const todayOrders = existingOrders.filter(order => {
    const orderDate = new Date(order.date)
    return orderDate.toDateString() === today.toDateString()
  })
  
  const sequenceNumber = (todayOrders.length + 1).toString().padStart(3, '0')
  return `#${dateStr}-${sequenceNumber}`
}

export const generatePreparedOrderNumber = (): string => {
  // Always start from 1 for each new prepared order
  return "PREP-001"
}

export const getTodaysOrderCount = (): number => {
  if (typeof window === "undefined") return 0
  const today = new Date().toDateString()
  const orders = getOrders()
  // only count pending orders; completed/delivered should be excluded
  return orders.filter(order => new Date(order.date).toDateString() === today && order.status === 'pending').length
}

export const deleteOrder = (orderId: string): void => {
  if (typeof window === "undefined") return
  const orders = getOrders()
  const orderToDelete = orders.find(order => order.id === orderId)
  
  if (orderToDelete) {
    // Restore stock before deleting the order
    restoreStockForOrder(orderToDelete)
    
    // Calculate how many meals were ordered to restore utensils
    const inventory = getInventory()
    orderToDelete.items.forEach((orderItem: { id: string; name: string; price: number; quantity: number }) => {
      const menuItem = inventory.find((item: any) => item.id === orderItem.id)
      if (menuItem?.category === "meals") {
        // Restore 2 utensils per meal (spoon and fork)
        // (previous code incorrectly reduced utensils; restore instead)
        const { restoreUtensilsForQuantity } = require("./inventory-store")
        // if restore function isn't available gracefully skip
        try {
          restoreUtensilsForQuantity(orderItem.quantity * 2)
        } catch {}
      }
    })
    
    // If this is a prepared order, also restore it to the prepared orders list
    if (orderToDelete.isPreparedOrder) {
      const preparedOrders = JSON.parse(localStorage.getItem("yellowbell_prepared_orders") || "[]")
      
      // Find the corresponding prepared order
      const preparedOrder = preparedOrders.find((po: any) => 
        po.orderNumber === orderToDelete.orderNumber || 
        (po.items && po.items.some((item: any) => 
          orderToDelete.items.some((oi: any) => oi.id === item.id)
        ))
      )
      
      if (preparedOrder) {
        // Restore the prepared order status and quantities
        const updatedPreparedOrders = preparedOrders.map((po: any) => {
          if (po.id === preparedOrder.id) {
            // Restore the quantities that were taken by this order
            const restoredItems = po.items.map((item: any) => {
              const orderItem = orderToDelete.items.find((oi: any) => oi.id === item.id)
              if (orderItem) {
                return {
                  ...item,
                  remainingQuantity: (item.remainingQuantity || item.quantity) + orderItem.quantity
                }
              }
              return item
            })
            
            return {
              ...po,
              items: restoredItems,
              status: "prepared" as const
            }
          }
          return po
        })
        
        localStorage.setItem("yellowbell_prepared_orders", JSON.stringify(updatedPreparedOrders))
        window.dispatchEvent(new Event("prepared-orders-updated"))
      }
    }
    
    // Archive to order history as cancelled before removing
    const { archiveOrderToHistory, getCustomerOrders, updateCustomerOrders, getKitchenItems, updateKitchenItems } = require("./inventory-store")
    const customerOrders = getCustomerOrders()
    const customerOrder = customerOrders.find((o: any) => o.id === orderId)
    if (customerOrder) {
      archiveOrderToHistory({ ...customerOrder, status: 'cancelled' })
    } else {
      // Archive from the regular order if no customer order exists
      archiveOrderToHistory({
        id: orderToDelete.id,
        orderNumber: orderToDelete.orderNumber,
        customerName: orderToDelete.customerName,
        status: 'cancelled',
        orderedItems: orderToDelete.items.map((i: any) => ({ name: i.name, quantity: i.quantity })),
        cookedItems: [],
        mealType: orderToDelete.mealType || '',
        originalMealType: orderToDelete.mealType || '',
        cookTime: orderToDelete.cookTime || '',
        createdAt: orderToDelete.date || new Date().toISOString(),
        total: orderToDelete.total || 0,
        paymentStatus: orderToDelete.paymentStatus || 'unpaid',
      })
    }

    // Remove kitchen items for this order
    const kitchenItems = getKitchenItems()
    const updatedKitchenItems = kitchenItems.filter((item: { orderId: string }) => item.orderId !== orderId)
    updateKitchenItems(updatedKitchenItems)

    // Remove customer order
    const updatedCustomerOrders = customerOrders.filter((order: { id: string }) => order.id !== orderId)
    updateCustomerOrders(updatedCustomerOrders)
  }
  
  const updatedOrders = orders.filter(order => order.id !== orderId)
  localStorage.setItem("yellowbell_orders", JSON.stringify(updatedOrders))
  window.dispatchEvent(new Event("orders-updated"))
}
/**
 * Update a specific order's editable fields in localStorage AND Firebase RTDB.
 * This ensures edited cookTime/date/mealType are reflected in reminders on all devices.
 */
export const updateOrder = (
  orderId: string,
  patch: Partial<Pick<Order,
    'customerName' | 'cookTime' | 'mealType' | 'originalMealType' |
    'specialRequests' | 'remarks' | 'gcashPhone' | 'gcashReference' |
    'items' | 'total' | 'paymentStatus' | 'paymentMethod'
  > & { deliveryPhone?: string; deliveryAddress?: string }>
): void => {
  if (typeof window === 'undefined') return

  // Update yellowbell_orders
  const orders: Order[] = JSON.parse(localStorage.getItem('yellowbell_orders') || '[]')
  const updatedOrders = orders.map(o => o.id === orderId ? { ...o, ...patch } : o)
  localStorage.setItem('yellowbell_orders', JSON.stringify(updatedOrders))

  // Also update yellowbell_customer_orders so kitchen/delivery stay in sync
  const custOrders = JSON.parse(localStorage.getItem('yellowbell_customer_orders') || '[]')
  const updatedCustOrders = custOrders.map((o: any) => o.id === orderId ? { ...o, ...patch } : o)
  localStorage.setItem('yellowbell_customer_orders', JSON.stringify(updatedCustOrders))

  // Push the patch to Firebase RTDB so the edit is reflected on all devices
  // and reminders use the updated cookTime/date/mealType
  try {
    const { updateOrderInFirebase } = require('./firebase-inventory-sync')
    updateOrderInFirebase(orderId, patch).catch((err: any) =>
      console.warn('[updateOrder] RTDB sync failed (non-critical):', err)
    )
  } catch (err) {
    console.warn('[updateOrder] Firebase sync not available:', err)
  }

  window.dispatchEvent(new Event('orders-updated'))
  window.dispatchEvent(new Event('customer-orders-updated'))
}