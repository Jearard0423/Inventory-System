"use client"

import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Minus, X, Check, Clock, Package, ArrowRight, Users, Trash2, BarChart3 } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { getMenuItems, reduceStock, reduceUtensilsForMeal, reduceContainerForItem, type InventoryItem } from "@/lib/inventory-store"
import { generateOrderNumber, generatePreparedOrderNumber, getOrders } from "@/lib/orders"

const categories = ["All", "Chicken", "Liempo", "Sisig", "Rice", "Meals"]
const mealTypes = ["Breakfast", "Lunch", "Dinner", "Other"]

export interface PreparedOrder {
  id: string
  orderNumber: string
  items: Array<{ id: string; name: string; price: number; quantity: number; remainingQuantity: number }>
  total: number
  createdAt: string
  status: "prepared" | "converted"
  customerName?: string
  mealType?: string
  paymentStatus?: "paid" | "not-paid"
}

export default function PreparedOrdersPage() {
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [preparedItems, setPreparedItems] = useState<Array<{ id: string; name: string; price: number; quantity: number; remainingQuantity: number }>>([])
  const [menuItems, setMenuItems] = useState<InventoryItem[]>([])
  const [preparedOrders, setPreparedOrders] = useState<PreparedOrder[]>([])
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [selectedPreparedOrder, setSelectedPreparedOrder] = useState<PreparedOrder | null>(null)
  const [customerName, setCustomerName] = useState("")
  const [selectedMealType, setSelectedMealType] = useState("Lunch")
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "not-paid">("not-paid")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash">("cash")
  const [filterMealType, setFilterMealType] = useState("All")
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({})
  const [amountGiven, setAmountGiven] = useState("")
  const [gcashPhone, setGcashPhone] = useState("")
  const [gcashReference, setGcashReference] = useState("")
  const [showGcashQrModal, setShowGcashQrModal] = useState(false)
  const [soldQuantities, setSoldQuantities] = useState<Record<string, number>>({})
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showClearAllDialog, setShowClearAllDialog] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null)
  const [modalCategoryFilter, setModalCategoryFilter] = useState("All")

  // Initialize selectedMealType based on current time when component mounts
  useEffect(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const totalMinutes = currentHour * 60 + currentMinute;
    
    let defaultMealType = "Lunch";
    if (totalMinutes >= 5 * 60 && totalMinutes < 11 * 60) {
      defaultMealType = "Breakfast";
    } else if (totalMinutes >= 11 * 60 && totalMinutes < 17 * 60) {
      defaultMealType = "Lunch";
    } else if (totalMinutes >= 17 * 60 || totalMinutes < 5 * 60) {
      defaultMealType = "Dinner";
    }
    
    setSelectedMealType(defaultMealType);
  }, []);

  useEffect(() => {
    const loadInventory = () => {
      const inventory = getMenuItems().filter((item) => item.category !== "others")
      setMenuItems(inventory)
    }

    const loadPreparedOrders = () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("yellowbell_prepared_orders")
        const orders = stored ? JSON.parse(stored) : []
        setPreparedOrders(orders)
      }
    }

    const calculateSoldQuantities = () => {
      const orders = getOrders()
      const sold: Record<string, number> = {}
      
      // Calculate sold quantities from regular orders that came from prepared orders
      orders.forEach((order: any) => {
        if (order.isPreparedOrder) {
          order.items.forEach((item: any) => {
            sold[item.id] = (sold[item.id] || 0) + item.quantity
          })
        }
      })
      
      setSoldQuantities(sold)
    }

    loadInventory()
    loadPreparedOrders()
    calculateSoldQuantities()
    
    window.addEventListener("inventory-updated", loadInventory)
    window.addEventListener("prepared-orders-updated", loadPreparedOrders)
    window.addEventListener("orders-updated", () => {
      loadPreparedOrders()
      calculateSoldQuantities()
    })

    return () => {
      window.removeEventListener("inventory-updated", loadInventory)
      window.removeEventListener("prepared-orders-updated", loadPreparedOrders)
      window.removeEventListener("orders-updated", calculateSoldQuantities)
    }
  }, [])

  const getCategoryKey = (displayCategory: string) => {
    const map: Record<string, string> = {
      Chicken: "chicken",
      Liempo: "liempo", 
      Sisig: "sisig",
      Rice: "rice",
      Meals: "meals",
    }
    return map[displayCategory] || displayCategory.toLowerCase()
  }

  const calculateConsolidatedInventory = () => {
    const consolidated: Record<string, { name: string; prepared: number; sold: number; remaining: number }> = {}
    
    // Calculate prepared quantities from all prepared orders
    preparedOrders.forEach((order: any) => {
      if (order.status === "prepared") {
        order.items.forEach((item: any) => {
          if (!consolidated[item.id]) {
            consolidated[item.id] = {
              name: item.name,
              prepared: 0,
              sold: 0,
              remaining: 0
            }
          }
          consolidated[item.id].prepared += item.quantity
          consolidated[item.id].remaining += item.remainingQuantity || item.quantity
        })
      }
    })
    
    // Add sold quantities
    Object.keys(soldQuantities).forEach(itemId => {
      if (consolidated[itemId]) {
        consolidated[itemId].sold = soldQuantities[itemId]
      }
    })
    
    return consolidated
  }

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === getCategoryKey(selectedCategory)
    return matchesCategory
  })

  const filteredPreparedOrders = preparedOrders.filter((order) => {
    const matchesMealType = filterMealType === "All" || order.mealType === filterMealType
    const matchesStatus = order.status === "prepared"
    return matchesMealType && matchesStatus
  })

  const addToPrepared = (item: InventoryItem) => {
    const existingItem = preparedItems.find(i => i.id === item.id)
    if (existingItem) {
      // If item exists, increment quantity
      updateQuantity(item.id, existingItem.quantity + 1)
    } else {
      // If item doesn't exist, add it with quantity 1
      setPreparedItems([...preparedItems, { 
        id: item.id, 
        name: item.name, 
        price: item.price, 
        quantity: 1,
        remainingQuantity: 1
      }])
    }
  }

  const removeFromPrepared = (id: string) => {
    setPreparedItems(preparedItems.filter((i) => i.id !== id))
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) {
      removeFromPrepared(id)
      return
    }
    
    setPreparedItems(preparedItems.map((i) => (i.id === id ? { ...i, quantity, remainingQuantity: quantity } : i)))
  }

  const total = preparedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const savePreparedOrder = () => {
    if (preparedItems.length === 0) return

    // Reduce inventory stock, containers, and utensils for each prepared item
    preparedItems.forEach(item => {
      // Reduce main item stock
      reduceStock(item.id, item.quantity)
      
      // Reduce container stock
      reduceContainerForItem(item.name, item.quantity)
      
      // Reduce utensils for meals
      const menuItems = getMenuItems()
      const menuItem = menuItems.find(mi => mi.id === item.id)
      if (menuItem?.category === "meals") {
        // Reduce 1 fork and 1 spoon per meal (total 2 utensils)
        for (let i = 0; i < item.quantity; i++) {
          reduceUtensilsForMeal("meal")
        }
      }
    })

    // Check if there's an existing prepared order with the same meal type
    const existingOrderIndex = preparedOrders.findIndex(
      order => order.status === "prepared" && order.mealType === selectedMealType
    )

    let updatedOrders = [...preparedOrders]

    if (existingOrderIndex !== -1) {
      // Update existing order with new items
      const existingOrder = { ...updatedOrders[existingOrderIndex] }
      
      preparedItems.forEach(newItem => {
        const existingItemIndex = existingOrder.items.findIndex(item => item.id === newItem.id)
        
        if (existingItemIndex !== -1) {
          // Item exists, update quantity and remaining quantity
          const existingItem = existingOrder.items[existingItemIndex]
          existingOrder.items[existingItemIndex] = {
            ...existingItem,
            quantity: existingItem.quantity + newItem.quantity,
            remainingQuantity: (existingItem.remainingQuantity || existingItem.quantity) + newItem.quantity
          }
        } else {
          // Item doesn't exist, add it
          existingOrder.items.push({
            ...newItem,
            remainingQuantity: newItem.quantity
          })
        }
      })
      
      // Recalculate total
      existingOrder.total = existingOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      
      // Update the order in the array
      updatedOrders[existingOrderIndex] = existingOrder
    } else {
      // Create new prepared order
      const newPreparedOrder: PreparedOrder = {
        id: Date.now().toString(),
        orderNumber: generatePreparedOrderNumber(),
        items: preparedItems.map(item => ({
          ...item,
          remainingQuantity: item.quantity
        })),
        total,
        createdAt: new Date().toISOString(),
        status: "prepared",
        mealType: selectedMealType,
      }
      updatedOrders = [...updatedOrders, newPreparedOrder]
    }
    
    setPreparedOrders(updatedOrders)
    
    if (typeof window !== "undefined") {
      localStorage.setItem("yellowbell_prepared_orders", JSON.stringify(updatedOrders))
      window.dispatchEvent(new Event("prepared-orders-updated"))
    }

    setPreparedItems([])
    setShowConfirmModal(false)
  }

  const handleDeleteClick = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setOrderToDelete(orderId)
    setShowDeleteDialog(true)
  }

  const deletePreparedOrder = () => {
    if (!orderToDelete) return
    
    const updatedOrders = preparedOrders.filter((order) => order.id !== orderToDelete)
    localStorage.setItem("yellowbell_prepared_orders", JSON.stringify(updatedOrders))
    
    // Restore remaining quantities to inventory
    const orderToDeleteObj = preparedOrders.find(order => order.id === orderToDelete)
    if (orderToDeleteObj) {
      orderToDeleteObj.items.forEach(item => {
        if (item.remainingQuantity > 0) {
          // Restore the remaining quantity to inventory
          const currentStock = parseInt(localStorage.getItem(`inventory_${item.id}`) || '0')
          localStorage.setItem(`inventory_${item.id}`, (currentStock + item.remainingQuantity).toString())
        }
      })
    }
    
    setPreparedOrders(updatedOrders)
    setShowDeleteDialog(false)
    setOrderToDelete(null)
    window.dispatchEvent(new Event("prepared-orders-updated"))
    window.dispatchEvent(new Event("inventory-updated"))
  }

  const openOrderModal = (order: PreparedOrder) => {
    setSelectedPreparedOrder(order)
    setCustomerName("")
    setSelectedMealType("Lunch")
    setPaymentStatus("not-paid")
    setPaymentMethod("cash")
    setAmountGiven("")
    setGcashPhone("")
    setGcashReference("")
    setModalCategoryFilter("All")
    
    // Initialize order quantities with 0 for each item
    const initialQuantities: Record<string, number> = {}
    order.items.forEach(item => {
      initialQuantities[item.id] = 0
    })
    setOrderQuantities(initialQuantities)
    
    setShowOrderModal(true)
  }

  const handleGcashPaymentDone = () => {
    // Just close the QR modal, don't auto-fill customer name
    setShowGcashQrModal(false)
  }

  const handleGcashPhoneChange = (value: string) => {
    // Remove all non-digit characters
    let digitsOnly = value.replace(/\D/g, '')
    
    // Ensure it starts with 09 and limit to 11 digits
    if (digitsOnly.length > 0) {
      // If user starts with 9, prepend 0
      if (digitsOnly.startsWith('9') && digitsOnly.length <= 10) {
        digitsOnly = '0' + digitsOnly
      }
      // If user starts with 0, ensure next digit is 9
      else if (digitsOnly.startsWith('0')) {
        if (digitsOnly.length === 1) {
          digitsOnly = '09'
        } else if (!digitsOnly.startsWith('09')) {
          digitsOnly = '09' + digitsOnly.slice(1)
        }
      }
      // If user starts with other digits, replace with 09
      else if (!digitsOnly.startsWith('09')) {
        digitsOnly = '09'
      }
      
      // Limit to 11 digits
      digitsOnly = digitsOnly.slice(0, 11)
      
      // Format with dashes: 09XXX-XXX-XXX
      if (digitsOnly.length > 0) {
        let formatted = digitsOnly
        if (digitsOnly.length > 4) {
          formatted = digitsOnly.slice(0, 4) + '-' + digitsOnly.slice(4)
        }
        if (digitsOnly.length > 7) {
          formatted = formatted.slice(0, 8) + '-' + digitsOnly.slice(7)
        }
        setGcashPhone(formatted)
      } else {
        setGcashPhone('')
      }
    } else {
      setGcashPhone('')
    }
  }

  const convertToOrder = () => {
    if (!selectedPreparedOrder || !customerName.trim()) return

    // Get items with quantities > 0
    const orderItems = selectedPreparedOrder.items
      .filter(item => (orderQuantities[item.id] || 0) > 0)
      .map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: orderQuantities[item.id] || 0
      }))

    if (orderItems.length === 0) return

    // Calculate total for the order
    const orderTotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const amountGivenNum = Number.parseFloat(amountGiven) || 0

    // Convert prepared order to actual order
    const orderData = {
      id: Date.now().toString(),
      orderNumber: generateOrderNumber(),
      customerName: customerName.trim(),
      items: orderItems,
      total: orderTotal,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      status: "pending" as const,
      paymentStatus,
      paymentMethod: paymentStatus === "paid" ? paymentMethod : undefined,
      amountGiven: paymentStatus === "paid" && paymentMethod === "cash" ? amountGivenNum : undefined,
      change: paymentStatus === "paid" && paymentMethod === "cash" ? Math.max(0, amountGivenNum - orderTotal) : undefined,
      gcashPhone: paymentStatus === "paid" && paymentMethod === "gcash" ? gcashPhone : undefined,
      gcashReference: paymentStatus === "paid" && paymentMethod === "gcash" ? gcashReference : undefined,
      mealType: selectedPreparedOrder.mealType || "Other", // Use meal type from prepared order
      isPreparedOrder: true,
    }

    // Save to regular orders
    const existingOrders = JSON.parse(localStorage.getItem("yellowbell_orders") || "[]")
    const updatedOrders = [...existingOrders, orderData]
    localStorage.setItem("yellowbell_orders", JSON.stringify(updatedOrders))

    // Update prepared order - deduct quantities
    const updatedPreparedOrderItems = selectedPreparedOrder.items.map(item => ({
      ...item,
      remainingQuantity: Math.max(0, (item.remainingQuantity || item.quantity) - (orderQuantities[item.id] || 0))
    }))

    const updatedPreparedOrders = preparedOrders.map(order =>
      order.id === selectedPreparedOrder.id
        ? { ...order, items: updatedPreparedOrderItems, status: (updatedPreparedOrderItems.some(item => item.remainingQuantity > 0) ? "prepared" : "converted") as "prepared" | "converted" }
        : order
    )
    setPreparedOrders(updatedPreparedOrders)
    localStorage.setItem("yellowbell_prepared_orders", JSON.stringify(updatedPreparedOrders))

    // Dispatch events
    window.dispatchEvent(new Event("orders-updated"))
    window.dispatchEvent(new Event("prepared-orders-updated"))

    setShowOrderModal(false)
    setSelectedPreparedOrder(null)
    setCustomerName("")
    setOrderQuantities({})
  }

  const moveAllToOrders = () => {
    const unconvertedOrders = preparedOrders.filter(order => order.status === "prepared")
    
    if (unconvertedOrders.length === 0) return

    const newOrders = unconvertedOrders.map(order => ({
      id: Date.now().toString() + Math.random(),
      orderNumber: generateOrderNumber(),
      customerName: "PREPARED ORDER",
      items: order.items,
      total: order.total,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      status: "pending" as const,
      paymentStatus: "not-paid" as const,
      mealType: "Other",
      isPreparedOrder: true,
    }))

    // Save to regular orders
    const existingOrders = JSON.parse(localStorage.getItem("yellowbell_orders") || "[]")
    const updatedOrders = [...existingOrders, ...newOrders]
    localStorage.setItem("yellowbell_orders", JSON.stringify(updatedOrders))

    // Update all prepared orders to converted
    const updatedPreparedOrders = preparedOrders.map(order =>
      order.status === "prepared"
        ? { ...order, status: "converted" as const, customerName: "PREPARED ORDER", mealType: "Other", paymentStatus: "not-paid" as const }
        : order
    )
    setPreparedOrders(updatedPreparedOrders)
    localStorage.setItem("yellowbell_prepared_orders", JSON.stringify(updatedPreparedOrders))

    // Dispatch events
    window.dispatchEvent(new Event("orders-updated"))
    window.dispatchEvent(new Event("prepared-orders-updated"))
  }

  return (
    <POSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Prepared Orders</h1>
          <p className="text-muted-foreground">Pre-set cooked food quantities for future orders</p>
        </div>

        {/* Inventory Summary Section - MOVED TO TOP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Prepared Orders Inventory Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] overflow-y-auto">
            {Object.keys(calculateConsolidatedInventory()).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No prepared items found</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(calculateConsolidatedInventory()).map(([itemId, data]) => {
                  const percentageSold = data.prepared > 0 ? (data.sold / data.prepared) * 100 : 0
                  const statusColor = data.remaining === 0 ? "bg-red-500" : data.remaining <= data.prepared * 0.2 ? "bg-orange-500" : "bg-green-500"
                  
                  return (
                    <div key={itemId} className="border rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold text-base">{data.name}</h3>
                        <Badge variant="secondary" className="text-sm">
                          {data.remaining} left
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mb-2">
                        <div className="flex h-full">
                          <div 
                            className="bg-blue-500 transition-all duration-300"
                            style={{ width: `${percentageSold}%` }}
                          />
                          <div 
                            className={cn("transition-all duration-300", statusColor)}
                            style={{ width: `${100 - percentageSold}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">{data.sold} sold</span>
                        <span className={cn(
                          "font-medium",
                          data.remaining === 0 ? "text-red-600" : 
                          data.remaining <= data.prepared * 0.2 ? "text-orange-600" : 
                          "text-green-600"
                        )}>
                          {data.remaining} available
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:gap-6">
          {/* Menu Items Selection */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">Select Menu Items</span>
              </CardTitle>
              {/* Category Filter */}
              <div className="flex gap-1 sm:gap-2 overflow-x-auto whitespace-nowrap pb-2">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className="text-xs sm:text-sm min-w-[60px] sm:min-w-[80px] flex-shrink-0"
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="pt-0 h-[400px] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredItems.map((item) => {
                  const preparedItem = preparedItems.find(i => i.id === item.id)
                  return (
                    <div 
                      key={item.id} 
                      className="border rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => addToPrepared(item)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-sm">{item.name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {item.stock || 0} in stock
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">₱{item.price.toFixed(2)} each</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              updateQuantity(item.id, (preparedItem?.quantity || 0) - 1)
                            }}
                            disabled={!preparedItem}
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          >
                            <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                          <span className="w-6 sm:w-8 text-center font-medium text-sm sm:text-base">
                            {preparedItem?.quantity || 0}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              addToPrepared(item)
                            }}
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          >
                            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Current Prepared Items */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-sm sm:text-base">Current Prepared Items</span>
                </CardTitle>
                {preparedItems.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreparedItems([]);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>
              {/* Add meal type selection */}
              <div>
                <Label className="text-sm text-muted-foreground">Meal Type</Label>
                <div className="flex flex-wrap gap-1 sm:gap-2 mt-1">
                  {mealTypes.map((type) => (
                    <Button
                      key={type}
                      variant={selectedMealType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedMealType(type)}
                      className="text-xs sm:text-sm min-w-[60px] sm:min-w-[80px]"
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 h-[300px] overflow-y-auto">
              {preparedItems.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No items prepared yet</p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {preparedItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 sm:p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm sm:text-base truncate">{item.name}</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">₱{item.price.toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <span className="w-6 sm:w-8 text-center font-medium text-sm sm:text-base">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromPrepared(item.id)}
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Total:</span>
                      <span className="font-bold text-lg">₱{total.toFixed(2)}</span>
                    </div>
                    <Button
                      onClick={() => setShowConfirmModal(true)}
                      className="w-full mt-3"
                      disabled={preparedItems.length === 0}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Confirm Prepared Order
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Prepared Orders List */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center mb-4">
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Prepared Orders List
              </CardTitle>
              {filteredPreparedOrders.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowClearAllDialog(true);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Clear All
                </Button>
              )}
            </div>
            {/* Meal Type Filter */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filterMealType === "All" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterMealType("All")}
              >
                All
              </Button>
              {mealTypes.map((mealType) => (
                <Button
                  key={mealType}
                  variant={filterMealType === mealType ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterMealType(mealType)}
                >
                  {mealType}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {filteredPreparedOrders.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No prepared orders found</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredPreparedOrders.map((order) => (
                  <Card key={order.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openOrderModal(order)}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="text-sm">PREPARED</Badge>
                          {order.mealType && (
                            <Badge variant="outline" className="text-sm">
                              {order.mealType}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 mb-3">
                        {order.items.slice(0, 3).map((item, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-base">{item.name}</span>
                            <span className="text-sm text-muted-foreground font-mono bg-gray-100 px-2 py-1 rounded">
                              {item.remainingQuantity || item.quantity}/{item.quantity}
                            </span>
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <div className="text-sm text-muted-foreground">
                            +{order.items.length - 3} more items
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">₱{order.total.toFixed(2)}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteClick(order.id, e)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm Prepared Order Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-background rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <h3 className="text-xl font-bold mb-4">Confirm Prepared Order</h3>
            <div className="space-y-3 mb-6">
              {/* Meal Type Selection */}
              <div className="space-y-2">
                <Label className="text-sm">Meal Type</Label>
                <div className="flex flex-wrap gap-2">
                  {mealTypes.map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={selectedMealType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedMealType(type)}
                      className="flex-1 min-w-[80px]"
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="border-t pt-3">
                <p className="text-sm text-muted-foreground mb-2">Prepared Items:</p>
                <div className="space-y-2">
                  {preparedItems.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.name}</span>
                      <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-3">
                <span>Total Amount:</span>
                <span className="text-primary">₱{total.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowConfirmModal(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={savePreparedOrder} className="flex-1">
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Prepared Order Modal */}
      {showOrderModal && selectedPreparedOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-background rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <h3 className="text-xl font-bold mb-4">Prepared Order Details</h3>
            
            {/* Customer Name */}
            <div className="mb-4">
              <Label htmlFor="customer-name">Customer Name *</Label>
              <Input
                id="customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name"
                className="mt-1"
              />
            </div>

            
            {/* Category Filter */}
            <div className="mb-4">
              <Label>Filter by Category</Label>
              <div className="flex flex-wrap gap-1 sm:gap-2 mt-1">
                {["All", "Chicken", "Liempo", "Sisig", "Rice", "Meals"].map((category) => (
                  <Button
                    key={category}
                    type="button"
                    variant={modalCategoryFilter === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => setModalCategoryFilter(category)}
                    className="text-xs sm:text-sm min-w-[60px] sm:min-w-[80px]"
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Order Summary */}
            <div className="mb-4">
              <Label>Order Summary</Label>
              <div className="border rounded-lg p-3 mt-2 space-y-2 max-h-[200px] overflow-y-auto">
                {selectedPreparedOrder.items
                  .filter(item => {
                    if (modalCategoryFilter === "All") return true
                    const menuItem = menuItems.find(mi => mi.id === item.id)
                    return menuItem && menuItem.category === getCategoryKey(modalCategoryFilter)
                  })
                  .map((item, index) => {
                  const orderQuantity = orderQuantities[item.id] || 0
                  const remainingQuantity = item.remainingQuantity || item.quantity
                  return (
                    <div key={index} className="flex justify-between items-center">
                      <div className="flex-1">
                        <span className="text-sm">{item.name}</span>
                        <p className="text-xs text-muted-foreground">₱{item.price.toFixed(2)} each</p>
                        <p className="text-xs text-muted-foreground">Available: {remainingQuantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOrderQuantities(prev => ({
                            ...prev,
                            [item.id]: Math.max(0, orderQuantity - 1)
                          }))}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-8 text-center font-medium">{orderQuantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOrderQuantities(prev => ({
                            ...prev,
                            [item.id]: Math.min(remainingQuantity, orderQuantity + 1)
                          }))}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>₱{selectedPreparedOrder.items
                    .reduce((sum, item) => sum + item.price * (orderQuantities[item.id] || 0), 0)
                    .toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Status */}
            <div className="mb-6">
              <Label>Payment Status</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  variant={paymentStatus === "not-paid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentStatus("not-paid")}
                >
                  Not Paid
                </Button>
                <Button
                  variant={paymentStatus === "paid" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPaymentStatus("paid")}
                >
                  Paid
                </Button>
              </div>
              
              {/* Payment Method Selection */}
              {paymentStatus === "paid" && (
                <div className="mt-4 space-y-3">
                  <Label>Payment Method</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={paymentMethod === "cash" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod("cash")}
                    >
                      Cash
                    </Button>
                    <Button
                      variant={paymentMethod === "gcash" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentMethod("gcash")}
                    >
                      GCash
                    </Button>
                  </div>
                  
                  {/* Cash Payment Fields */}
                  {paymentMethod === "cash" && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="amount-given">Amount Given</Label>
                        <Input
                          id="amount-given"
                          type="number"
                          value={amountGiven}
                          onChange={(e) => setAmountGiven(e.target.value)}
                          placeholder="Enter amount given"
                          className="mt-1"
                        />
                      </div>
                      {amountGiven && Object.values(orderQuantities).some(qty => qty > 0) && (
                        <div className="text-sm text-muted-foreground">
                          Change: ₱{Math.max(0, Number.parseFloat(amountGiven) - (selectedPreparedOrder.items.reduce((sum, item) => sum + item.price * (orderQuantities[item.id] || 0), 0))).toFixed(2)}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* GCash Payment Fields */}
                  {paymentMethod === "gcash" && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="gcash-phone">GCash Phone Number (Optional)</Label>
                        <Input
                          id="gcash-phone"
                          value={gcashPhone}
                          onChange={(e) => handleGcashPhoneChange(e.target.value)}
                          placeholder="09XX-XXX-XXXX (optional)"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="gcash-reference">Reference Number (Optional)</Label>
                        <Input
                          id="gcash-reference"
                          value={gcashReference}
                          onChange={(e) => setGcashReference(e.target.value)}
                          placeholder="Enter reference number (optional)"
                          className="mt-1"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowGcashQrModal(true)}
                        className="w-full"
                      >
                        Share QR
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowOrderModal(false)} className="flex-1">
                Clear
              </Button>
              <Button 
                onClick={convertToOrder} 
                className="flex-1"
                disabled={!customerName.trim() || Object.values(orderQuantities).every(qty => qty === 0)}
              >
                Finalize Order
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* GCash QR Modal */}
      {showGcashQrModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-background rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
            <h3 className="text-xl font-bold mb-4">GCash QR Code</h3>
            <div className="flex flex-col items-center space-y-4">
              <div className="border-2 border-gray-200 rounded-lg p-4 bg-white">
                <img 
                  src="/gcash-qr.png" 
                  alt="GCash QR Code" 
                  className="w-64 h-64 object-contain"
                  onError={(e) => {
                    // Fallback if image doesn't exist
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const fallback = document.createElement('div')
                    fallback.className = 'w-64 h-64 flex items-center justify-center bg-gray-100 rounded-lg'
                    fallback.innerHTML = '<p class="text-gray-500 text-center">QR Code Image Not Found</p>'
                    target.parentNode?.replaceChild(fallback, target)
                  }}
                />
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Scan this QR code with your GCash app to complete the payment
                </p>
                <p className="text-xs text-muted-foreground">
                  Amount: ₱{selectedPreparedOrder?.items.reduce((sum, item) => sum + item.price * (orderQuantities[item.id] || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowGcashQrModal(false)} className="flex-1">
                Close
              </Button>
              <Button onClick={handleGcashPaymentDone} className="flex-1 bg-green-600 hover:bg-green-700">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Clear All Confirmation Dialog */}
      {showClearAllDialog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Clear All Prepared Orders</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to clear all prepared orders? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowClearAllDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  setPreparedOrders([]);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("yellowbell_prepared_orders", JSON.stringify([]));
                  }
                  setShowClearAllDialog(false);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && orderToDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => {}}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Delete Prepared Order</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-6 text-gray-700">
                Are you sure you want to delete this prepared order? This will restore the items to inventory.
              </p>
              <div className="flex justify-end space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setOrderToDelete(null)
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={deletePreparedOrder}
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </POSLayout>
  )
}
