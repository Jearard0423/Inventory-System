"use client"

import React from "react"
import { useState, useEffect, useRef } from "react"
import { POSLayout } from "@/components/pos-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Bot, Send, User, Loader2, Sparkles, TrendingUp,
  Package, ShoppingCart, AlertTriangle, RefreshCw, BarChart3, ChefHat,
} from "lucide-react"
import { getInventoryItems, getLowStockItems } from "@/lib/inventory-store"
import { cn } from "@/lib/utils"

interface Message {
  role: "user" | "assistant"
  content: string
}

const ACTIVE_STATUSES = new Set(["incomplete", "cooking", "ready", "pending"])
const DONE_STATUSES   = new Set(["delivered", "served", "cancelled", "canceled", "complete", "completed"])

/** Read only active (non-finished) customer orders from localStorage */
function readActiveCustomerOrders(): any[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("yellowbell_customer_orders") : null
    if (!raw) return []
    return (JSON.parse(raw) as any[]).filter(o => !DONE_STATUSES.has((o.status || "").toLowerCase()))
  } catch { return [] }
}

/** Read only pending orders from yellowbell_orders */
function readPendingOrders(): any[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("yellowbell_orders") : null
    if (!raw) return []
    return (JSON.parse(raw) as any[]).filter(o => (o.status || "").toLowerCase() === "pending")
  } catch { return [] }
}

function buildContext(): string {
  try {
    const inventory  = getInventoryItems()
    const custOrders = readActiveCustomerOrders()
    const orders     = readPendingOrders()
    const lowStock   = getLowStockItems()

    const now    = new Date()
    const phTime = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000)
    const dateLabel = phTime.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila" })
    const timeLabel = phTime.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" })

    const food       = inventory.filter(i => !i.isUtensil && !i.isContainer && i.category !== "raw-stock")
    const rawStock   = inventory.filter(i => i.category === "raw-stock")
    const utensils   = inventory.filter(i => i.isUtensil)
    const containers = inventory.filter(i => i.isContainer)

    const todayStr    = phTime.toDateString()
    const todayOrders = orders.filter(o => new Date(o.date || o.createdAt || "").toDateString() === todayStr)
    const paidOrders  = orders.filter(o => o.paymentStatus === "paid")
    const unpaidOrders = orders.filter(o => o.paymentStatus !== "paid")
    const totalRevenue   = paidOrders.reduce((s, o) => s + (o.total || 0), 0)
    const pendingRevenue = unpaidOrders.reduce((s, o) => s + (o.total || 0), 0)
    const cashCount  = paidOrders.filter(o => o.paymentMethod === "cash").length
    const gcashCount = paidOrders.filter(o => o.paymentMethod === "gcash").length

    const freq: Record<string, number> = {}
    orders.forEach(o => (o.items || []).forEach((it: any) => { freq[it.name] = (freq[it.name] || 0) + (it.quantity || 1) }))
    const topItems = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, qty]) => `${name} (${qty} pcs)`)

    const mealBreak: Record<string, number> = {}
    orders.forEach(o => { const mt = (o.mealType || o.originalMealType || "other").toLowerCase(); mealBreak[mt] = (mealBreak[mt] || 0) + 1 })

    return `
Current Date & Time (Philippines): ${dateLabel}, ${timeLabel}

═══ INVENTORY STATUS ═══
Food Items (${food.length} types):
${food.map(i => `  • ${i.name}: ${i.stock} units @ ₱${i.price} [${i.status}]`).join("\n") || "  (none)"}

Raw Stock (${rawStock.length} types):
${rawStock.map(i => `  • ${i.name}: ${i.stock} units [${i.status}]`).join("\n") || "  (none)"}

Utensils (${utensils.length} types):
${utensils.map(i => `  • ${i.name}: ${i.stock} pcs`).join("\n") || "  (none)"}

Containers (${containers.length} types):
${containers.map(i => `  • ${i.name}: ${i.stock} pcs`).join("\n") || "  (none)"}

⚠ LOW STOCK ALERTS (≤5 units):
${lowStock.length > 0 ? lowStock.map(i => `  ⚠ ${i.name}: only ${i.stock} left`).join("\n") : "  ✓ All items adequately stocked"}

═══ ORDER METRICS ═══
Total Active Orders: ${orders.length}
Today's Orders: ${todayOrders.length}
Pending / Active Customer Orders: ${custOrders.length}
Paid Orders: ${paidOrders.length}  (Cash: ${cashCount}, GCash: ${gcashCount})
Unpaid Orders: ${unpaidOrders.length}

Revenue:
  • Collected: ₱${totalRevenue.toLocaleString()}
  • Pending collection: ₱${pendingRevenue.toLocaleString()}

Meal Type Breakdown:
${Object.entries(mealBreak).map(([mt, cnt]) => `  • ${mt}: ${cnt} orders`).join("\n") || "  (no data)"}

Top Ordered Items (all time):
${topItems.length > 0 ? topItems.map((t, i) => `  ${i + 1}. ${t}`).join("\n") : "  (no order data yet)"}

Active Pending Orders (latest 10):
${custOrders.slice(0, 10).map(o =>
  `  • ${o.customerName} | ${o.orderNumber || o.id} | ${o.mealType || "?"} | ${o.cookTime ? o.cookTime + " delivery" : "no time"} | ₱${o.total || 0}`
).join("\n") || "  (none)"}
`.trim()
  } catch (err) {
    return `Error reading live data: ${err instanceof Error ? err.message : "unknown error"}`
  }
}

