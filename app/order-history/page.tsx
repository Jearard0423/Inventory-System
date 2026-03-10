"use client"

import { useEffect, useState } from "react"
import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Calendar, Loader2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getCustomerOrders, getOrderHistory, type CustomerOrder } from "@/lib/inventory-store"
import { Pagination } from "@/components/pagination"

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [filteredOrders, setFilteredOrders] = useState<CustomerOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFilter, setDateFilter] = useState<"all-time" | "today" | "yesterday" | "this-week">("all-time")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Function to get delivery badge
  const getDeliveryBadge = (order: CustomerOrder) => {
    const s = (order.status || '').toLowerCase()
    if (s === 'cancelled' || s === 'canceled') {
      return {
        label: 'Cancelled',
        className: 'bg-red-100 text-red-700 border-red-300'
      }
    }
    if (s === 'delivered' || order.deliveryMethod === 'lalamove') {
      return {
        label: 'Delivered',
        className: 'bg-blue-100 text-blue-700 border-blue-300'
      }
    }
    return {
      label: 'Completed',
      className: 'bg-green-100 text-green-700 border-green-300'
    }
  }

  const loadOrders = () => {
    // Include 'complete' — orders fully cooked but not yet physically delivered
    const finalStatuses = new Set(['delivered', 'complete', 'cancelled', 'canceled'])

    const liveOrders = getCustomerOrders().filter(o =>
      finalStatuses.has((o.status || '').toLowerCase())
    )
    
    const archivedOrders = getOrderHistory().filter(o =>
      finalStatuses.has((o.status || '').toLowerCase())
    )
    
    // Merge — live takes precedence on duplicate IDs
    const liveIds = new Set(liveOrders.map(o => o.id))
    const mergedOrders = [
      ...liveOrders,
      ...archivedOrders.filter(o => !liveIds.has(o.id))
    ]

    setOrders(mergedOrders)
    setIsLoading(false)
  }

  useEffect(() => {
    loadOrders()

    // Event listeners
    const handleOrdersUpdate = () => {
      loadOrders()
    }

    window.addEventListener("orders-updated", handleOrdersUpdate)
    window.addEventListener("delivery-updated", handleOrdersUpdate)

    return () => {
      window.removeEventListener("orders-updated", handleOrdersUpdate)
      window.removeEventListener("delivery-updated", handleOrdersUpdate)
    }
  }, [])

  // Apply filters
  useEffect(() => {
    let filtered = [...orders]

    // Date filter
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - today.getDay())

    filtered = filtered.filter(order => {
      const orderDate = new Date(order.createdAt)
      const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate())

      switch (dateFilter) {
        case "today":
          return orderDateOnly.getTime() === today.getTime()
        case "yesterday":
          return orderDateOnly.getTime() === yesterday.getTime()
        case "this-week":
          return orderDateOnly.getTime() >= weekStart.getTime()
        default:
          return true
      }
    })

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(order =>
        order.customerName.toLowerCase().includes(query) ||
        order.orderNumber?.toLowerCase().includes(query)
      )
    }

    setFilteredOrders(filtered)
    setCurrentPage(1)
  }, [orders, searchQuery, dateFilter])

  // Calculate statistics
  const stats = {
    totalOrders: filteredOrders.length,
    totalRevenue: filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0),
    averageOrderValue: filteredOrders.length > 0 ? Math.round(filteredOrders.reduce((sum, order) => sum + (order.total || 0), 0) / filteredOrders.length) : 0
  }

  // Pagination
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)

  if (isLoading) {
    return (
      <POSLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </POSLayout>
    )
  }

  return (
    <POSLayout>
      <div className="space-y-4 pb-20">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" />
          <h1 className="text-3xl font-bold">Order History</h1>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-1">Total Orders</p>
              <p className="text-2xl font-bold">{stats.totalOrders}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold">₱{stats.totalRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-1">Avg Order Value</p>
              <p className="text-2xl font-bold">₱{stats.averageOrderValue.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by customer name or order number"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {(['all-time', 'today', 'yesterday', 'this-week'] as const).map(filter => (
              <Button
                key={filter}
                variant={dateFilter === filter ? 'default' : 'outline'}
                onClick={() => setDateFilter(filter)}
                className={dateFilter === filter ? 'bg-blue-600 hover:bg-blue-700' : ''}
                size="sm"
              >
                {filter === 'all-time' ? 'All Time' : filter === 'this-week' ? 'This Week' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        {paginatedOrders.length === 0 ? (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-blue-600">
                <AlertCircle className="w-5 h-5" />
                <span>No orders found</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Order #</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Customer</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Items</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Amount</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-700">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedOrders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 font-medium">{order.orderNumber || order.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-gray-900">{order.customerName}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {order.orderedItems?.length || 0} item{order.orderedItems?.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium">₱{(order.total || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={getDeliveryBadge(order).className}>
                          {getDeliveryBadge(order).label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
                        {new Date(order.createdAt).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile view */}
            <div className="md:hidden space-y-3">
              {paginatedOrders.map(order => (
                <Card key={order.id}>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-900">{order.orderNumber || order.id.slice(0, 8)}</p>
                        <Badge variant="outline" className={getDeliveryBadge(order).className}>
                          {getDeliveryBadge(order).label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{order.customerName}</p>
                      <p className="text-sm text-gray-600">
                        {order.orderedItems?.length || 0} item{order.orderedItems?.length !== 1 ? 's' : ''}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <p className="text-sm text-gray-600">
                          {new Date(order.createdAt).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <p className="font-semibold text-gray-900">₱{(order.total || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </POSLayout>
  )
}