"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package, Calendar, Download, Printer, ArrowUpDown, Receipt, Plus, Trash2, Edit } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { getOrders, type Order } from "@/lib/orders"
import { getExpenses, addExpense, deleteExpense, type Expense } from "@/lib/expenses"
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns"

type DateRange = "today" | "week" | "month" | "custom"
type ViewMode = "daily" | "monthly" | "yearly"
type SortBy = "revenue" | "quantity"

interface SalesData {
  date: string
  revenue: number
  orders: number
}

interface ProductData {
  name: string
  orders: number
  revenue: number
  quantity: number
}


export default function SalesPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [dateRange, setDateRange] = useState<DateRange>("today")
  const [viewMode, setViewMode] = useState<ViewMode>("daily")
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [sortBy, setSortBy] = useState<SortBy>("revenue")
  const [customStartDate, setCustomStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: "",
    category: "",
    date: format(new Date(), "yyyy-MM-dd")
  })
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [printOptions, setPrintOptions] = useState({
    summary: true,
    chart: true,
    topProducts: true,
    recentSales: true,
    expenses: true
  })
  const [printMode, setPrintMode] = useState<"print" | "pdf">("print")

  useEffect(() => {
    const loadOrders = () => {
      const allOrders = getOrders()
      setOrders(allOrders)
    }
    
    const loadExpenses = () => {
      const allExpenses = getExpenses()
      setExpenses(allExpenses)
    }
    
    loadOrders()
    loadExpenses()
    window.addEventListener("orders-updated", loadOrders)
    window.addEventListener("expenses-updated", loadExpenses)
    return () => {
      window.removeEventListener("orders-updated", loadOrders)
      window.removeEventListener("expenses-updated", loadExpenses)
    }
  }, [])

  const getDateRangeFilter = useMemo(() => {
    const now = new Date()
    let startDate: Date
    let endDate: Date

    switch (dateRange) {
      case "today":
        startDate = startOfDay(now)
        endDate = endOfDay(now)
        break
      case "week":
        startDate = startOfWeek(now, { weekStartsOn: 1 })
        endDate = endOfWeek(now, { weekStartsOn: 1 })
        break
      case "month":
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
      case "custom":
        if (customStartDate && customEndDate) {
          startDate = startOfDay(new Date(customStartDate))
          endDate = endOfDay(new Date(customEndDate))
        } else {
          startDate = startOfDay(now)
          endDate = endOfDay(now)
        }
        break
      default:
        startDate = startOfDay(now)
        endDate = endOfDay(now)
    }

    return { startDate, endDate }
  }, [dateRange, customStartDate, customEndDate])

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = new Date(order.date)
      return isWithinInterval(orderDate, { start: getDateRangeFilter.startDate, end: getDateRangeFilter.endDate })
    })
  }, [orders, getDateRangeFilter])

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const expenseDate = new Date(expense.date)
      return isWithinInterval(expenseDate, { start: getDateRangeFilter.startDate, end: getDateRangeFilter.endDate })
    })
  }, [expenses, getDateRangeFilter])

  const paidOrders = useMemo(() => {
    return filteredOrders.filter(order => order.paymentStatus === "paid")
  }, [filteredOrders])

  const summaryData = useMemo(() => {
    const totalRevenue = paidOrders.reduce((sum, order) => sum + order.total, 0)
    const totalOrders = filteredOrders.length
    const paidOrdersCount = paidOrders.length
    const averageOrderValue = paidOrdersCount > 0 ? totalRevenue / paidOrdersCount : 0
    
    // Calculate total expenses
    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)
    
    // Calculate profit
    const profit = totalRevenue - totalExpenses
    
    // Get unique customers
    const uniqueCustomers = new Set(filteredOrders.map(order => order.customerName))
    const newCustomers = uniqueCustomers.size

    return {
      totalRevenue,
      totalOrders,
      paidOrdersCount,
      averageOrderValue,
      totalExpenses,
      profit,
      newCustomers
    }
  }, [filteredOrders, paidOrders, filteredExpenses])

  const salesData = useMemo(() => {
    const data: SalesData[] = []
    
    if (viewMode === "daily") {
      // Group by day of week (0=Sunday, 1=Monday, etc.)
      const dailyMap = new Map<number, { revenue: number; orders: number }>()
      
      paidOrders.forEach(order => {
        const orderDate = new Date(order.date)
        const dayOfWeek = orderDate.getDay()
        const existing = dailyMap.get(dayOfWeek) || { revenue: 0, orders: 0 }
        dailyMap.set(dayOfWeek, {
          revenue: existing.revenue + order.total,
          orders: existing.orders + 1
        })
      })
      
      // Always show all 7 days of the week (Mon-Sun) - like monthly shows all 12 months
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      for (let i = 0; i < 7; i++) {
        const dayIndex = (i + 1) % 7 // Monday=1, Tuesday=2, ..., Sunday=0
        const dayData = dailyMap.get(dayIndex) || { revenue: 0, orders: 0 }
        
        // Ensure we always push data for every day
        data.push({ 
          date: dayNames[i], 
          revenue: dayData.revenue || 0, 
          orders: dayData.orders || 0 
        })
      }
      
      // Debug: Log the final data to ensure all 7 days are present
      console.log('Daily sales data:', data)
    } else if (viewMode === "monthly") {
      // Group by month for selected year
      const monthlyMap = new Map<number, { revenue: number; orders: number }>()
      
      paidOrders.forEach(order => {
        const orderDate = new Date(order.date)
        if (orderDate.getFullYear() === selectedYear) {
          const month = orderDate.getMonth()
          const existing = monthlyMap.get(month) || { revenue: 0, orders: 0 }
          monthlyMap.set(month, {
            revenue: existing.revenue + order.total,
            orders: existing.orders + 1
          })
        }
      })
      
      for (let i = 0; i < 12; i++) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        const monthData = monthlyMap.get(i) || { revenue: 0, orders: 0 }
        data.push({ date: monthNames[i], revenue: monthData.revenue, orders: monthData.orders })
      }
    } else {
      // Group by year
      const yearlyMap = new Map<number, { revenue: number; orders: number }>()
      
      paidOrders.forEach(order => {
        const year = new Date(order.date).getFullYear()
        const existing = yearlyMap.get(year) || { revenue: 0, orders: 0 }
        yearlyMap.set(year, {
          revenue: existing.revenue + order.total,
          orders: existing.orders + 1
        })
      })
      
      Array.from(yearlyMap.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([year, yearData]) => {
          data.push({ date: year.toString(), revenue: yearData.revenue, orders: yearData.orders })
        })
    }
    
    return data
  }, [paidOrders, viewMode, selectedYear])

  const topProducts = useMemo(() => {
    const productMap = new Map<string, { orders: number; revenue: number; quantity: number }>()
    
    paidOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = productMap.get(item.name) || { orders: 0, revenue: 0, quantity: 0 }
        productMap.set(item.name, {
          orders: existing.orders + 1,
          revenue: existing.revenue + (item.price * item.quantity),
          quantity: existing.quantity + item.quantity
        })
      })
    })
    
    return Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => {
        if (sortBy === "revenue") return b.revenue - a.revenue
        return b.quantity - a.quantity
      })
      .slice(0, 10)
  }, [paidOrders, sortBy])

  const recentSales = useMemo(() => {
    return paidOrders
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
  }, [paidOrders])

  const paymentSummary = useMemo(() => {
    const cashPayments = paidOrders.filter(order => order.paymentMethod === "cash")
      .reduce((sum, order) => sum + order.total, 0)
    const gcashPayments = paidOrders.filter(order => order.paymentMethod === "gcash")
      .reduce((sum, order) => sum + order.total, 0)
    const unpaidAmount = filteredOrders.filter(order => order.paymentStatus === "not-paid")
      .reduce((sum, order) => sum + order.total, 0)
    
    return {
      cash: cashPayments,
      gcash: gcashPayments,
      unpaid: unpaidAmount,
      total: cashPayments + gcashPayments + unpaidAmount
    }
  }, [filteredOrders, paidOrders])

  const handlePrint = () => {
    setPrintMode("print")
    setShowPrintDialog(true)
  }

  const handleExportPDF = () => {
    setPrintMode("pdf")
    setShowPrintDialog(true)
  }

  const handlePrintConfirmed = () => {
    setShowPrintDialog(false)
    window.print()
  }

  const togglePrintOption = (option: keyof typeof printOptions) => {
    setPrintOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }))
  }

  const handleAddExpense = () => {
    if (newExpense.description && newExpense.amount && newExpense.category) {
      addExpense({
        description: newExpense.description,
        amount: parseFloat(newExpense.amount),
        category: newExpense.category,
        date: newExpense.date
      })
      
      // Reset form
      setNewExpense({
        description: "",
        amount: "",
        category: "",
        date: format(new Date(), "yyyy-MM-dd")
      })
      setShowAddExpense(false)
    }
  }

  const handleDeleteExpense = (expenseId: string) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      deleteExpense(expenseId)
    }
  }

  const expenseCategories = [
    "Food & Ingredients",
    "Utilities",
    "Rent",
    "Salaries",
    "Marketing",
    "Equipment",
    "Supplies",
    "Maintenance",
    "Other"
  ]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP"
    }).format(amount)
  }

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)
  }, [])

  return (
    <>
      {/* Print Styles */}
      <style jsx global>{`
        /* Hide print area by default */
        .print-area {
          display: none !important;
          visibility: hidden !important;
          position: absolute !important;
          left: -9999px !important;
          top: -9999px !important;
          opacity: 0 !important;
          pointer-events: none !important;
          height: 0 !important;
          width: 0 !important;
          overflow: hidden !important;
        }
        
        /* Show print area only when printing */
        @media print {
          .print-area {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            left: auto !important;
            top: auto !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            height: auto !important;
            width: 100% !important;
            overflow: visible !important;
            padding: 20px;
          }
          
          /* Hide everything else when printing */
          body > *:not(.print-area) {
            display: none !important;
          }
        }
        
        /* Only show print container when actually printing */
        @media print {
          @page {
            size: auto;
            margin: 10mm;
          }
          
          /* Hide everything by default when printing */
          body * {
            visibility: hidden;
          }
          
          /* Only show print container and its children when printing */
          .print-container,
          .print-container * {
            visibility: visible;
            display: block !important;
            position: static !important;
            left: auto !important;
            top: auto !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            height: auto !important;
            width: 100% !important;
            overflow: visible !important;
          }
          
          .print-container {
            padding: 20px;
          }
          
          /* Hide non-print elements */
          .no-print,
          .no-print * {
            display: none !important;
          }
          
          /* Print-specific styles */
          .print-header {
            text-align: center;
            margin-bottom: 20px;
          }
          
          .print-title {
            font-size: 24px;
            font-weight: bold;
            margin: 10px 0;
            color: #000;
          }
          
          .print-subtitle {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
          }
          
          .print-summary-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 15px;
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          
          .print-summary-card {
            border: 1px solid #ddd;
            padding: 15px;
            text-align: center;
            background: #f9f9f9;
          }
          
          .print-summary-title {
            font-size: 12px;
            color: #666;
            margin-bottom: 8px;
            text-transform: uppercase;
            font-weight: 600;
          }
          
          .print-summary-value {
            font-size: 18px;
            font-weight: bold;
            color: #000;
          }
          
          .print-section {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          
          .print-section-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #000;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
          }
          
          .print-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          
          .print-table th,
          .print-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            font-size: 12px;
          }
          
          .print-table th {
            background-color: #f5f5f5;
            font-weight: 600;
          }
          
          .print-footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
          }
        }
      `}</style>
      
      <POSLayout>
        <div className="space-y-6 h-full">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Sales Summary</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Track your revenue and business performance</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="hidden sm:flex">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="hidden sm:flex">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="sm:hidden">
              <Printer className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="sm:hidden">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Print Dialog */}
        <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
          <DialogContent className="max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-0">
              <DialogTitle>{printMode === "print" ? "Print Preview" : "Export PDF Preview"}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Select sections to include in your {printMode === "print" ? "print" : "PDF"} report:
              </p>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="summary"
                      checked={printOptions.summary}
                      onCheckedChange={() => togglePrintOption('summary')}
                    />
                    <Label htmlFor="summary" className="text-sm font-medium">Summary Cards</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="chart"
                      checked={printOptions.chart}
                      onCheckedChange={() => togglePrintOption('chart')}
                    />
                    <Label htmlFor="chart" className="text-sm font-medium">
                      Revenue Trend Chart ({viewMode === "daily" ? "Daily" : viewMode === "monthly" ? "Monthly" : "Yearly"})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="topProducts"
                      checked={printOptions.topProducts}
                      onCheckedChange={() => togglePrintOption('topProducts')}
                    />
                    <Label htmlFor="topProducts" className="text-sm font-medium">Top Products</Label>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="recentSales"
                      checked={printOptions.recentSales}
                      onCheckedChange={() => togglePrintOption('recentSales')}
                    />
                    <Label htmlFor="recentSales" className="text-sm font-medium">Recent Sales</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="expenses"
                      checked={printOptions.expenses}
                      onCheckedChange={() => togglePrintOption('expenses')}
                    />
                    <Label htmlFor="expenses" className="text-sm font-medium">Expenses</Label>
                  </div>
                </div>
              </div>
              
              <div className="pt-2">
                <div className="border rounded-lg p-4 bg-muted/20">
                  <h4 className="font-medium mb-2">Preview Area</h4>
                  <div className="text-sm text-muted-foreground">
                    Your selected sections will appear here when printing or exporting to PDF.
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4 border-t mt-2">
                <Button onClick={handlePrintConfirmed} className="flex-1">
                  {printMode === "print" ? (
                    <>
                      <Printer className="h-4 w-4 mr-2" />
                      Print Report
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export PDF
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowPrintDialog(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Controls */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <Select value={dateRange} onValueChange={(value: DateRange) => setDateRange(value)}>
              <SelectTrigger className="w-[120px] sm:w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            
            {dateRange === "custom" && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2 sm:px-3 py-2 border rounded-md text-sm"
                />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2 sm:px-3 py-2 border rounded-md text-sm"
                />
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Tabs value={viewMode} onValueChange={(value: string) => setViewMode(value as ViewMode)}>
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="daily" className="text-xs sm:text-sm">Daily</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs sm:text-sm">Monthly</TabsTrigger>
                <TabsTrigger value="yearly" className="text-xs sm:text-sm">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>
            
            {viewMode === "yearly" && (
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-[80px] sm:w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <Card className="col-span-1 sm:col-span-1 lg:col-span-1 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold truncate">{formatCurrency(summaryData.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Paid orders only</p>
                </div>
                <DollarSign className="h-6 w-6 sm:h-7 w-7 lg:h-8 w-8 text-primary flex-shrink-0 ml-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1 sm:col-span-1 lg:col-span-1 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600 truncate">{formatCurrency(summaryData.totalExpenses)}</p>
                  <p className="text-xs text-muted-foreground mt-1">All expenses</p>
                </div>
                <Receipt className="h-6 w-6 sm:h-7 w-7 lg:h-8 w-8 text-red-500 flex-shrink-0 ml-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1 sm:col-span-1 lg:col-span-1 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="min-w-0 flex-1">
                  <p className={`text-lg sm:text-xl lg:text-2xl font-bold truncate ${summaryData.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(summaryData.profit)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Revenue - Expenses</p>
                </div>
                <TrendingUp className={`h-6 w-6 sm:h-7 w-7 lg:h-8 w-8 flex-shrink-0 ml-2 ${summaryData.profit >= 0 ? "text-green-500" : "text-red-500"}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1 sm:col-span-1 lg:col-span-1 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold truncate">{summaryData.totalOrders}</p>
                  <p className="text-xs text-muted-foreground mt-1">All orders</p>
                </div>
                <ShoppingCart className="h-6 w-6 sm:h-7 w-7 lg:h-8 w-8 text-accent flex-shrink-0 ml-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1 sm:col-span-1 lg:col-span-1 xl:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">New Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold truncate">{summaryData.newCustomers}</p>
                  <p className="text-xs text-muted-foreground mt-1">First-time customers</p>
                </div>
                <Users className="h-6 w-6 sm:h-7 w-7 lg:h-8 w-8 text-accent flex-shrink-0 ml-2" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Revenue Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <p className="text-sm text-muted-foreground">
                {viewMode === "daily" ? "Daily" : viewMode === "monthly" ? "Monthly" : "Yearly"} performance overview
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-72 lg:h-80 xl:h-96 2xl:h-[400px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={salesData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      fontSize={11}
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                      minTickGap={2}
                    />
                    <YAxis 
                      tickFormatter={(value) => `₱${value}`}
                      fontSize={11}
                      tick={{ fontSize: 11 }}
                      width={70}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Day: ${label}`}
                    />
                    <Bar dataKey="revenue" fill="#eab308" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
              <p className="text-sm text-muted-foreground">Payment method breakdown</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium">Paid (Cash)</span>
                  </div>
                  <span className="font-bold text-green-700 dark:text-green-400">{formatCurrency(paymentSummary.cash)}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
                    <span className="font-medium">Paid (GCash)</span>
                  </div>
                  <span className="font-bold text-yellow-700 dark:text-yellow-400">{formatCurrency(paymentSummary.gcash)}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-red-500 rounded-full"></div>
                    <span className="font-medium">Unpaid</span>
                  </div>
                  <span className="font-bold text-red-700 dark:text-red-400">{formatCurrency(paymentSummary.unpaid)}</span>
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-lg">Total</span>
                    <span className="font-bold text-lg">{formatCurrency(paymentSummary.total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Top Products</CardTitle>
                <p className="text-sm text-muted-foreground">Best-selling items</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="quantity">Quantity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.orders} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(product.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{product.quantity} sold</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No product sales</h3>
                <p className="text-sm text-muted-foreground">Product sales data will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
            <p className="text-sm text-muted-foreground">Latest paid transactions</p>
          </CardHeader>
          <CardContent>
            {recentSales.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Order ID</TableHead>
                      <TableHead className="whitespace-nowrap">Payment Method</TableHead>
                      <TableHead className="whitespace-nowrap">Amount</TableHead>
                      <TableHead className="whitespace-nowrap">Date & Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSales.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={order.paymentMethod === "cash" ? "default" : "secondary"}
                            className={order.paymentMethod === "cash" 
                              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" 
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                            }
                          >
                            {order.paymentMethod === "cash" ? "Cash" : "GCash"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(order.total)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(order.date), "MMM dd, yyyy – h:mm a")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No recent sales</h3>
                <p className="text-sm text-muted-foreground">Recent sales transactions will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Expenses</CardTitle>
                <p className="text-sm text-muted-foreground">Manage your business expenses</p>
              </div>
              <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Expense
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Expense</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={newExpense.description}
                        onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                        placeholder="e.g., Grocery shopping"
                      />
                    </div>
                    <div>
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select value={newExpense.category} onValueChange={(value) => setNewExpense({...newExpense, category: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {expenseCategories.map(category => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={newExpense.date}
                        onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleAddExpense} className="flex-1">
                        Add Expense
                      </Button>
                      <Button variant="outline" onClick={() => setShowAddExpense(false)} className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Description</TableHead>
                      <TableHead className="whitespace-nowrap">Category</TableHead>
                      <TableHead className="whitespace-nowrap">Amount</TableHead>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 10)
                      .map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">{expense.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{expense.category}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-red-600">{formatCurrency(expense.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(expense.date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Receipt className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No expenses recorded</h3>
                <p className="text-sm text-muted-foreground">Start tracking your expenses by clicking the "Add Expense" button above.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </POSLayout>

      {/* Print Area - Hidden by default, only shown when printing */}
      <div className="print-area" style={{ display: 'none' }}>
        {/* Print Header */}
        <div className="print-header">
          <div className="print-logo">
            <Image 
              src="/images/yrc-image.jpg" 
              alt="Yellowbell Roast Co." 
              width={120} 
              height={120}
              className="mx-auto"
            />
          </div>
          <h1 className="print-title">Yellowbell Roast Co.</h1>
          <p className="print-subtitle">Sales Summary Report</p>
          <p className="print-subtitle">
            {dateRange === "today" && format(new Date(), "MMMM dd, yyyy")}
            {dateRange === "week" && `Week of ${format(startOfWeek(new Date(), { weekStartsOn: 1 }), "MMMM dd, yyyy")}`}
            {dateRange === "month" && format(new Date(), "MMMM yyyy")}
            {dateRange === "custom" && `${format(new Date(customStartDate), "MMM dd")} - ${format(new Date(customEndDate), "MMM dd, yyyy")}`}
          </p>
        </div>

        {/* Print Summary Cards */}
        {printOptions.summary && (
          <div className="print-summary-grid">
            <div className="print-summary-card">
              <div className="print-summary-title">Total Revenue</div>
              <div className="print-summary-value">{formatCurrency(summaryData.totalRevenue)}</div>
            </div>
            <div className="print-summary-card">
              <div className="print-summary-title">Total Expenses</div>
              <div className="print-summary-value">{formatCurrency(summaryData.totalExpenses)}</div>
            </div>
            <div className="print-summary-card">
              <div className="print-summary-title">Net Profit</div>
              <div className="print-summary-value">{formatCurrency(summaryData.profit)}</div>
            </div>
            <div className="print-summary-card">
              <div className="print-summary-title">Total Orders</div>
              <div className="print-summary-value">{summaryData.totalOrders}</div>
            </div>
            <div className="print-summary-card">
              <div className="print-summary-title">New Customers</div>
              <div className="print-summary-value">{summaryData.newCustomers}</div>
            </div>
          </div>
        )}

        {/* Print Chart */}
        {printOptions.chart && (
          <div className="print-section">
            <h2 className="print-section-title">Revenue Trend ({viewMode === "daily" ? "Daily" : viewMode === "monthly" ? "Monthly" : "Yearly"})</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => `₱${value}`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="revenue" fill="#eab308" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Print Top Products */}
        {printOptions.topProducts && (
          <div className="print-section">
            <h2 className="print-section-title">Top Products</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Product Name</th>
                  <th>Orders</th>
                  <th>Quantity Sold</th>
                  <th>Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, index) => (
                  <tr key={product.name}>
                    <td>{index + 1}</td>
                    <td>{product.name}</td>
                    <td>{product.orders}</td>
                    <td>{product.quantity}</td>
                    <td>{formatCurrency(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Print Recent Sales */}
        {printOptions.recentSales && (
          <div className="print-section">
            <h2 className="print-section-title">Recent Sales</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Payment Method</th>
                  <th>Amount</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((order) => (
                  <tr key={order.id}>
                    <td>{order.orderNumber}</td>
                    <td>{order.paymentMethod === "cash" ? "Cash" : "GCash"}</td>
                    <td>{formatCurrency(order.total)}</td>
                    <td>{format(new Date(order.date), "MMM dd, yyyy – h:mm a")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Print Expenses */}
        {printOptions.expenses && (
          <div className="print-section">
            <h2 className="print-section-title">Expenses</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 10)
                  .map((expense) => (
                  <tr key={expense.id}>
                    <td>{expense.description}</td>
                    <td>{expense.category}</td>
                    <td>{formatCurrency(expense.amount)}</td>
                    <td>{format(new Date(expense.date), "MMM dd, yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Print Footer */}
        <div className="print-footer">
          <p>Report generated on {format(new Date(), "MMMM dd, yyyy 'at' h:mm a")}</p>
          <p>Yellowbell Roast Co. - POS System</p>
        </div>
      </div>
    </>
  )
}
