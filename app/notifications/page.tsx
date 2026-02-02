"use client"

import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bell, CheckCheck, Clock, Trash2, Package, ShoppingCart, Truck, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Pagination } from "@/components/pagination"
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  type Notification,
} from "@/lib/notifications-store"
import { formatDistanceToNow } from "date-fns"

const tabs = ["All", "Unread", "Orders", "Inventory"]

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState("All")
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    const loadNotifications = () => {
      setNotifications(getNotifications())
    }

    loadNotifications()
    window.addEventListener("notifications-updated", loadNotifications)
    return () => window.removeEventListener("notifications-updated", loadNotifications)
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  const filteredNotifications = notifications.filter((notif) => {
    if (activeTab === "Unread") return !notif.read
    if (activeTab === "Orders") return notif.type === "order" || notif.type === "delivery"
    if (activeTab === "Inventory") return notif.type === "inventory"
    return true
  })

  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage)
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleMarkAsRead = (id: string) => {
    markAsRead(id)
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead()
  }

  const handleDelete = (id: string) => {
    deleteNotification(id)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "order":
        return <ShoppingCart className="h-5 w-5" />
      case "inventory":
        return <Package className="h-5 w-5" />
      case "delivery":
        return <Truck className="h-5 w-5" />
      default:
        return <Bell className="h-5 w-5" />
    }
  }

  const getPriorityColor = (priority: string, read: boolean) => {
    if (read) return "text-muted-foreground"
    switch (priority) {
      case "high":
        return "text-red-500"
      case "medium":
        return "text-yellow-600"
      default:
        return "text-primary"
    }
  }

  return (
    <POSLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Notifications</h1>
            <p className="text-muted-foreground mt-1">Stay updated with your business activities</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All as Read
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveTab(tab)}
                  className={cn(activeTab === tab && "bg-primary")}
                >
                  {tab}
                  {tab === "Unread" && notifications.filter((n) => !n.read).length > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                      {notifications.filter((n) => !n.read).length}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {filteredNotifications.length === 0 ? (
              <div className="text-center py-16">
                <Bell className="h-20 w-20 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No notifications yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  You&apos;re all caught up! Notifications about orders, inventory updates, and system alerts will
                  appear here.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {paginatedNotifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        "flex items-start gap-4 p-4 rounded-lg border transition-colors group",
                        !notif.read ? "bg-primary/5 border-primary/20 cursor-pointer hover:bg-primary/10" : "bg-background hover:bg-muted/50",
                      )}
                      onClick={() => !notif.read && handleMarkAsRead(notif.id)}
                    >
                      <div className={cn("mt-1", getPriorityColor(notif.priority, notif.read))}>
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className={cn("font-semibold text-sm", !notif.read && "text-foreground")}>{notif.title}</h4>
                          {notif.priority === "high" && !notif.read && (
                            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{notif.message}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                          </span>
                          <span className="capitalize">{notif.type}</span>
                        </div>
                      </div>
                      <div 
                        className="flex items-center gap-2 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!notif.read && (
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <CheckCheck className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(notif.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </POSLayout>
  )
}
