"use client"

import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CustomerData } from "@/lib/customers"
import { Plus, Calendar, Users, Package, TrendingUp, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useEffect, useState, useMemo } from "react"
import { getLowStockItems, type InventoryItem } from "@/lib/inventory-store"
import { getOrders, type Order } from "@/lib/orders"
import { getCustomerAnalytics } from "@/lib/customers"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const router = useRouter()
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [currentDate, setCurrentDate] = useState(new Date(2024, 0, 1)) // Fixed date for SSR
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const [mounted, setMounted] = useState(false)
  const [customers, setCustomers] = useState<CustomerData[]>([])

  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])

  useEffect(() => {
    setMounted(true)
    setCurrentDate(new Date())
    setCustomers(getCustomerAnalytics())
  }, [])

  const topCustomers = customers.slice(0, 3)

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getOrderCountForDate = (date: Date) => {
    const dateStr = formatDate(date)
    return orders.filter((order) => order.date === dateStr).length
  }

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + offset)
    setCurrentDate(newDate)
  }

  const handleDateClick = (date: Date) => {
    if (selectedDate && formatDate(selectedDate) === formatDate(date)) {
      // Double click - reset to today
      setSelectedDate(null)
    } else {
      setSelectedDate(date)
    }
  }

  const navigateToOrders = () => {
    if (selectedDate) {
      router.push(`/orders?date=${formatDate(selectedDate)}`)
    }
  }

  const todayOrders = orders.filter((order) => {
    const orderDate = new Date(order.date)
    orderDate.setHours(0, 0, 0, 0)
    return orderDate.toDateString() === today.toDateString()
  })

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowOrders = orders.filter((order) => {
    const orderDate = new Date(order.date)
    orderDate.setHours(0, 0, 0, 0)
    return orderDate.toDateString() === tomorrow.toDateString()
  })

  const advancedOrders = orders.filter((order) => {
    const orderDate = new Date(order.date)
    orderDate.setHours(0, 0, 0, 0)
    return orderDate > today
  })

  const todaySales = todayOrders.reduce((sum, order) => sum + order.total, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdaySales = orders
    .filter((order) => order.date === formatDate(yesterday))
    .reduce((sum, order) => sum + order.total, 0)

  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const weekSales = orders
    .filter((order) => {
      const orderDate = new Date(order.date)
      return orderDate >= weekStart && orderDate <= today
    })
    .reduce((sum, order) => sum + order.total, 0)

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthSales = orders
    .filter((order) => {
      const orderDate = new Date(order.date)
      return orderDate >= monthStart && orderDate <= today
    })
    .reduce((sum, order) => sum + order.total, 0)

  const generateCalendarDates = () => {
    const daysInMonth = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const dates = []

    for (let i = 0; i < firstDay; i++) {
      dates.push(null)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))
    }

    return dates
  }

  const calendarDates = generateCalendarDates()

  useEffect(() => {
    const loadData = () => {
      setLowStockItems(getLowStockItems())
      setOrders(getOrders())
      setCustomers(getCustomerAnalytics())
    }

    loadData()
    window.addEventListener("inventory-updated", loadData)
    window.addEventListener("orders-updated", loadData)
    window.addEventListener("storage", loadData)

    const interval = setInterval(loadData, 2000)

    return () => {
      window.removeEventListener("inventory-updated", loadData)
      window.removeEventListener("orders-updated", loadData)
      window.removeEventListener("storage", loadData)
      clearInterval(interval)
    }
  }, [])

  return (
    <POSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-balance">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome to Yellowbell Roast Co. POS System</p>
        </div>

        {/* Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Taking Orders Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Taking Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button asChild className="h-14 sm:h-auto py-4 w-full sm:w-1/2 bg-primary hover:bg-primary/90">
                  <Link href="/new-order" className="flex items-center justify-center">
                    <Plus className="h-5 w-5 mr-2 flex-shrink-0" />
                    <span className="truncate">New Order</span>
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-14 sm:h-auto py-4 w-full sm:w-1/2 bg-transparent">
                  <Link href="/orders?filter=advanced" className="flex items-center justify-center">
                    <Calendar className="h-5 w-5 mr-2 flex-shrink-0" />
                    <span className="truncate">Advanced Orders</span>
                  </Link>
                </Button>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Orders Today</span>
                  <span className="text-2xl font-bold text-primary">{todayOrders.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Advanced Orders</span>
                  <span className="text-2xl font-bold text-accent">{advancedOrders.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-accent" />
                Loyal Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="space-y-2">
                  {topCustomers.length === 0 ? (
                    <div className="p-3 bg-muted rounded-lg text-center">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No customers yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Start taking orders to see customers</p>
                    </div>
                  ) : (
                    <>
                      {topCustomers.map((customer: CustomerData, idx: number) => (
                        <div key={idx} className="p-3 bg-muted rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{customer.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {customer.totalOrders} orders • ₱{customer.totalSpent.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {customer.favoriteItems.slice(0, 2).map((item: string, i: number) => (
                              <span key={i} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                      <Button asChild variant="outline" className="w-full bg-transparent mt-4">
                        <Link href="/loyal-customers">View All Customers</Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calendar Orders */}
          <Card className="lg:col-span-2 xl:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-secondary" />
                    Calendar Orders
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {mounted 
                      ? currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                      : 'January 2024'
                    }
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => changeMonth(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                    <div key={index} className="text-center text-xs font-medium text-muted-foreground pb-2">
                      {day}
                    </div>
                  ))}
                  {calendarDates.map((date, idx) => {
                    if (!date) {
                      return <div key={`empty-${idx}`} />
                    }

                    const isToday = formatDate(date) === formatDate(today)
                    const isSelected = selectedDate && formatDate(date) === formatDate(selectedDate)
                    const orderCount = getOrderCountForDate(date)
                    const isPast = date < today

                    return (
                      <button
                        key={idx}
                        onClick={() => handleDateClick(date)}
                        className={`relative aspect-square rounded-lg text-sm font-medium transition-all
                          ${isSelected ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" : ""}
                          ${isToday && !isSelected ? "bg-accent text-accent-foreground" : ""}
                          ${!isToday && !isSelected ? "hover:bg-muted" : ""}
                          ${isPast && !isToday && !isSelected ? "text-muted-foreground" : ""}
                        `}
                      >
                        {date.getDate()}
                        {orderCount > 0 && (
                          <span
                            className={`absolute bottom-1 right-1 text-[10px] px-1 rounded-full ${
                              isSelected || isToday
                                ? "bg-background text-foreground"
                                : "bg-primary text-primary-foreground"
                            }`}
                          >
                            {orderCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Order Stats */}
                {selectedDate ? (
                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {mounted
                          ? selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                          : 'January 1, 2024'
                        }
                      </p>
                      <span className="text-2xl font-bold text-primary">{getOrderCountForDate(selectedDate)}</span>
                    </div>
                    <Button onClick={navigateToOrders} className="w-full bg-transparent" variant="outline">
                      View Orders for This Date
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                    <div className="p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                      <p className="text-xs text-muted-foreground mb-1">Today</p>
                      <p className="text-2xl font-bold text-primary">{todayOrders.length}</p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-accent/10 to-accent/5 rounded-lg border border-accent/20">
                      <p className="text-xs text-muted-foreground mb-1">Tomorrow</p>
                      <p className="text-2xl font-bold text-accent">{tomorrowOrders.length}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sales Per Day */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-secondary" />
                Sales Per Day
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Week labels */}
                <div className="grid grid-cols-7 gap-2">
                  {days.map((day, idx) => {
                    const date = new Date(today)
                    date.setDate(today.getDate() - today.getDay() + idx)
                    const daySales = orders
                      .filter((order) => order.date === formatDate(date))
                      .reduce((sum, order) => sum + order.total, 0)
                    const maxSales = 5000
                    const height = Math.min((daySales / maxSales) * 100, 100)

                    return (
                      <div key={day} className="text-center">
                        <div className="h-24 bg-muted rounded-lg flex items-end justify-center p-2">
                          <div
                            className="w-full bg-primary rounded-t transition-all"
                            style={{ height: `${height}%` }}
                          ></div>
                        </div>
                        <p className="text-xs font-medium mt-2">{day}</p>
                        <p className="text-xs text-muted-foreground">₱{daySales}</p>
                      </div>
                    )
                  })}
                </div>
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Today</p>
                    <p className="text-xl font-bold">₱{todaySales}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Yesterday</p>
                    <p className="text-xl font-bold">₱{yesterdaySales}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">This Week</p>
                    <p className="text-xl font-bold">₱{weekSales}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">This Month</p>
                    <p className="text-xl font-bold">₱{monthSales}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory/Stocks Overview with Low Stock Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-accent" />
                  Inventory Overview
                </span>
                {lowStockItems.length > 0 && (
                  <span className="flex items-center gap-1 text-red-600 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    {lowStockItems.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lowStockItems.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">All items in stock</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {lowStockItems.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border ${item.status === "out-of-stock" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.stock} units remaining</p>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${item.status === "out-of-stock" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}
                          >
                            {item.status === "out-of-stock" ? "Out" : "Low"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {lowStockItems.length > 5 && (
                      <p className="text-xs text-center text-muted-foreground pt-2">
                        +{lowStockItems.length - 5} more items
                      </p>
                    )}
                  </div>
                )}
                <Button asChild variant="outline" className="w-full bg-transparent">
                  <Link href="/inventory">View Inventory</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </POSLayout>
  )
}
