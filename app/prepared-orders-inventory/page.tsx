"use client"

import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Package, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { getOrders } from "@/lib/orders"

interface PreparedInventoryItem {
  id: string
  name: string
  preparedQuantity: number
  soldQuantity: number
  remainingQuantity: number
  percentageSold: number
}

export default function PreparedOrdersInventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<PreparedInventoryItem[]>([])

  useEffect(() => {
    const calculateInventory = () => {
      // Get all orders to calculate sold quantities
      const orders = getOrders()
      
      // Get prepared orders from localStorage
      const preparedOrders = JSON.parse(localStorage.getItem("yellowbell_prepared_orders") || "[]")
      
      // Create a map to track quantities
      const itemMap = new Map<string, { name: string; prepared: number; sold: number }>()
      
      // Calculate prepared quantities from prepared orders
      preparedOrders.forEach((order: any) => {
        if (order.status === "prepared") {
          order.items.forEach((item: any) => {
            const existing = itemMap.get(item.id)
            if (existing) {
              existing.prepared += item.remainingQuantity || item.quantity
            } else {
              itemMap.set(item.id, {
                name: item.name,
                prepared: item.remainingQuantity || item.quantity,
                sold: 0
              })
            }
          })
        }
      })
      
      // Calculate sold quantities from regular orders that came from prepared orders
      orders.forEach((order: any) => {
        if (order.isPreparedOrder) {
          order.items.forEach((item: any) => {
            const existing = itemMap.get(item.id)
            if (existing) {
              existing.sold += item.quantity
            } else {
              // This case shouldn't happen, but handle it gracefully
              itemMap.set(item.id, {
                name: item.name,
                prepared: 0,
                sold: item.quantity
              })
            }
          })
        }
      })
      
      // Convert to array and calculate remaining quantities
      const items: PreparedInventoryItem[] = Array.from(itemMap.entries()).map(([id, data]) => {
        const remaining = Math.max(0, data.prepared - data.sold)
        const percentageSold = data.prepared > 0 ? (data.sold / data.prepared) * 100 : 0
        
        return {
          id,
          name: data.name,
          preparedQuantity: data.prepared,
          soldQuantity: data.sold,
          remainingQuantity: remaining,
          percentageSold
        }
      })
      
      // Sort by remaining quantity (ascending) to show low stock first
      items.sort((a, b) => a.remainingQuantity - b.remainingQuantity)
      
      setInventoryItems(items)
    }

    calculateInventory()
    
    // Listen for updates
    window.addEventListener("orders-updated", calculateInventory)
    window.addEventListener("prepared-orders-updated", calculateInventory)
    
    return () => {
      window.removeEventListener("orders-updated", calculateInventory)
      window.removeEventListener("prepared-orders-updated", calculateInventory)
    }
  }, [])

  const getStatusColor = (remaining: number, prepared: number) => {
    if (remaining === 0) return "bg-red-500"
    if (remaining <= prepared * 0.2) return "bg-orange-500"
    return "bg-green-500"
  }

  const getStatusIcon = (remaining: number, prepared: number) => {
    if (remaining === 0) return <TrendingDown className="w-4 h-4 text-red-500" />
    if (remaining <= prepared * 0.2) return <Minus className="w-4 h-4 text-orange-500" />
    return <TrendingUp className="w-4 h-4 text-green-500" />
  }

  const getStatusText = (remaining: number, prepared: number) => {
    if (remaining === 0) return "Out of Stock"
    if (remaining <= prepared * 0.2) return "Low Stock"
    return "Available"
  }

  return (
    <POSLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Prepared Orders Inventory</h1>
            <p className="text-muted-foreground">Track prepared items vs sold quantities</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Prepared</p>
                  <p className="text-2xl font-bold">
                    {inventoryItems.reduce((sum, item) => sum + item.preparedQuantity, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Sold</p>
                  <p className="text-2xl font-bold">
                    {inventoryItems.reduce((sum, item) => sum + item.soldQuantity, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Remaining</p>
                  <p className="text-2xl font-bold">
                    {inventoryItems.reduce((sum, item) => sum + item.remainingQuantity, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Inventory List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Inventory Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inventoryItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No prepared items found</p>
            ) : (
              <div className="space-y-4">
                {inventoryItems.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{item.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusIcon(item.remainingQuantity, item.preparedQuantity)}
                          <span className="text-sm text-muted-foreground">
                            {getStatusText(item.remainingQuantity, item.preparedQuantity)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-sm">
                            {item.soldQuantity} sold / {item.preparedQuantity} prepared
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.remainingQuantity} remaining
                        </p>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Sold: {item.soldQuantity}</span>
                        <span>Remaining: {item.remainingQuantity}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div className="flex h-full">
                          <div 
                            className="bg-blue-500 transition-all duration-300"
                            style={{ width: `${item.percentageSold}%` }}
                          />
                          <div 
                            className={cn("transition-all duration-300", getStatusColor(item.remainingQuantity, item.preparedQuantity))}
                            style={{ width: `${100 - item.percentageSold}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-600">{item.percentageSold.toFixed(1)}% sold</span>
                        <span className={cn(
                          "font-medium",
                          item.remainingQuantity === 0 ? "text-red-600" : 
                          item.remainingQuantity <= item.preparedQuantity * 0.2 ? "text-orange-600" : 
                          "text-green-600"
                        )}>
                          {((100 - item.percentageSold)).toFixed(1)}% available
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </POSLayout>
  )
}
