"use client"

import { useEffect, useState, useMemo } from "react"
import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Package, CheckCircle2, Truck, Clock, TrendingUp, ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { getCustomerOrders, getOrderHistory, type CustomerOrder } from "@/lib/inventory-store"
import { Pagination } from "@/components/pagination"

// Status helpers
const STATUS_GROUPS = {
  pending:   ["pending", "cooked", "ready"],
  completed: ["complete", "completed", "served"],
  delivered: ["delivered"],
} as const

type StatusGroup = keyof typeof STATUS_GROUPS

const CANCELLED = new Set(["cancelled", "canceled", "deleted", "removed"])

const getGroup = (status: string): StatusGroup | "cancelled" => {
  const s = (status || "").toLowerCase()
  if (CANCELLED.has(s)) return "cancelled"
  if (STATUS_GROUPS.delivered.includes(s as any)) return "delivered"
  if (STATUS_GROUPS.completed.includes(s as any)) return "completed"
  return "pending"
}

const statusBadge = (status: string) => {
  const g = getGroup(status)
  if (g === "delivered")  return { label: "Delivered",  cls: "bg-blue-50 text-blue-700 border-blue-200" }
  if (g === "completed")  return { label: "Completed",  cls: "bg-green-50 text-green-700 border-green-200" }
  if (g === "cancelled")  return { label: "Cancelled",  cls: "bg-red-50 text-red-600 border-red-200" }
  return { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200" }
}

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) }
  catch { return d }
}

type DateFilter = "all-time" | "today" | "yesterday" | "this-week"

