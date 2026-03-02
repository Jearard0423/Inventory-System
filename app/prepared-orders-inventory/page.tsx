"use client"

import { useEffect, useState } from "react"
import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, ShoppingCart, Loader2, TrendingUp, CheckCircle2, PackageCheck, ChefHat } from "lucide-react"
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
  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})
  const [customerNameInput, setCustomerNameInput] = useState("")
  const [selectedMealType, setSelectedMealType] = useState<string>("lunch")
  const [selectedPreparedOrder, setSelectedPreparedOrder] = useState<PreparedOrder | null>(null)
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

  const handleAddToPrepared = () => {
    const itemsToAdd: Array<{ id: string; name: string; quantity: number; price: number }> = []
    Object.entries(selectedItems).forEach(([itemId, quantity]) => {
      if (quantity > 0) {
        const item = inventory.find(i => i.id === itemId)
        if (item) {
          itemsToAdd.push({ id: itemId, name: item.name, quantity, price: item.price })
        }
      }
    })
    if (!itemsToAdd.length) { toast({ title: "No Items Selected", description: "Select at least one item", variant: "destructive" }); return }
    if (!customerNameInput.trim()) { toast({ title: "Customer Name Required", description: "Please enter a customer name", variant: "destructive" }); return }

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
    toast({ title: "Prepared Order Created", description: `${newOrder.orderNumber} for ${customerNameInput}` })
    setSelectedItems({}); setCustomerNameInput(""); setShowAddItemModal(false)
  }

  const handleConvertToOrder = () => {
    if (!selectedPreparedOrder) return
    const items = selectedPreparedOrder.items.filter(i => i.remainingQuantity > 0).map(i => ({ id: i.id, name: i.name, quantity: i.remainingQuantity, price: i.price }))
    if (!items.length) { toast({ title: "No Items to Convert", description: "All items have been sold", variant: "destructive" }); return }
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
      const updated = preparedOrders.map(o => o.id === selectedPreparedOrder.id ? { ...o, status: 'converted' as const } : o)
      setPreparedOrders(updated)
      localStorage.setItem('yellowbell_prepared_orders', JSON.stringify(updated))
      toast({ title: "Order Converted", description: "Converted to actual order successfully" })
      setShowPaymentModal(false); setSelectedPreparedOrder(null)
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Prepared Orders</h1>
            <p className="text-muted-foreground mt-1">Food that's ready and waiting to be served</p>
          </div>
          <Button onClick={() => { setShowAddItemModal(true); setSelectedItems({}); setCustomerNameInput("") }} className="gap-2">
            <Plus className="w-4 h-4" /> New Prepared Order
          </Button>
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

        {/* Active Orders */}
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
                <p className="text-sm text-muted-foreground/60">Create one to get started</p>
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
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-foreground/80">{item.name}</span>
                          <span className="font-semibold">{item.remainingQuantity}/{item.quantity}</span>
                        </div>
                      ))}
                      <div className="pt-1.5 border-t border-border/50 flex justify-between text-sm font-bold">
                        <span>Total</span>
                        <span className="text-primary">₱{order.items.reduce((s, i) => s + i.price * i.remainingQuantity, 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Button className="w-full h-9 text-sm gap-2" onClick={() => { setSelectedPreparedOrder(order); setShowPaymentModal(true) }}>
                        <ShoppingCart className="w-3.5 h-3.5" /> Convert to Order
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
              {inventory.filter(i => !i.isUtensil && !i.isContainer && i.category !== 'raw-stock').map(item => {
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
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Converted</Badge>
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

        {/* Add Modal */}
        <Dialog open={showAddItemModal} onOpenChange={setShowAddItemModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Prepared Order</DialogTitle>
              <DialogDescription>Select items and enter customer info</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Customer Name *</label>
                <Input placeholder="Enter customer name" value={customerNameInput} onChange={e => setCustomerNameInput(e.target.value)} />
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
              <div>
                <label className="text-sm font-medium mb-2 block">Select Items</label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {inventory.filter(i => !i.isUtensil && !i.isContainer && i.category !== 'raw-stock').map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">₱{item.price} · Stock: {item.stock}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedItems(p => ({ ...p, [item.id]: Math.max(0, (p[item.id] || 0) - 1) }))}
                          className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-muted font-bold text-sm">−</button>
                        <span className="w-6 text-center text-sm font-semibold">{selectedItems[item.id] || 0}</span>
                        <button onClick={() => setSelectedItems(p => ({ ...p, [item.id]: (p[item.id] || 0) + 1 }))}
                          className="w-7 h-7 rounded-full border flex items-center justify-center hover:bg-muted font-bold text-sm">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {Object.values(selectedItems).some(q => q > 0) && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm font-semibold mb-1">Selected:</p>
                  {Object.entries(selectedItems).filter(([, q]) => q > 0).map(([id, q]) => {
                    const item = inventory.find(i => i.id === id)
                    return item ? <div key={id} className="flex justify-between text-sm"><span>{item.name}</span><span className="font-medium">{q}x · ₱{(item.price * q).toLocaleString()}</span></div> : null
                  })}
                  <div className="border-t border-border mt-2 pt-2 flex justify-between text-sm font-bold">
                    <span>Total</span>
                    <span className="text-primary">₱{Object.entries(selectedItems).filter(([, q]) => q > 0).reduce((s, [id, q]) => {
                      const item = inventory.find(i => i.id === id); return s + (item ? item.price * q : 0)
                    }, 0).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setShowAddItemModal(false)}>Cancel</Button>
              <Button onClick={handleAddToPrepared}>Create Prepared Order</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment Modal */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Convert to Order</DialogTitle>
              <DialogDescription>Payment for {selectedPreparedOrder?.customerName}</DialogDescription>
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
              <Button onClick={handleConvertToOrder}>Confirm & Convert</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Prepared Order?</DialogTitle>
              <DialogDescription>
                This will delete <strong>{selectedPreparedOrder?.orderNumber}</strong> for <strong>{selectedPreparedOrder?.customerName}</strong> and restore all stock. This cannot be undone.
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