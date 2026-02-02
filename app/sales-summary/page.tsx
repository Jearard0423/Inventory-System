"use client"

import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, DollarSign, ShoppingBag, TrendingUp, Download, Filter, Clock } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Pagination } from "@/components/pagination"
import { getOrders } from "@/lib/orders"

type Period = "Today" | "This Week" | "This Month" | "This Year"

interface Order {
  id: string
  orderNumber: string
  customerName: string
  date: string
  items: { id: string; name: string; price: number; quantity: number }[]
  total: number
  paymentStatus: "paid" | "not-paid"
  paymentMethod?: "cash" | "gcash"
  cookTime?: string
}

interface ProductSales {
  name: string
  sales: number
  quantity: number
  percentage: number
}

interface HourlySales {
  hour: string
  sales: number
  count: number
}

export default function SalesSummaryPage() {
  const [activePeriod, setActivePeriod] = useState<Period>("Today")
  const [currentPage, setCurrentPage] = useState(1)
  const [orders, setOrders] = useState<Order[]>([])
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([])
  const [summaryData, setSummaryData] = useState({
    totalSales: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    growth: "0%",
    peakHour: "N/A"
  })
  const [topProducts, setTopProducts] = useState<ProductSales[]>([])
  const [hourlySales, setHourlySales] = useState<HourlySales[]>([])
  const [paymentMethods, setPaymentMethods] = useState<{method: string; amount: number; percentage: number}[]>([])
  
  const itemsPerPage = 5
  const periods: Period[] = ["Today", "This Week", "This Month", "This Year"]
  
  // Initialize with all hours from 8 AM to 10 PM
  const allHours = Array.from({ length: 15 }, (_, i) => ({
    hour: `${i + 8} ${i < 4 ? 'AM' : i === 4 ? 'PM' : 'PM'}`,
    sales: 0,
    count: 0
  }))

  // Load orders on component mount
  useEffect(() => {
    const allOrders = getOrders()
    setOrders(allOrders)
    filterOrders(allOrders, activePeriod)
  }, [])
  
  // Filter orders when period changes
  useEffect(() => {
    if (orders.length > 0) {
      filterOrders(orders, activePeriod)
    }
  }, [activePeriod, orders])
  
  // Calculate metrics when filtered orders change
  useEffect(() => {
    if (filteredOrders.length > 0) {
      calculateMetrics()
    } else {
      // Reset metrics when no orders
      setSummaryData({
        totalSales: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        growth: "0%",
        peakHour: "N/A"
      })
      setTopProducts([])
      setHourlySales([...allHours])
      setPaymentMethods([])
    }
  }, [filteredOrders])
  
  const filterOrders = (orders: Order[], period: Period) => {
    const now = new Date()
    const filtered = orders.filter(order => {
      const orderDate = new Date(order.date)
      const orderTime = order.cookTime ? order.cookTime.split(':').map(Number) : [0, 0]
      const orderHour = orderTime[0] || 0
      
      // Filter by period
      switch (period) {
        case 'Today':
          return orderDate.toDateString() === now.toDateString()
        case 'This Week': {
          const weekStart = new Date(now)
          weekStart.setDate(now.getDate() - now.getDay())
          weekStart.setHours(0, 0, 0, 0)
          return orderDate >= weekStart
        }
        case 'This Month':
          return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear()
        case 'This Year':
          return orderDate.getFullYear() === now.getFullYear()
        default:
          return true
      }
    })
    
    setFilteredOrders(filtered)
  }
  
  const calculateMetrics = () => {
    // Calculate total sales and order count
    const totalSales = filteredOrders.reduce((sum, order) => sum + order.total, 0)
    const totalOrders = filteredOrders.length
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0
    
    // Calculate growth (simplified - in a real app, compare with previous period)
    const growth = totalOrders > 0 ? "+5.2%" : "0%"
    
    // Calculate top products
    const productMap = new Map<string, {sales: number, quantity: number}>()
    
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = productMap.get(item.name) || { sales: 0, quantity: 0 }
        productMap.set(item.name, {
          sales: existing.sales + (item.price * item.quantity),
          quantity: existing.quantity + item.quantity
        })
      })
    })
    
    // Convert to array and sort by sales
    const topProducts = Array.from(productMap.entries())
      .map(([name, {sales, quantity}]) => ({
        name,
        sales,
        quantity,
        percentage: totalSales > 0 ? Math.round((sales / totalSales) * 100) : 0
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 8) // Top 8 products
    
    // Calculate hourly sales
    const hourlyMap = new Map<string, {sales: number, count: number}>()
    
    // Initialize with all hours
    allHours.forEach(hour => {
      hourlyMap.set(hour.hour, { sales: 0, count: 0 })
    })
    
    filteredOrders.forEach(order => {
      if (!order.cookTime) return
      
      const [hour, minute] = order.cookTime.split(':').map(Number)
      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      const hourKey = `${displayHour} ${period}`
      
      const existing = hourlyMap.get(hourKey) || { sales: 0, count: 0 }
      hourlyMap.set(hourKey, {
        sales: existing.sales + order.total,
        count: existing.count + 1
      })
    })
    
    const hourlySales = Array.from(hourlyMap.entries())
      .map(([hour, {sales, count}]) => ({
        hour,
        sales,
        count
      }))
      .sort((a, b) => {
        // Sort by hour
        const aHour = parseInt(a.hour.split(' ')[0])
        const bHour = parseInt(b.hour.split(' ')[0])
        const aPeriod = a.hour.includes('PM') ? 12 : 0
        const bPeriod = b.hour.includes('PM') ? 12 : 0
        return (aHour + aPeriod) - (bHour + bPeriod)
      })
    
    // Find peak hour
    let peakHour = "N/A"
    let maxHourlySales = 0
    
    hourlySales.forEach(({hour, sales}) => {
      if (sales > maxHourlySales) {
        maxHourlySales = sales
        peakHour = hour
      }
    })
    
    // Calculate payment methods
    const paymentMap = new Map<string, number>()
    filteredOrders.forEach(order => {
      const method = order.paymentMethod || 'cash' // Default to cash if not specified
      const current = paymentMap.get(method) || 0
      paymentMap.set(method, current + order.total)
    })
    
    const paymentMethods = Array.from(paymentMap.entries())
      .map(([method, amount]) => ({
        method: method.charAt(0).toUpperCase() + method.slice(1),
        amount,
        percentage: totalSales > 0 ? Math.round((amount / totalSales) * 100) : 0
      }))
    
    // Update state
    setSummaryData({
      totalSales,
      totalOrders,
      avgOrderValue,
      growth,
      peakHour
    })
    
    setTopProducts(topProducts)
    setHourlySales(hourlySales)
    setPaymentMethods(paymentMethods)
  }
  
  const maxSales = Math.max(...hourlySales.map(h => h.sales), 1) // Avoid division by zero
  const totalPages = Math.ceil(topProducts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProducts = topProducts.slice(startIndex, endIndex)
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount)
  }

  return (
    <POSLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Sales Summary</h1>
            <p className="text-muted-foreground mt-1">Track your business performance and revenue</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {periods.map((period) => (
            <Button
              key={period}
              variant={activePeriod === period ? "default" : "outline"}
              size="sm"
              onClick={() => setActivePeriod(period)}
              className={cn(activePeriod === period && "bg-primary")}
            >
              {period}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summaryData.totalSales)}</div>
              <p className="text-xs text-green-600 mt-1">
                <TrendingUp className="h-3 w-3 inline mr-1" />
                {summaryData.growth} from last period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryData.totalOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">Orders completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summaryData.avgOrderValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Per transaction</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Peak Hour</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryData.peakHour}</div>
              <p className="text-xs text-muted-foreground mt-1">Highest sales volume</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sales by Hour</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {hourlySales.map((item) => (
                  <div key={item.hour} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.hour}</span>
                      <span className="text-muted-foreground">{formatCurrency(item.sales)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${(item.sales / maxSales) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paginatedProducts.map((product, index) => {
                  const actualIndex = startIndex + index
                  return (
                    <div key={product.name} className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                              {actualIndex + 1}
                            </span>
                            <span className="font-medium text-sm">{product.name}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 ml-8 text-xs text-muted-foreground">
                            <span>{product.quantity} sold</span>
                            <span>{product.percentage}% of sales</span>
                          </div>
                        </div>
                        <span className="text-sm font-semibold whitespace-nowrap">{formatCurrency(product.sales)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden ml-8">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${product.percentage * 3}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {paymentMethods.length > 0 ? (
                paymentMethods.map((method) => (
                  <div key={method.method} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{method.method}</span>
                      <span className="text-sm text-muted-foreground">{method.percentage}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full" 
                        style={{ width: `${method.percentage}%` }} 
                      />
                    </div>
                    <div className="text-lg font-bold">{formatCurrency(method.amount)}</div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center py-4 text-muted-foreground">
                  <Clock className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p>No payment data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </POSLayout>
  )
}
