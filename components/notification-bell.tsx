"use client"

import { Bell, AlertCircle, AlertTriangle, ShoppingCart, Package, Truck, ExternalLink } from "lucide-react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getNotifications, markAsRead, markAllAsRead, type Notification } from "@/lib/notifications-store"
import { getInventoryItems } from "@/lib/inventory-store"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [outOfStockItems, setOutOfStockItems] = useState<{ name: string; stock: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selected, setSelected] = useState<Notification | null>(null)
  const router = useRouter()

  const updateNotifications = () => setNotifications(getNotifications())

  useEffect(() => {
    updateNotifications()
    window.addEventListener("notifications-updated", updateNotifications)
    const checkStock = () => {
      const inventory = getInventoryItems()
      setOutOfStockItems(
        inventory.filter(i => i.status === "out-of-stock").map(i => ({ name: i.name, stock: i.stock }))
      )
      setIsLoading(false)
    }
    checkStock()
    const interval = setInterval(checkStock, 30000)
    window.addEventListener("firebase-inventory-updated", checkStock)
    window.addEventListener("inventory-updated", checkStock)
    return () => {
      window.removeEventListener("notifications-updated", updateNotifications)
      window.removeEventListener("firebase-inventory-updated", checkStock)
      window.removeEventListener("inventory-updated", checkStock)
      clearInterval(interval)
    }
  }, [])

  // Close detail view when popover closes
  useEffect(() => { if (!isOpen) setSelected(null) }, [isOpen])

  const unreadCount = notifications.filter(n => !n.read).length
  const totalBadgeCount = unreadCount + outOfStockItems.length

  const getIcon = (type: string, priority: string, read: boolean) => {
    const color = read ? "text-muted-foreground" :
      priority === "high" ? "text-red-500" :
      priority === "medium" ? "text-amber-500" : "text-blue-500"
    const cls = cn("h-4 w-4 shrink-0", color)
    if (type === "order") return <ShoppingCart className={cls} />
    if (type === "delivery") return <Truck className={cls} />
    if (type === "inventory") return <Package className={cls} />
    return <AlertCircle className={cls} />
  }

  const handleNotifClick = (notif: Notification) => {
    markAsRead(notif.id)
    setSelected(notif)
  }

  const handleViewAll = () => {
    setIsOpen(false)
    router.push("/notifications")
  }

  const handleNavigateToOrder = (notif: Notification) => {
    setIsOpen(false)
    if (notif.data?.id) {
      router.push(`/orders?orderId=${notif.data.id}`)
    } else {
      router.push("/notifications")
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-12 w-12 rounded-full bg-white shadow-lg hover:bg-gray-50"
          suppressHydrationWarning
        >
          <Bell className="h-6 w-6 text-amber-600" />
          {totalBadgeCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white ring-2 ring-white">
              {totalBadgeCount > 99 ? "99+" : totalBadgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(360px,calc(100vw-16px))] p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-1 border-b px-3 py-2.5">
          <div className="flex items-center gap-2">
            {selected ? (
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                ← Back
              </button>
            ) : (
              <h3 className="text-sm font-semibold">Notifications</h3>
            )}
            {!selected && outOfStockItems.length > 0 && (
              <span className="flex h-5 items-center rounded-full bg-red-100 px-2 text-xs font-medium text-red-800 whitespace-nowrap">
                {outOfStockItems.length} out of stock
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!selected && notifications.some(n => !n.read) && (
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2 shrink-0" onClick={() => markAllAsRead()}>
                Mark all read
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2 shrink-0 text-primary" onClick={handleViewAll}>
              View all
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : selected ? (
          /* ── Detail View ── */
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{getIcon(selected.type, selected.priority, false)}</div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm leading-tight">{selected.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(selected.timestamp).toLocaleString("en-PH", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true
                  })}
                </p>
              </div>
              <span className={cn(
                "text-xs rounded-full px-2 py-0.5 shrink-0",
                selected.priority === "high" ? "bg-red-100 text-red-700" :
                selected.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
              )}>
                {selected.priority}
              </span>
            </div>

            <p className="text-sm text-foreground leading-relaxed border-t pt-3">{selected.message}</p>

            {selected.data && Object.keys(selected.data).length > 0 && (
              <div className="bg-muted/40 rounded-lg p-3 space-y-1 text-xs">
                {selected.data.customerName && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{selected.data.customerName}</span></div>
                )}
                {selected.data.orderNumber && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Order #</span><span className="font-medium">{selected.data.orderNumber}</span></div>
                )}
                {selected.data.total && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-medium text-primary">₱{Number(selected.data.total).toFixed(2)}</span></div>
                )}
                {selected.data.mealType && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Meal</span><span className="font-medium capitalize">{selected.data.mealType}</span></div>
                )}
              </div>
            )}

            <Button
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={() => handleNavigateToOrder(selected)}
            >
              <ExternalLink className="h-3 w-3" />
              {selected.data?.id ? "View Order" : "Go to Notifications"}
            </Button>
          </div>
        ) : (
          /* ── List View ── */
          <>
            {outOfStockItems.length > 0 && (
              <div className="border-b px-3 py-2.5">
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5" /> Out of Stock
                </h4>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {outOfStockItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between rounded bg-red-50 px-2 py-1 text-xs">
                      <span className="font-medium truncate pr-2">{item.name}</span>
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 font-medium text-red-800 shrink-0">{item.stock} left</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notifications.length === 0 && outOfStockItems.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">No notifications</div>
            ) : notifications.length > 0 ? (
              <ScrollArea className="h-[min(300px,55vh)]">
                <div className="divide-y">
                  {notifications.slice(0, 20).map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        "cursor-pointer px-3 py-2.5 hover:bg-accent transition-colors",
                        !notif.read && "bg-accent/60"
                      )}
                      onClick={() => handleNotifClick(notif)}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 shrink-0">{getIcon(notif.type, notif.priority, notif.read)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className={cn("text-xs font-semibold truncate", !notif.read ? "text-foreground" : "text-muted-foreground")}>
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {new Date(notif.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{notif.message}</p>
                        </div>
                        {!notif.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : null}

            {notifications.length > 0 && (
              <div className="border-t px-3 py-2">
                <button onClick={handleViewAll} className="text-xs text-primary hover:underline w-full text-center">
                  View all {notifications.length} notifications →
                </button>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}