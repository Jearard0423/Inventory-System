"use client"

import { Bell, AlertCircle, AlertTriangle } from "lucide-react"
import { useEffect, useState } from "react"
import { getNotifications, markAsRead, markAllAsRead, type Notification } from "@/lib/notifications-store"
import { getLowStockItems, getInventoryItems } from "@/lib/inventory-store"
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
  const [outOfStockItems, setOutOfStockItems] = useState<{name: string, stock: number}[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const updateNotifications = () => {
    setNotifications(getNotifications())
  }

  useEffect(() => {
    updateNotifications()
    window.addEventListener('notifications-updated', updateNotifications)
    
    // Check for out of stock items
    const checkStock = () => {
      const inventory = getInventoryItems()
      const outOfStock = inventory.filter(item => item.status === 'out-of-stock')
      setOutOfStockItems(outOfStock.map(item => ({
        name: item.name,
        stock: item.stock
      })))
      setIsLoading(false)
    }
    
    checkStock()
    
    // Check stock every 30 seconds
    const interval = setInterval(checkStock, 30000)
    
    return () => {
      window.removeEventListener('notifications-updated', updateNotifications)
      clearInterval(interval)
    }
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id)
    // Add any additional click handling here
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead()
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
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white ring-2 ring-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" side="top">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Notifications</h3>
            {outOfStockItems.length > 0 && (
              <span className="flex h-5 items-center rounded-full bg-red-100 px-2 text-xs font-medium text-red-800">
                {outOfStockItems.length} out of stock
              </span>
            )}
          </div>
          {notifications.some(n => !n.read) && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs"
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <>
            {outOfStockItems.length > 0 && (
              <div className="border-b p-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  Out of Stock Items
                </h4>
                <div className="space-y-2">
                  {outOfStockItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between rounded bg-red-50 p-2 text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        {item.stock} left
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {notifications.length === 0 && outOfStockItems.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : notifications.length > 0 ? (
          <ScrollArea className="h-64">
            <div className="divide-y">
              {notifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={cn(
                    "cursor-pointer px-4 py-3 hover:bg-accent",
                    !notification.read && "bg-accent/50"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <AlertCircle className={cn(
                        "h-4 w-4 shrink-0",
                        notification.priority === 'high' ? 'text-red-500' : 
                        notification.priority === 'medium' ? 'text-amber-500' : 'text-blue-500'
                      )} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">{notification.title}</h4>
                        <span className="text-xs text-muted-foreground">
                          {new Date(notification.timestamp).toLocaleTimeString([], { hour: '2-digit', 'minute': '2-digit' })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
