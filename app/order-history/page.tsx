"use client"

import type React from "react"
import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Calendar, TrendingUp, Truck, Hand } from "lucide-react"
import { useState, useEffect } from "react"
import { getCustomerOrders, type CustomerOrder } from "@/lib/inventory-store"
import { Pagination } from "@/components/pagination"

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [filteredOrders, setFilteredOrders] = useState<CustomerOrder[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState("all-time")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    const allOrders = getCustomerOrders()
    // Filter only delivered or otherwise completed orders
    const completedOrders = allOrders.filter(
      order => order.status === "delivered" || order.status === "complete"
    )
    setOrders(completedOrders.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ))

    const handleOrdersUpdate = () => {
      const updated = getCustomerOrders()
      const completed = updated.filter(
        order => order.status === "delivered" || order.status === 'complete'
      )
      setOrders(completed.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ))
    }

    window.addEventListener("orders-updated", handleOrdersUpdate)
    return () => window.removeEventListener("orders-updated", handleOrdersUpdate)
  }, [])

  // Apply filters
  useEffect(() => {
    let result = [...orders]

    // Date filter
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const thisWeekStart = new Date(today)
    thisWeekStart.setDate(thisWeekStart.getDate() - today.getDay())

    if (dateFilter === "today") {
      result = result.filter(order => {
        const orderDate = new Date(order.createdAt)
        return orderDate >= today && orderDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)
      })
    } else if (dateFilter === "yesterday") {
      result = result.filter(order => {
        const orderDate = new Date(order.createdAt)
        return orderDate >= yesterday && orderDate < today
      })
    } else if (dateFilter === "this-week") {
      result = result.filter(order => {
        const orderDate = new Date(order.createdAt)
        return orderDate >= thisWeekStart
      })
    }

    // Search filter
    if (searchTerm) {
      result = result.filter(order =>
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredOrders(result)
    setCurrentPage(1)
  }, [orders, searchTerm, dateFilter])

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage)

  const getDeliveryBadge = (order: CustomerOrder) => {
    if (order.status === "delivered") {
      return {
        icon: Truck,
        label: "Delivered",
        className: "bg-blue-100 text-blue-800"
      }
    } else if (order.deliveryMethod === "hand-in") {
      return {
        icon: Hand,
        label: "Handed In",
        className: "bg-green-100 text-green-800"
      }
    }
    return { icon: Hand, label: "Unknown", className: "bg-gray-100 text-gray-800" }
  }

  const getTotalRevenue = () => {
    return filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0)
  }

  return (
    <POSLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Order History</h1>
            <p className="text-muted-foreground mt-1">View completed and delivered orders</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{filteredOrders.length}</p>
                </div>
                <Truck className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">₱{getTotalRevenue().toFixed(2)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Order Value</p>
                  <p className="text-2xl font-bold">
                    ₱{filteredOrders.length > 0 ? (getTotalRevenue() / filteredOrders.length).toFixed(2) : "0.00"}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer name or order #..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Date Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-time">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardContent className="p-0">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Order #</th>
                    <th className="text-left py-3 px-4 font-semibold">Customer</th>
                    <th className="text-left py-3 px-4 font-semibold">Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Items</th>
                    <th className="text-left py-3 px-4 font-semibold">Total</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-16 text-center">
                        <p className="text-sm text-muted-foreground">No orders found</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((order) => {
                      const deliveryBadge = getDeliveryBadge(order)
                      const Icon = deliveryBadge.icon
                      return (
                        <tr key={order.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">#{order.orderNumber}</td>
                          <td className="py-3 px-4">{order.customerName}</td>
                          <td className="py-3 px-4 text-sm">
                            {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {order.orderedItems.reduce((sum, item) => sum + item.quantity, 0)} items
                          </td>
                          <td className="py-3 px-4 font-semibold">₱{(order.total || 0).toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${deliveryBadge.className}`}>
                                {deliveryBadge.label}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="p-4 border-t">
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
              )}
            </div>

            {/* Mobile View */}
            <div className="md:hidden space-y-4 p-4">
              {paginatedOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No orders found</p>
              ) : (
                paginatedOrders.map((order) => {
                  const deliveryBadge = getDeliveryBadge(order)
                  const Icon = deliveryBadge.icon
                  return (
                    <Card key={order.id}>
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-sm">#{order.orderNumber}</p>
                              <p className="text-muted-foreground text-xs">{order.customerName}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Icon className="h-4 w-4" />
                              <span className={`text-xs font-medium px-2 py-1 rounded ${deliveryBadge.className}`}>
                                {deliveryBadge.label}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{order.orderedItems.reduce((sum, item) => sum + item.quantity, 0)} items</span>
                            <span className="font-semibold">₱{(order.total || 0).toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
              {totalPages > 1 && (
                <div className="pt-4">
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </POSLayout>
  )
}
