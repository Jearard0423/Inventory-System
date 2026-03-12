"use client"

import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bell, CheckCheck, Clock, Trash2, Package, ShoppingCart, Truck, AlertCircle, ChevronRight } from "lucide-react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
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
  const router = useRouter()
  const itemsPerPage = 10

  useEffect(() => {
    const load = () => setNotifications(getNotifications())
    load()
    if (typeof window !== "undefined") {
      window.addEventListener("notifications-updated", load)
      return () => window.removeEventListener("notifications-updated", load)
    }
  }, [])

  useEffect(() => { setCurrentPage(1) }, [activeTab])

  const filtered = notifications.filter(n => {
    if (activeTab === "Unread") return !n.read
    if (activeTab === "Orders") return n.type === "order" || n.type === "delivery"
    if (activeTab === "Inventory") return n.type === "inventory"
    return true
  })

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const getIcon = (type: string, priority: string, read: boolean) => {
    const color = read ? "text-muted-foreground" :
      priority === "high" ? "text-red-500" :
      priority === "medium" ? "text-amber-500" : "text-primary"
    const cls = cn("h-4 w-4 shrink-0", color)
    if (type === "order") return <ShoppingCart className={cls} />
    if (type === "delivery") return <Truck className={cls} />
    if (type === "inventory") return <Package className={cls} />
    return <Bell className={cls} />
  }

  const priorityBadge = (priority: string, read: boolean) => {
    if (read || priority === "low") return null
    const cls = priority === "high"
      ? "bg-red-100 text-red-700 border-red-200"
      : "bg-amber-100 text-amber-700 border-amber-200"
    return (
      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0", cls)}>
        {priority}
      </span>
    )
  }

  return (
    <POSLayout>
      <div className="space-y-4 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold">Notifications</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Stay updated with your business activities</p>
          </div>
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="shrink-0 text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3">
            <CheckCheck className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Mark All as Read</span>
          </Button>
        </div>

        <Card className="overflow-hidden">
          {/* Tab row */}
          <CardHeader className="px-3 sm:px-4 py-3 border-b bg-muted/20">
            <div className="flex gap-1.5 flex-wrap">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all",
                    activeTab === tab
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-background border border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {tab}
                  {tab === "Unread" && notifications.filter(n => !n.read).length > 0 && (
                    <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Bell className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="text-base sm:text-lg font-semibold mb-1">No notifications</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  You&apos;re all caught up! Alerts about orders and inventory will appear here.
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y">
                  {paginated.map(notif => (
                    <div
                      key={notif.id}
                      className={cn(
                        "group relative px-3 sm:px-4 py-3 transition-colors cursor-pointer",
                        !notif.read ? "bg-primary/[0.03] hover:bg-primary/[0.06]" : "hover:bg-muted/40"
                      )}
                      onClick={() => {
                        if (!notif.read) markAsRead(notif.id)
                        if (notif.data?.id) router.push(`/orders?orderId=${notif.data.id}`)
                      }}
                    >
                      <div className="flex items-start gap-2.5 sm:gap-3">
                        {/* Icon */}
                        <div className="mt-0.5 shrink-0">
                          {getIcon(notif.type, notif.priority, notif.read)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Title row */}
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <h4 className={cn(
                              "text-xs sm:text-sm font-semibold leading-snug",
                              !notif.read ? "text-foreground" : "text-muted-foreground"
                            )}>
                              {notif.title}
                            </h4>
                            {priorityBadge(notif.priority, notif.read)}
                            {!notif.read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                            )}
                          </div>

                          {/* Message — clamped on mobile */}
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 sm:line-clamp-none">
                            {notif.message}
                          </p>

                          {/* Meta row */}
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] sm:text-xs text-muted-foreground/70">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
                            </span>
                            <span className="capitalize shrink-0">· {notif.type}</span>
                            {notif.data?.id && (
                              <span className="ml-auto flex items-center gap-0.5 text-primary shrink-0">
                                View <ChevronRight className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Delete button — shown on hover (desktop) or always on mobile */}
                        <button
                          className={cn(
                            "p-1 rounded-md text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 transition-all shrink-0 mt-0.5",
                            "sm:opacity-0 sm:group-hover:opacity-100"
                          )}
                          onClick={e => { e.stopPropagation(); deleteNotification(notif.id) }}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="px-3 py-3 border-t">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
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