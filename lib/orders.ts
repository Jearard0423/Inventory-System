import { restoreStockForOrder, reduceUtensilsForMeal, getInventory } from "./inventory-store"

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
  
  // Add order numbers to existing orders that don't have them
  return orders.map((order: Order) => {
    if (!order.orderNumber) {
      // Generate a simple order number for existing orders
      const orderDate = new Date(order.date)
      const dateStr = orderDate.getFullYear().toString().slice(-2) + 
                      (orderDate.getMonth() + 1).toString().padStart(2, '0') + 
                      orderDate.getDate().toString().padStart(2, '0')
      const sequenceNumber = Math.floor(Math.random() * 900 + 100).toString()
      return {
        ...order,
        orderNumber: `#${dateStr}-${sequenceNumber}`
      }
    }
    return order
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
  return orders.filter(order => new Date(order.date).toDateString() === today).length
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
        // Call reduceUtensilsForMeal for each utensil needed
        for (let i = 0; i < orderItem.quantity * 2; i++) {
          reduceUtensilsForMeal("meal")
        }
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
    
    // Remove kitchen items for this order
    const { getKitchenItems, updateKitchenItems } = require("./inventory-store")
    const kitchenItems = getKitchenItems()
    const updatedKitchenItems = kitchenItems.filter((item: { orderId: string }) => item.orderId !== orderId)
    updateKitchenItems(updatedKitchenItems)
    
    // Remove customer order
    const { getCustomerOrders, updateCustomerOrders } = require("./inventory-store")
    const customerOrders = getCustomerOrders()
    const updatedCustomerOrders = customerOrders.filter((order: { id: string }) => order.id !== orderId)
    updateCustomerOrders(updatedCustomerOrders)
  }
  
  const updatedOrders = orders.filter(order => order.id !== orderId)
  localStorage.setItem("yellowbell_orders", JSON.stringify(updatedOrders))
  window.dispatchEvent(new Event("orders-updated"))
}
