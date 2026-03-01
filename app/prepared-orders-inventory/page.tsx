"use client"

import { useEffect, useState } from "react"
import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, AlertCircle, ShoppingCart, Loader2, QrCode, X, TrendingUp } from "lucide-react"
import { getInventoryItems, getCustomerOrders, reduceStock, addCustomerOrder, canOrderItem, getOrderLimitMessage, type InventoryItem, type CustomerOrder, type OrderItem, restoreStockForOrder } from "@/lib/inventory-store"
import { cn } from "@/lib/utils"

interface PreparedOrder {
  id: string
  orderNumber: string
  customerName: string
  mealType?: string
  items: Array<{
    id: string
    name: string
    quantity: number
    remainingQuantity: number
    price: number
  }>
  status: 'prepared' | 'converted'
  createdAt: string
}

export default function PreparedOrdersInventoryPage() {
  const { toast } = useToast()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [preparedOrders, setPreparedOrders] = useState<PreparedOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Modal states
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showGcashModal, setShowGcashModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Form states
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [customerNameInput, setCustomerNameInput] = useState("")
  const [selectedMealType, setSelectedMealType] = useState<string>("lunch")
  const [selectedPreparedOrder, setSelectedPreparedOrder] = useState<PreparedOrder | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash')
  const [cashAmount, setCashAmount] = useState("")
  const [gcashPhone, setGcashPhone] = useState("")
  const [gcashReference, setGcashReference] = useState("")

  // Load data
  const loadData = () => {
    try {
      const invItems = getInventoryItems()
      setInventory(invItems)
      
      // Load prepared orders from localStorage
      const raw = localStorage.getItem('yellowbell_prepared_orders')
      setPreparedOrders(raw ? JSON.parse(raw) : [])
      
      setIsLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive"
      })
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    
    // Event listeners
    const handleUpdate = () => {
      loadData()
    }
    
    window.addEventListener("inventory-updated", handleUpdate)
    return () => window.removeEventListener("inventory-updated", handleUpdate)
  }, [])

  // Calculate consolidated inventory
  const calculateConsolidatedInventory = () => {
    const result: Record<string, { prepared: number; sold: number; remaining: number; price: number }> = {}
    
    inventory.forEach(item => {
      if (!item.isUtensil && !item.isContainer && item.category !== 'raw-stock') {
        result[item.id] = {
          prepared: 0,
          sold: 0,
          remaining: item.stock,
          price: item.price
        }
      }
    })

    preparedOrders.forEach(order => {
      if (order.status === 'prepared') {
        order.items.forEach(item => {
          if (result[item.id]) {
            result[item.id].prepared += item.quantity
            result[item.id].sold += item.quantity - item.remainingQuantity
          }
        })
      }
    })

    return result
  }

  const consolidatedInventory = calculateConsolidatedInventory()
  const totalPreparedValue = Object.values(consolidatedInventory).reduce((sum, item) => sum + (item.prepared * item.price), 0)
  const totalSoldValue = Object.values(consolidatedInventory).reduce((sum, item) => sum + (item.sold * item.price), 0)

  // Handle adding items to prepare
  const handleAddToPrepared = () => {
    const itemsToAdd: OrderItem[] = []
    let totalPrice = 0

    Object.entries(selectedItems).forEach(([itemId, quantity]) => {
      if (quantity > 0) {
        const item = inventory.find(i => i.id === itemId)
        if (item) {
          const canOrder = canOrderItem(itemId, quantity)
          if (!canOrder) {
            const message = getOrderLimitMessage(itemId, quantity)
            toast({
              title: "Cannot Add Item",
              description: message || "Insufficient stock",
              variant: "destructive"
            })
            return
          }
          itemsToAdd.push({
            id: itemId,
            name: item.name,
            quantity: quantity,
            price: item.price
          })
          totalPrice += item.price * quantity
        }
      }
    })

    if (itemsToAdd.length === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select at least one item to prepare",
        variant: "destructive"
      })
      return
    }

    if (!customerNameInput.trim()) {
      toast({
        title: "Customer Name Required",
        description: "Please enter a customer name",
        variant: "destructive"
      })
      return
    }

    // Create prepared order
    const newPreparedOrder: PreparedOrder = {
      id: Math.random().toString(36).substr(2, 9),
      orderNumber: `PRE-${Math.floor(Math.random() * 9000) + 1000}`,
      customerName: customerNameInput,
      mealType: selectedMealType,
      items: itemsToAdd.map(item => ({
        ...item,
        remainingQuantity: item.quantity
      })),
      status: 'prepared',
      createdAt: new Date().toISOString()
    }

    // Reduce stock
    itemsToAdd.forEach(item => {
      reduceStock(item.id, item.quantity)
    })

    // Save prepared order
    const updated = [...preparedOrders, newPreparedOrder]
    setPreparedOrders(updated)
    localStorage.setItem('yellowbell_prepared_orders', JSON.stringify(updated))

    toast({
      title: "Prepared Order Created",
      description: `Order ${newPreparedOrder.orderNumber} for ${customerNameInput}`,
      variant: "default"
    })

    // Reset form
    setSelectedItems({})
    setCustomerNameInput("")
    setShowAddItemModal(false)
  }

  // Handle converting prepared order to actual order
  const handleConvertToOrder = () => {
    if (!selectedPreparedOrder) return

    const newOrder: any = {
      customerName: selectedPreparedOrder.customerName,
      items: selectedPreparedOrder.items.filter(item => item.remainingQuantity > 0).map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.remainingQuantity,
        price: item.price
      })),
      mealType: selectedPreparedOrder.mealType,
      paymentStatus: 'paid'
    }

    if (paymentMethod === 'gcash') {
      newOrder.paymentMethod = 'gcash'
      newOrder.gcashPhone = gcashPhone
      newOrder.gcashReference = gcashReference
    } else {
      newOrder.paymentMethod = 'cash'
    }

    if (newOrder.items.length === 0) {
      toast({
        title: "No Items to Convert",
        description: "All items in this prepared order have been sold",
        variant: "destructive"
      })
      return
    }

    try {
      // Calculate total
      newOrder.total = newOrder.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)

      // Add as actual order
      addCustomerOrder(newOrder)

      // Update prepared order status
      const updated = preparedOrders.map(o =>
        o.id === selectedPreparedOrder.id ? { ...o, status: 'converted' as const } : o
      )
      setPreparedOrders(updated)
      localStorage.setItem('yellowbell_prepared_orders', JSON.stringify(updated))

      toast({
        title: "Order Converted",
        description: `Converted to actual order successfully`,
        variant: "default"
      })

      // Reset form
      setShowPaymentModal(false)
      setShowGcashModal(false)
      setSelectedPreparedOrder(null)
      setPaymentMethod('cash')
      setCashAmount("")
      setGcashPhone("")
      setGcashReference("")

      // Reload data
      loadData()
    } catch (error) {
      console.error('Error converting order:', error)
      toast({
        title: "Error",
        description: "Failed to convert order",
        variant: "destructive"
      })
    }
  }

  // Handle deleting prepared order
  const handleDeletePreparedOrder = (order: PreparedOrder) => {
    // Restore stock
    order.items.forEach(item => {
      const invItem = inventory.find(i => i.id === item.id)
      if (invItem) {
        restoreStockForOrder({
          items: [{ id: item.id, name: item.name, quantity: item.quantity }]
        })
      }
    })

    // Remove prepared order
    const updated = preparedOrders.filter(o => o.id !== order.id)
    setPreparedOrders(updated)
    localStorage.setItem('yellowbell_prepared_orders', JSON.stringify(updated))

    toast({
      title: "Prepared Order Deleted",
      description: `Stock has been restored`,
      variant: "default"
    })

    setShowDeleteConfirm(false)
    setSelectedPreparedOrder(null)
  }

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-purple-600" />
            <h1 className="text-3xl font-bold">Prepared Orders Inventory</h1>
          </div>
          <Button
            onClick={() => {
              setShowAddItemModal(true)
              setSelectedItems({})
              setCustomerNameInput("")
            }}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Prepared Order
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-1">Prepared Orders</p>
              <p className="text-2xl font-bold">{preparedOrders.filter(o => o.status === 'prepared').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-1">Total Prepared Value</p>
              <p className="text-2xl font-bold">₱{totalPreparedValue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-1">Total Sold Value</p>
              <p className="text-2xl font-bold">₱{totalSoldValue.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Consolidated Inventory Summary */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Inventory Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inventory.filter(item => !item.isUtensil && !item.isContainer && item.category !== 'raw-stock').map(item => {
                const consolidated = consolidatedInventory[item.id]
                if (!consolidated) return null

                const progressPercent = consolidated.prepared > 0 ? (consolidated.sold / consolidated.prepared) * 100 : 0

                return (
                  <div key={item.id} className="bg-white p-3 rounded-lg border border-purple-100">
                    <p className="font-medium text-sm mb-2">{item.name}</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Prepared:</span>
                        <span className="font-semibold">{consolidated.prepared}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sold:</span>
                        <span className="font-semibold">{consolidated.sold}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Stock:</span>
                        <span className="font-semibold">{consolidated.remaining}</span>
                      </div>
                      {consolidated.prepared > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                          <div
                            className="bg-purple-600 h-1.5 rounded-full"
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Prepared Orders List */}
        {preparedOrders.length === 0 ? (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-blue-600">
                <AlertCircle className="w-5 h-5" />
                <span>No prepared orders yet</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {preparedOrders.map(order => (
              <Card key={order.id} className={cn(order.status === 'converted' ? 'opacity-50' : '')}>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{order.customerName}</p>
                        <p className="text-sm text-gray-600">Order #{order.orderNumber}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={order.status === 'converted' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}
                      >
                        {order.status === 'converted' ? 'Converted' : 'Prepared'}
                      </Badge>
                    </div>

                    <div className="bg-gray-50 p-2 rounded space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{item.name}</span>
                          <span className="text-gray-600">
                            {item.remainingQuantity}/{item.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    {order.status === 'prepared' && (
                      <Button
                        onClick={() => {
                          setSelectedPreparedOrder(order)
                          setShowPaymentModal(true)
                        }}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        Convert to Order
                      </Button>
                    )}

                    {order.status === 'prepared' && (
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setSelectedPreparedOrder(order)
                          setShowDeleteConfirm(true)
                        }}
                        className="w-full"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Prepared Order Modal */}
        <Dialog open={showAddItemModal} onOpenChange={setShowAddItemModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Prepared Order</DialogTitle>
              <DialogDescription>
                Select items to prepare and enter customer information
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Customer Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Customer Name *</label>
                <Input
                  placeholder="Enter customer name"
                  value={customerNameInput}
                  onChange={(e) => setCustomerNameInput(e.target.value)}
                />
              </div>

              {/* Meal Type */}
              <div>
                <label className="block text-sm font-medium mb-1">Meal Type</label>
                <select
                  value={selectedMealType}
                  onChange={(e) => setSelectedMealType(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Items Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">Items to Prepare</label>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {inventory.filter(item => !item.isUtensil && !item.isContainer && item.category !== 'raw-stock').map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-gray-600">₱{item.price} • Stock: {item.stock}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          value={selectedItems[item.id] || 0}
                          onChange={(e) => {
                            const qty = parseInt(e.target.value) || 0
                            setSelectedItems(prev => ({
                              ...prev,
                              [item.id]: qty
                            }))
                          }}
                          className="w-16 border rounded px-2 py-1 text-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddItemModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddToPrepared}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Create Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Method Modal*/}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Payment Method</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Payment Method</label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="payment"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'gcash')}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Cash</span>
                  </label>
                  <label className="flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="payment"
                      value="gcash"
                      checked={paymentMethod === 'gcash'}
                      onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'gcash')}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">GCash</span>
                  </label>
                </div>
              </div>

              {paymentMethod === 'cash' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Cash Amount Received (Optional)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowPaymentModal(false)}
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  if (paymentMethod === 'gcash') {
                    setShowPaymentModal(false)
                    setShowGcashModal(true)
                  } else {
                    handleConvertToOrder()
                  }
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* GCash Modal */}
        <Dialog open={showGcashModal} onOpenChange={setShowGcashModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                GCash Payment
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-600 mb-2">Scan QR Code</p>
                <div className="bg-white p-4 rounded border-2 border-blue-200">
                  <QrCode className="w-32 h-32 mx-auto text-blue-600" />
                </div>
                <p className="text-xs text-gray-500 mt-2">GCash QR Code Reference</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone Number</label>
                <Input
                  placeholder="+63 9XX XXX XXXX"
                  value={gcashPhone}
                  onChange={(e) => setGcashPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reference Number</label>
                <Input
                  placeholder="Enter GCash reference number"
                  value={gcashReference}
                  onChange={(e) => setGcashReference(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowGcashModal(false)
                  setShowPaymentModal(true)
                }}
              >
                Back
              </Button>
              <Button
                onClick={handleConvertToOrder}
                className="bg-green-600 hover:bg-green-700"
              >
                Confirm Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Prepared Order?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete the prepared order and restore all stock. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedPreparedOrder) {
                    handleDeletePreparedOrder(selectedPreparedOrder)
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </POSLayout>
  )
}
