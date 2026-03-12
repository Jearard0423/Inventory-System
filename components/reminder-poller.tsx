"use client"

import { useEffect } from "react"

const SENT_KEY = "yellowbell_email_reminders_sent_v1"
const COOK_TIME_SNAPSHOT_KEY = "yellowbell_reminder_cooktime_snapshot_v1"

const getSentKeys = (): Set<string> => {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(SENT_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

const markSent = (keys: string[]) => {
  if (typeof window === "undefined") return
  const existing = getSentKeys()
  keys.forEach(k => existing.add(k))
  localStorage.setItem(SENT_KEY, JSON.stringify(Array.from(existing)))
}

/**
 * When an admin edits an order's cookTime or date, the old sentKeys
 * (e.g. "1hr:abc123") must be cleared for that order so reminders
 * fire again at the new time. We track a snapshot of {orderId → cookTime+date}
 * and invalidate on change.
 */
const clearSentKeysForChangedOrders = (orders: any[]) => {
  if (typeof window === "undefined") return
  try {
    const snapshotRaw = localStorage.getItem(COOK_TIME_SNAPSHOT_KEY)
    const snapshot: Record<string, string> = snapshotRaw ? JSON.parse(snapshotRaw) : {}
    const newSnapshot: Record<string, string> = {}
    const keysToRemove: string[] = []

    orders.forEach(o => {
      const sig = `${o.cookTime || ""}|${o.date || ""}`
      newSnapshot[o.id] = sig
      if (snapshot[o.id] && snapshot[o.id] !== sig) {
        // cookTime or date changed — invalidate all reminder keys for this order
        keysToRemove.push(`dayBefore:${o.id}`, `1hr:${o.id}`, `2hr:${o.id}`)
        console.log(`[ReminderPoller] ⏰ Order ${o.id} time changed (${snapshot[o.id]} → ${sig}), clearing sent keys`)
      }
    })

    if (keysToRemove.length > 0) {
      const existing = getSentKeys()
      keysToRemove.forEach(k => existing.delete(k))
      localStorage.setItem(SENT_KEY, JSON.stringify(Array.from(existing)))
    }

    localStorage.setItem(COOK_TIME_SNAPSHOT_KEY, JSON.stringify(newSnapshot))
  } catch { /* non-critical */ }
}

export function ReminderPoller() {
  const poll = async () => {
    try {
      // Use RTDB-backed in-memory orders (via getCustomerOrders) to avoid ghost orders from localStorage
      let orders: any[] = []
      try {
        const { getCustomerOrders } = await import("@/lib/inventory-store")
        orders = getCustomerOrders()
      } catch {
        // fallback to localStorage only if module fails to load
        const raw = typeof window !== "undefined" ? localStorage.getItem("yellowbell_customer_orders") : null
        orders = raw ? JSON.parse(raw) : []
      }

      // Clear stale sent keys for any orders whose time was edited
      clearSentKeysForChangedOrders(orders)

      const sentKeys = Array.from(getSentKeys())

      const res = await fetch("/api/send-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders, sentKeys }),
      })
      const data = await res.json()

      if (Array.isArray(data.newSentKeys) && data.newSentKeys.length > 0) {
        markSent(data.newSentKeys)
      }

      console.log("[ReminderPoller] ✅ Checked reminders:", data)
    } catch (err) {
      console.warn("[ReminderPoller] Could not reach /api/send-reminders:", err)
    }
  }

  useEffect(() => {
    poll()
    const interval = setInterval(poll, 5 * 60 * 1000)
    // Also re-poll immediately when an order edit is detected
    const onOrdersUpdated = () => poll()
    window.addEventListener("orders-updated", onOrdersUpdated)
    window.addEventListener("customer-orders-updated", onOrdersUpdated)
    return () => {
      clearInterval(interval)
      window.removeEventListener("orders-updated", onOrdersUpdated)
      window.removeEventListener("customer-orders-updated", onOrdersUpdated)
    }
  }, [])

  return null
}