export default function OrderHistoryPage() {
  const [allOrders, setAllOrders] = useState<CustomerOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dateFilter, setDateFilter] = useState<DateFilter>("all-time")
  const [statusFilter, setStatusFilter] = useState<"all" | StatusGroup>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const itemsPerPage = 10

  const buildList = () => {
    // History shows only FINALIZED orders (delivered, complete, cancelled).
    // Active orders (incomplete/pending/cooking) belong on the Orders/Kitchen pages only.
    const ACTIVE_STATUSES = new Set(["incomplete", "pending", "cooking", "to-cook"])

    // getOrderHistory() is RTDB-replaced (not merged) — the authoritative archive
    const archived = getOrderHistory().filter(o => {
      const s = (o.status || "").toLowerCase()
      // Exclude cancelled AND active orders from history
      if (CANCELLED.has(s)) return false
      if (ACTIVE_STATUSES.has(s)) return false
      return true
    })

    // Also include delivered/complete orders from the live feed (in case archival was delayed)
    const FINAL_LIVE = new Set(["complete", "completed", "delivered", "served", "ready"])
    const liveFinalized = getCustomerOrders().filter(o => FINAL_LIVE.has((o.status || "").toLowerCase()))
    const liveIds = new Set(liveFinalized.map(o => o.id))

    // Merge: live finalized first, then archived (excluding those already in live)
    const merged = [
      ...liveFinalized,
      ...archived.filter(o => !liveIds.has(o.id))
    ]
    merged.sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime())
    setAllOrders(merged)
    setIsLoading(false)
  }

  useEffect(() => {
    // Trigger RTDB history refresh (replaces localStorage, not merges)
    // This purges ghost pending orders from history before we render
    import("@/lib/firebase-inventory-sync")
      .then(m => m.loadOrderHistoryFromFirebase())
      .catch(() => {})
      .finally(() => buildList())

    const fn = () => buildList()
    // When Firebase pushes order changes, re-fetch history from RTDB then rebuild
    const handleFirebaseOrders = () => {
      import("@/lib/firebase-inventory-sync")
        .then(m => m.loadOrderHistoryFromFirebase())
        .catch(() => {})
        .finally(() => buildList())
    }
    window.addEventListener("orders-updated", fn)
    window.addEventListener("delivery-updated", fn)
    window.addEventListener("firebase-orders-updated", handleFirebaseOrders)
    window.addEventListener("customer-orders-updated", fn)
    return () => {
      window.removeEventListener("orders-updated", fn)
      window.removeEventListener("delivery-updated", fn)
      window.removeEventListener("firebase-orders-updated", handleFirebaseOrders)
      window.removeEventListener("customer-orders-updated", fn)
    }
  }, [])

  const filtered = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - today.getDay())

    return allOrders.filter(o => {
      // Date filter
      const d = new Date(o.createdAt || o.date || 0)
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      if (dateFilter === "today"     && day.getTime() !== today.getTime())     return false
      if (dateFilter === "yesterday" && day.getTime() !== yesterday.getTime()) return false
      if (dateFilter === "this-week" && day.getTime() <  weekStart.getTime())  return false

      // Status filter
      if (statusFilter !== "all" && getGroup(o.status) !== statusFilter) return false

      // Search
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!o.customerName?.toLowerCase().includes(q) && !o.orderNumber?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [allOrders, dateFilter, statusFilter, search])

  useEffect(() => setCurrentPage(1), [filtered])

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const totalPages = Math.ceil(filtered.length / itemsPerPage)

  // Tab counts
  const counts = useMemo(() => ({
    all:       allOrders.length,
    pending:   allOrders.filter(o => getGroup(o.status) === "pending").length,
    completed: allOrders.filter(o => getGroup(o.status) === "completed").length,
    delivered: allOrders.filter(o => getGroup(o.status) === "delivered").length,
  }), [allOrders])

  // Stats from filtered
  const stats = useMemo(() => ({
    total:   filtered.length,
    revenue: filtered.reduce((s, o) => s + (o.total || 0), 0),
    avg:     filtered.length > 0 ? filtered.reduce((s, o) => s + (o.total || 0), 0) / filtered.length : 0,
  }), [filtered])

  const STATUS_TABS: { key: "all" | StatusGroup; label: string; icon: any; color: string }[] = [
    { key: "all",       label: "All Orders", icon: Package,       color: "text-foreground" },
    { key: "pending",   label: "Pending",    icon: Clock,         color: "text-amber-600" },
    { key: "completed", label: "Completed",  icon: CheckCircle2,  color: "text-green-600" },
    { key: "delivered", label: "Delivered",  icon: Truck,         color: "text-blue-600" },
  ]

  const DATE_TABS: { key: DateFilter; label: string }[] = [
    { key: "all-time",  label: "All Time" },
    { key: "today",     label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "this-week", label: "This Week" },
  ]

  return (
    <POSLayout>
      <div className="space-y-4 pb-8">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Order History</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Track completed, delivered, and pending orders</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "Orders",  value: stats.total,                              icon: Package,    color: "text-primary" },
            { label: "Revenue", value: `₱${stats.revenue.toLocaleString()}`,     icon: TrendingUp, color: "text-green-600" },
            { label: "Avg",     value: `₱${Math.round(stats.avg).toLocaleString()}`, icon: TrendingUp, color: "text-blue-600" },
          ].map(s => (
            <Card key={s.label} className="border shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn("text-base sm:text-lg font-bold mt-0.5", s.color)}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border",
                statusFilter === tab.key
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <tab.icon className={cn("h-3.5 w-3.5", statusFilter === tab.key ? "text-primary-foreground" : tab.color)} />
              {tab.label}
              <span className={cn(
                "ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                statusFilter === tab.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}>
                {tab.key === "all" ? counts.all : counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Search + date filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search customer or order #…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {DATE_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setDateFilter(t.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  dateFilter === t.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Orders list */}
        {paginated.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-medium text-sm">No orders found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {paginated.map(order => {
              const badge = statusBadge(order.status)
              const isExpanded = expandedId === order.id
              const items = order.orderedItems || (order as any).items || []

              return (
                <Card key={order.id} className={cn("overflow-hidden transition-shadow hover:shadow-md", isExpanded && "ring-1 ring-primary/20")}>
                  <button
                    className="w-full text-left"
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        {/* Status indicator dot */}
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0 mt-1.5",
                          badge.label === "Delivered"  ? "bg-blue-500" :
                          badge.label === "Completed"  ? "bg-green-500" :
                          badge.label === "Pending"    ? "bg-amber-500" : "bg-red-400"
                        )} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <span className="font-semibold text-sm">{order.orderNumber || order.id.slice(0, 8)}</span>
                              <span className="text-muted-foreground text-xs mx-1.5">·</span>
                              <span className="text-sm">{order.customerName}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5", badge.cls)}>
                                {badge.label}
                              </Badge>
                              <span className="font-bold text-sm text-primary">₱{(order.total || 0).toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                            <span>{fmtDate(order.createdAt || order.date || "")}</span>
                            {order.mealType && <><span>·</span><span className="capitalize">{order.mealType}</span></>}
                            {order.cookTime  && <><span>·</span><span>{order.cookTime}</span></>}
                            <span>·</span>
                            <span>{items.length} item{items.length !== 1 ? "s" : ""}</span>
                          </div>
                        </div>

                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        }
                      </div>
                    </CardContent>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20 px-4 sm:px-5 py-3 space-y-3">
                      {/* Items */}
                      {items.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Items</p>
                          <div className="space-y-1">
                            {items.map((it: any, i: number) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span>{it.quantity || 1}× {it.name}</span>
                                <span className="text-muted-foreground">₱{((it.price || 0) * (it.quantity || 1)).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Payment */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
                        <div className="flex gap-3">
                          {order.paymentStatus && (
                            <span className={cn(
                              "px-2 py-0.5 rounded-full border text-[10px] font-medium",
                              order.paymentStatus === "paid" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"
                            )}>
                              {order.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                              {order.paymentMethod && ` · ${order.paymentMethod}`}
                            </span>
                          )}
                          {order.deliveryAddress && <span className="truncate max-w-[180px]">📍 {order.deliveryAddress}</span>}
                        </div>
                        <span className="font-bold text-sm text-foreground">Total: ₱{(order.total || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        )}
      </div>
    </POSLayout>
  )
}