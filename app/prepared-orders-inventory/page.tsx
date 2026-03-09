"use client"

import { useEffect, useState } from "react"
import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Trash2, ShoppingCart, Loader2, TrendingUp, CheckCircle2, PackageCheck, ChefHat, Plus } from "lucide-react"
import { getInventoryItems, reduceStock, addCustomerOrder, type InventoryItem, restoreStockForOrder } from "@/lib/inventory-store"
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

  // Cart state — items being staged before saving as a prepared order
  const [cart, setCart] = useState<Record<string, number>>({})

  // Convert modal state
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedPreparedOrder, setSelectedPreparedOrder] = useState<PreparedOrder | null>(null)
  const [customerNameInput, setCustomerNameInput] = useState("")
  const [selectedMealType, setSelectedMealType] = useState<string>("lunch")
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash')
  const [cashAmount, setCashAmount] = useState("")
  const [gcashPhone, setGcashPhone] = useState("")
  const [gcashReference, setGcashReference] = useState("")

  const loadData = () => {
    try {
      setInventory(getInventoryItems())
      const raw = localStorage.getItem('yellowbell_prepared_orders')
      setPreparedOrders(raw ? JSON.parse(raw) : [])
      setIsLoading(false)
    } catch {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    window.addEventListener("inventory-updated", loadData)
    return () => window.removeEventListener("inventory-updated", loadData)
  }, [])

  const foodItems = inventory.filter(i => !i.isUtensil && !i.isContainer && i.category !== 'raw-stock')

  const cartTotal = (Object.entries(cart) as [string, number][]).reduce((sum: number, [id, qty]) => {
    const item = inventory.find(i => i.id === id)
    return sum + (item ? item.price * qty : 0)
  }, 0)

  const cartItemCount: number = (Object.values(cart) as number[]).reduce((s: number, q: number) => s + q, 0)

  const consolidatedInventory = (() => {
    const result: Record<string, { prepared: number; sold: number; remaining: number; price: number }> = {}
    inventory.forEach(item => {
      if (!item.isUtensil && !item.isContainer && item.category !== 'raw-stock') {
        result[item.id] = { prepared: 0, sold: 0, remaining: item.stock, price: item.price }
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
  })()

  const totalPreparedValue = Object.values(consolidatedInventory).reduce((s, i) => s + i.prepared * i.price, 0)
  const totalSoldValue = Object.values(consolidatedInventory).reduce((s, i) => s + i.sold * i.price, 0)
  const activePrepared = preparedOrders.filter(o => o.status === 'prepared')
  const convertedOrders = preparedOrders.filter(o => o.status === 'converted')

  // Save cart as a prepared order (after entering customer name)
  const handleSavePreparedOrder = () => {
    if (!customerNameInput.trim()) {
      toast({ title: "Customer Name Required", description: "Please enter the customer name", variant: "destructive" })
      return
    }
    const itemsToAdd: Array<{ id: string; name: string; quantity: number; price: number }> =
      Object.entries(cart)
        .filter(([, qty]) => (qty as number) > 0)
        .map(([id, qty]) => {
          const item = inventory.find(i => i.id === id)!
          return { id, name: item.name, quantity: qty as number, price: item.price }
        })

    if (!itemsToAdd.length) {
      toast({ title: "Cart is empty", description: "Add at least one item", variant: "destructive" })
      return
    }

    const newOrder: PreparedOrder = {
      id: Math.random().toString(36).substr(2, 9),
      orderNumber: `PRE-${Math.floor(Math.random() * 9000) + 1000}`,
      customerName: customerNameInput,
      mealType: selectedMealType,
      items: itemsToAdd.map(i => ({ ...i, remainingQuantity: i.quantity })),
      status: 'prepared',
      createdAt: new Date().toISOString()
    }

    itemsToAdd.forEach(i => reduceStock(i.id, i.quantity))
    const updated = [...preparedOrders, newOrder]
    setPreparedOrders(updated)
    localStorage.setItem('yellowbell_prepared_orders', JSON.stringify(updated))
    toast({ title: "Prepared Order Saved", description: `${newOrder.orderNumber} for ${customerNameInput}` })
    setCart({})
    setCustomerNameInput("")
    setShowConvertModal(false)
  }

  const handleAdjustQuantity = (orderId: string, itemId: string, delta: number) => {
    const updated = preparedOrders.map(order => {
      if (order.id !== orderId) return order
      return {
        ...order,
        items: order.items.map(item => {
          if (item.id !== itemId) return item
          const newQty = Math.max(0, Math.min(item.quantity, item.remainingQuantity + delta))
          return { ...item, remainingQuantity: newQty }
        })
      }
    })
    setPreparedOrders(updated)
    localStorage.setItem('yellowbell_prepared_orders', JSON.stringify(updated))
  }

  const handleConvertToOrder = () => {
    if (!selectedPreparedOrder) return
    const items = selectedPreparedOrder.items
      .filter(i => i.remainingQuantity > 0)
      .map(i => ({ id: i.id, name: i.name, quantity: i.remainingQuantity, price: i.price }))
    if (!items.length) {
      toast({ title: "No Items to Convert", description: "All items have been handed out", variant: "destructive" })
      return
    }
    try {
      const newOrder: any = {
        customerName: selectedPreparedOrder.customerName,
        items,
        mealType: selectedPreparedOrder.mealType,
        paymentStatus: 'paid',
        paymentMethod,
        total: items.reduce((s: number, i: any) => s + i.price * i.quantity, 0),
        ...(paymentMethod === 'gcash' ? { gcashPhone, gcashReference } : {})
      }
      addCustomerOrder(newOrder)
      const updated = preparedOrders.map(o =>
        o.id === selectedPreparedOrder.id ? { ...o, status: 'converted' as const } : o
      )
      setPreparedOrders(updated)
      localStorage.setItem('yellowbell_prepared_orders', JSON.stringify(updated))
      toast({ title: "Order Converted", description: "Handed out successfully" })
      setShowPaymentModal(false)
      setSelectedPreparedOrder(null)
      setPaymentMethod('cash'); setCashAmount(""); setGcashPhone(""); setGcashReference("")
      loadData()
    } catch {
      toast({ title: "Error", description: "Failed to convert order", variant: "destructive" })
    }
  }

  const handleDelete = (order: PreparedOrder) => {
    order.items.forEach(item => {
      if (inventory.find(i => i.id === item.id)) {
        restoreStockForOrder({ items: [{ id: item.id, name: item.name, quantity: item.quantity }] })
      }
    })
    const updated = preparedOrders.filter(o => o.id !== order.id)
    setPreparedOrders(updated)
    localStorage.setItem('yellowbell_prepared_orders', JSON.stringify(updated))
    toast({ title: "Deleted", description: "Stock has been restored" })
    setShowDeleteConfirm(false); setSelectedPreparedOrder(null)
  }

  if (isLoading) return (
    <POSLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></POSLayout>
  )

  return (
    <POSLayout>
      <div className="space-y-6 pb-20">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prepared Orders</h1>
          <p className="text-muted-foreground mt-1">Tap + on any meal to stage it, then save with a customer name</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm bg-primary text-primary-foreground">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary-foreground/70 text-sm font-medium">Ready to Serve</p>
                  <p className="text-4xl font-bold mt-1">{activePrepared.length}</p>
                </div>
                <PackageCheck className="w-10 h-10 text-primary-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Prepared Value</p>
                  <p className="text-3xl font-bold mt-1">₱{totalPreparedValue.toLocaleString()}</p>
                </div>
                <TrendingUp className="w-10 h-10 text-muted-foreground/20" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Sold Value</p>
                  <p className="text-3xl font-bold mt-1 text-green-600">₱{totalSoldValue.toLocaleString()}</p>
                </div>
                <CheckCircle2 className="w-10 h-10 text-green-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Meal Tiles with +/- ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Add to Prepared</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {foodItems.map(item => {
              const qty = cart[item.id] || 0
              return (
                <Card key={item.id} className={cn("border-0 shadow-sm transition-all", qty > 0 ? "ring-2 ring-primary" : "")}>
                  <CardContent className="p-4">
                    <p className="font-semibold text-sm leading-tight mb-1">{item.name}</p>
                    <p className="text-xs text-muted-foreground mb-3">₱{item.price.toLocaleString()}</p>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setCart(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] || 0) - 1) }))}
                        disabled={qty === 0}
                        className="w-8 h-8 rounded-full border-2 border-border flex items-center justify-center font-bold text-lg hover:bg-muted disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                      >−</button>
                      <span className={cn("font-bold text-lg w-8 text-center", qty > 0 ? "text-primary" : "text-muted-foreground")}>
                        {qty}
                      </span>
                      <button
                        onClick={() => setCart(p => ({ ...p, [item.id]: (p[item.id] || 0) + 1 }))}
                        className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg hover:bg-primary/90 transition-colors"
                      >+</button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Cart summary + Save button */}
          {cartItemCount > 0 && (
            <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">
                  {cartItemCount} item{cartItemCount !== 1 ? 's' : ''} staged
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(Object.entries(cart) as [string, number][]).filter(([, q]) => q > 0).map(([id, q]) => {
                    const item = inventory.find(i => i.id === id)
                    return item ? (
                      <span key={id} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {q}× {item.name}
                      </span>
                    ) : null
                  })}
                </div>
                <p className="text-sm font-bold mt-1 text-primary">Total: ₱{cartTotal.toLocaleString()}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setCart({})}>Clear</Button>
                <Button size="sm" className="gap-2" onClick={() => setShowConvertModal(true)}>
                  <ShoppingCart className="w-4 h-4" /> Save Order
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Active Prepared Orders ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <ChefHat className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Ready to Serve</h2>
            {activePrepared.length > 0 && <Badge>{activePrepared.length}</Badge>}
          </div>
          {activePrepared.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-2">
                <PackageCheck className="w-12 h-12 text-muted-foreground/30" />
                <p className="font-medium text-muted-foreground">No prepared orders yet</p>
                <p className="text-sm text-muted-foreground/60">Use the tiles above to stage items</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePrepared.map(order => (
                <Card key={order.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.orderNumber}</p>
                      </div>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Ready</Badge>
                    </div>
                    {order.mealType && <Badge variant="secondary" className="text-xs mb-3 capitalize">{order.mealType}</Badge>}
                    <div className="bg-muted/50 rounded-lg p-3 space-y-2 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm gap-2">
                          <span className="text-foreground/80 flex-1 truncate">{item.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleAdjustQuantity(order.id, item.id, -1)}
                              disabled={item.remainingQuantity === 0}
                              className="w-6 h-6 rounded-full border border-border flex items-center justify-center font-bold hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                            >−</button>
                            <span className="font-semibold w-10 text-center text-xs">{item.remainingQuantity}/{item.quantity}</span>
                            <button
                              onClick={() => handleAdjustQuantity(order.id, item.id, 1)}
                              disabled={item.remainingQuantity === item.quantity}
                              className="w-6 h-6 rounded-full border border-border flex items-center justify-center font-bold hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                            >+</button>
                          </div>
                        </div>
                      ))}
                      <div className="pt-1.5 border-t border-border/50 flex justify-between text-sm font-bold">
                        <span>Total</span>
                        <span className="text-primary">₱{order.items.reduce((s, i) => s + i.price * i.remainingQuantity, 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Button className="w-full h-9 text-sm gap-2" onClick={() => { setSelectedPreparedOrder(order); setShowPaymentModal(true) }}>
                        <ShoppingCart className="w-3.5 h-3.5" /> Hand Out
                      </Button>
                      <Button variant="outline" className="w-full h-9 text-sm text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                        onClick={() => { setSelectedPreparedOrder(order); setShowDeleteConfirm(true) }}>
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Inventory Summary */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Inventory Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {foodItems.map(item => {
                const c = consolidatedInventory[item.id]
                if (!c) return null
                const pct = c.prepared > 0 ? (c.sold / c.prepared) * 100 : 0
                const stockColor = c.remaining <= 2 ? 'text-red-600' : c.remaining <= 5 ? 'text-amber-600' : 'text-green-600'
                return (
                  <div key={item.id} className="bg-muted/40 rounded-lg p-3 space-y-2">
                    <p className="font-semibold text-sm">{item.name}</p>
                    <div className="grid grid-cols-3 gap-1 text-xs text-center">
                      <div><p className="text-muted-foreground">Prepared</p><p className="font-bold text-base">{c.prepared}</p></div>
                      <div><p className="text-muted-foreground">Sold</p><p className="font-bold text-base text-primary">{c.sold}</p></div>
                      <div><p className="text-muted-foreground">Stock</p><p className={cn("font-bold text-base", stockColor)}>{c.remaining}</p></div>
                    </div>
                    {c.prepared > 0 && (
                      <div className="w-full bg-border rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Converted Orders */}
        {convertedOrders.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold">Converted Orders</h2>
              <Badge variant="secondary">{convertedOrders.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {convertedOrders.map(order => (
                <Card key={order.id} className="border-0 shadow-sm opacity-60">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-start justify-between mb-3">
                      <div><p className="font-bold">{order.customerName}</p><p className="text-xs text-muted-foreground">{order.orderNumber}</p></div>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Done</Badge>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-foreground/70">{item.name}</span>
                          <span className="text-muted-foreground">{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ── Save Order Modal (customer name + meal type) ── */}
        <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Save Prepared Order</DialogTitle>
              <DialogDescription>Enter customer details to save this prepared order</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Customer Name *</label>
                <Input
                  placeholder="Enter customer name"
                  value={customerNameInput}
                  onChange={e => setCustomerNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSavePreparedOrder()}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Meal Type</label>
                <div className="flex gap-2 flex-wrap">
                  {['breakfast', 'lunch', 'dinner', 'other'].map(mt => (
                    <button key={mt} onClick={() => setSelectedMealType(mt)}
                      className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize",
                        selectedMealType === mt ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>
                      {mt}
                    </button>
                  ))}
                </div>
              </div>
              {/* Order summary */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                {(Object.entries(cart) as [string, number][]).filter(([, q]) => q > 0).map(([id, q]) => {
                  const item = inventory.find(i => i.id === id)
                  return item ? (
                    <div key={id} className="flex justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium">{q}× · ₱{(item.price * q).toLocaleString()}</span>
                    </div>
                  ) : null
                })}
                <div className="border-t border-border pt-1.5 flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span className="text-primary">₱{cartTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setShowConvertModal(false)}>Cancel</Button>
              <Button onClick={handleSavePreparedOrder}>Save Order</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Hand Out / Payment Modal */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Hand Out Order</DialogTitle>
              <DialogDescription>Payment method for {selectedPreparedOrder?.customerName}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {(['cash', 'gcash'] as const).map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={cn("p-4 rounded-xl border-2 text-center transition-colors",
                      paymentMethod === m ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}>
                    <p className="text-2xl mb-1">{m === 'cash' ? '💵' : '📱'}</p>
                    <p className="font-semibold text-sm capitalize">{m}</p>
                  </button>
                ))}
              </div>
              {paymentMethod === 'cash' && (
                <div><label className="text-sm font-medium mb-1 block">Amount Received</label>
                  <Input placeholder="₱0.00" value={cashAmount} onChange={e => setCashAmount(e.target.value)} /></div>
              )}
              {paymentMethod === 'gcash' && (
                <div className="space-y-2">
                  <div><label className="text-sm font-medium mb-1 block">GCash Phone</label>
                    <Input placeholder="09XX-XXX-XXXX" value={gcashPhone} onChange={e => setGcashPhone(e.target.value)} /></div>
                  <div><label className="text-sm font-medium mb-1 block">Reference Number</label>
                    <Input placeholder="Reference #" value={gcashReference} onChange={e => setGcashReference(e.target.value)} /></div>
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
              <Button onClick={handleConvertToOrder}>Confirm Hand Out</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Prepared Order?</DialogTitle>
              <DialogDescription>
                This will delete <strong>{selectedPreparedOrder?.orderNumber}</strong> for <strong>{selectedPreparedOrder?.customerName}</strong> and restore all stock.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => selectedPreparedOrder && handleDelete(selectedPreparedOrder)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </POSLayout>
  )
}