const SUGGESTED = [
  { label: "📦 Low stock?",        text: "Which items are running low or out of stock? Give me a restock plan." },
  { label: "📈 Top sellers",       text: "What are our top selling items? Any slow-moving items I should know about?" },
  { label: "💰 Revenue summary",   text: "Give me a revenue summary — collected, pending, and breakdown by payment method." },
  { label: "🔮 Demand prediction", text: "Based on our order history, predict demand for the next 3 days and recommend stock quantities." },
  { label: "📋 Pending orders",    text: "How many orders are currently pending and what's the total value outstanding?" },
  { label: "🍗 Meal type trends",  text: "What meal types (breakfast, lunch, dinner) are most popular? Any patterns?" },
  { label: "⚠️ Urgent issues",     text: "Are there any urgent issues I should address right now — stock, orders, or payments?" },
  { label: "💡 Business advice",   text: "Based on our current data, what are your top 3 business improvement recommendations?" },
]

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [context, setContext]   = useState("")
  const [statsRefreshed, setStatsRefreshed] = useState(new Date())
  const bottomRef = useRef<HTMLDivElement>(null)

  const [stats, setStats] = useState({
    lowStockCount: 0, outOfStockCount: 0,
    pendingOrders: 0, totalRevenue: 0, todayOrders: 0,
  })

  function refreshStats() {
    try {
      const inv  = getInventoryItems()
      const co   = readActiveCustomerOrders()
      const ord  = readPendingOrders()
      const paid = ord.filter(o => o.paymentStatus === "paid")
      const now  = new Date()
      const phNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000)

      setStats({
        lowStockCount:   inv.filter(i => i.stock > 0 && i.stock <= 5 && !i.isUtensil && !i.isContainer && i.category !== "raw-stock").length,
        outOfStockCount: inv.filter(i => i.stock === 0 && !i.isUtensil && !i.isContainer && i.category !== "raw-stock").length,
        pendingOrders:   co.length,
        totalRevenue:    paid.reduce((s, o) => s + (o.total || 0), 0),
        todayOrders:     ord.filter(o => new Date(o.date || o.createdAt || "").toDateString() === phNow.toDateString()).length,
      })
      setContext(buildContext())
      setStatsRefreshed(new Date())
    } catch {}
  }

  useEffect(() => {
    refreshStats()
    const iv = setInterval(refreshStats, 30000)
    const onUpdate = () => refreshStats()
    window.addEventListener("firebase-orders-updated", onUpdate)
    window.addEventListener("customer-orders-updated", onUpdate)
    window.addEventListener("firebase-inventory-updated", onUpdate)
    window.addEventListener("orders-updated", onUpdate)
    return () => {
      clearInterval(iv)
      window.removeEventListener("firebase-orders-updated", onUpdate)
      window.removeEventListener("customer-orders-updated", onUpdate)
      window.removeEventListener("firebase-inventory-updated", onUpdate)
      window.removeEventListener("orders-updated", onUpdate)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const sendMessage = async (text?: string) => {
    const userText = (text ?? input).trim()
    if (!userText || loading) return
    setInput("")
    const userMsg: Message = { role: "user", content: userText }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)
    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, context }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `❌ Could not reach the AI service.\n\n**Reason:** ${err instanceof Error ? err.message : "Unknown error"}\n\n**Fix:** Make sure \`GROQ_API_KEY\` is set in your \`.env.local\` file, then restart the dev server.`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <POSLayout fullWidth>
      {/* h-full works because POSLayout fullWidth sets the wrapper to h-full flex flex-col */}
      <div className="h-full flex flex-col gap-4 min-h-0">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">YRC Insight</h1>
              <Badge variant="secondary" className="text-xs">AI</Badge>
            </div>
            <p className="text-sm text-muted-foreground pl-10">
              Business intelligence assistant — reads live inventory, orders &amp; revenue
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshStats} className="gap-1.5 shrink-0">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 shrink-0">
          {[
            { label: "Low Stock",      value: stats.lowStockCount,                          icon: Package,       color: stats.lowStockCount > 0  ? "text-amber-600" : "text-muted-foreground" },
            { label: "Out of Stock",   value: stats.outOfStockCount,                        icon: AlertTriangle, color: stats.outOfStockCount > 0 ? "text-red-600"   : "text-muted-foreground" },
            { label: "Pending",        value: stats.pendingOrders,                          icon: ShoppingCart,  color: "text-foreground" },
            { label: "Today's Orders", value: stats.todayOrders,                            icon: ChefHat,       color: "text-primary" },
            { label: "Revenue",        value: `₱${stats.totalRevenue.toLocaleString()}`,    icon: TrendingUp,    color: "text-green-600" },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-2">
                <s.icon className={cn("w-4 h-4 shrink-0", s.color)} />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground leading-none truncate">{s.label}</p>
                  <p className={cn("font-bold text-sm leading-tight", s.color)}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chat card — flex-1 + min-h-0 so it fills remaining space and scrolls internally */}
        <Card className="flex-1 min-h-0 border-0 shadow-sm flex flex-col overflow-hidden">
          <CardHeader className="pb-2 pt-3 px-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Chat
              </CardTitle>
              {messages.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="h-7 text-xs text-muted-foreground">
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>

          {/* Scrollable message area */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Bot className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-base">How can I help you today?</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Ask about stock, revenue, orders, or predictions</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2 max-w-xl">
                  {SUGGESTED.map(s => (
                    <button key={s.label} onClick={() => sendMessage(s.text)} disabled={loading}
                      className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50">
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                  msg.role === "assistant" ? "bg-primary" : "bg-muted")}>
                  {msg.role === "assistant"
                    ? <Bot className="w-3.5 h-3.5 text-white" />
                    : <User className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
                <div className={cn("rounded-2xl px-4 py-2.5 text-sm max-w-[82%]",
                  msg.role === "assistant"
                    ? "bg-muted text-foreground rounded-tl-sm"
                    : "bg-primary text-primary-foreground rounded-tr-sm")}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Analyzing your data…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t px-4 py-3 flex gap-2 shrink-0">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about inventory, orders, revenue, predictions… (Enter to send)"
              disabled={loading}
              className="resize-none min-h-[44px] max-h-[120px] text-sm leading-snug"
              rows={1}
            />
            <Button size="icon" onClick={() => sendMessage()} disabled={loading || !input.trim()} className="h-11 w-11 shrink-0">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground shrink-0">
          Data refreshed at {statsRefreshed.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Manila" })} · Updates every 30 seconds
        </p>
      </div>
    </POSLayout>
  )
}