import { getOrders, type Order } from "./orders"

export interface CustomerData {
  name: string
  totalOrders: number
  totalSpent: number
  lastOrder: string
  favoriteItems: string[]
  memberSince: string
  orders: Order[]
}

export function getCustomerAnalytics(): CustomerData[] {
  const orders = getOrders()

  if (orders.length === 0) {
    return []
  }

  // Group orders by customer name
  const customerMap = new Map<string, Order[]>()

  orders.forEach((order) => {
    const name = order.customerName
    if (!customerMap.has(name)) {
      customerMap.set(name, [])
    }
    customerMap.get(name)!.push(order)
  })

  // Calculate analytics for each customer
  const customers: CustomerData[] = []

  customerMap.forEach((customerOrders, name) => {
    // Sort orders by date
    const sortedOrders = customerOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Calculate total spent
    const totalSpent = customerOrders.reduce((sum, order) => sum + order.total, 0)

    // Get favorite items (most ordered)
    const itemCounts = new Map<string, number>()
    customerOrders.forEach((order) => {
      order.items.forEach((item) => {
        itemCounts.set(item.name, (itemCounts.get(item.name) || 0) + item.quantity)
      })
    })

    const favoriteItems = Array.from(itemCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)

    // Calculate last order time
    const lastOrderDate = new Date(sortedOrders[0].date)
    const today = new Date()
    const diffTime = Math.abs(today.getTime() - lastOrderDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    let lastOrder = ""
    if (diffDays === 0) {
      lastOrder = "Today"
    } else if (diffDays === 1) {
      lastOrder = "Yesterday"
    } else if (diffDays < 7) {
      lastOrder = `${diffDays} days ago`
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      lastOrder = `${weeks} week${weeks > 1 ? "s" : ""} ago`
    } else {
      const months = Math.floor(diffDays / 30)
      lastOrder = `${months} month${months > 1 ? "s" : ""} ago`
    }

    // Get member since (first order date)
    const firstOrderDate = new Date(sortedOrders[sortedOrders.length - 1].date)
    const memberSince = firstOrderDate.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    })

    customers.push({
      name,
      totalOrders: customerOrders.length,
      totalSpent,
      lastOrder,
      favoriteItems,
      memberSince,
      orders: sortedOrders,
    })
  })

  // Sort by total orders (most loyal first)
  return customers.sort((a, b) => b.totalOrders - a.totalOrders)
}

export function getLoyalCustomers(minOrders = 3): CustomerData[] {
  return getCustomerAnalytics().filter((customer) => customer.totalOrders >= minOrders)
}
