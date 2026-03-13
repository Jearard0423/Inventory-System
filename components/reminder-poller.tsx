"use client"

import { useEffect } from "react"

const SENT_KEY = "yellowbell_email_reminders_sent_v1"
const COOK_TIME_SNAPSHOT_KEY = "yellowbell_reminder_cooktime_snapshot_v1"
const RTDB_SENT_KEYS_PATH = "reminderSentKeys"

// ── Local localStorage helpers ────────────────────────────────────────────────

const getSentKeys = (): Set<string> => {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(SENT_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

const saveSentKeysLocal = (keys: Set<string>) => {
  if (typeof window === "undefined") return
  localStorage.setItem(SENT_KEY, JSON.stringify(Array.from(keys)))
}

// ── RTDB helpers — shared dedup across ALL admin devices ─────────────────────
// We use the Firebase SDK directly (client-side) so no FIREBASE_DB_SECRET needed.
// All admins read from and write to /reminderSentKeys/{key} = { ts, key }
// Keys older than 48 hours are ignored (auto-expire logic).

const fetchRTDBSentKeys = async (): Promise<Set<string>> => {
  try {
    const { database } = await import("@/lib/firebase")
    const { ref, get } = await import("firebase/database")
    const snap = await get(ref(database, RTDB_SENT_KEYS_PATH))
    if (!snap.exists()) return new Set()
    const now = Date.now()
    const keys = new Set<string>()
    Object.entries(snap.val() as Record<string, any>).forEach(([, v]) => {
      if (v?.key && now - (v.ts || 0) < 48 * 3600000) keys.add(v.key)
    })
    return keys
  } catch { return new Set() }
}

const pushKeysToRTDB = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) return
  try {
    const { database } = await import("@/lib/firebase")
    const { ref, update } = await import("firebase/database")
    const now = Date.now()
    const payload: Record<string, any> = {}
    keys.forEach(k => {
      // Firebase keys can't contain . / [ ] # $ — replace with _
      payload[k.replace(/[./#[\]$]/g, "_")] = { ts: now, key: k }
    })
    await update(ref(database, RTDB_SENT_KEYS_PATH), payload)
    console.log(`[ReminderPoller] Pushed ${keys.length} sent key(s) to RTDB`)
  } catch (e) {
    console.warn("[ReminderPoller] RTDB sentKeys push failed (non-critical):", e)
  }
}

// ── cookTime change detection — clears dedup when admin edits delivery time ──

const clearSentKeysForChangedOrders = async (orders: any[]) => {
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
        keysToRemove.push(`dayBefore:${o.id}`, `1hr:${o.id}`, `2hr:${o.id}`)
        console.log(`[ReminderPoller] ⏰ Order ${o.id} time changed (${snapshot[o.id]} → ${sig}), clearing sent keys`)
      }
    })

    if (keysToRemove.length > 0) {
      // Remove from local set
      const existing = getSentKeys()
      keysToRemove.forEach(k => existing.delete(k))
      saveSentKeysLocal(existing)

      // Also remove from RTDB so OTHER admin devices also stop skipping this order
      try {
        const { database } = await import("@/lib/firebase")
        const { ref, remove } = await import("firebase/database")
        await Promise.all(
          keysToRemove.map(k =>
            remove(ref(database, `${RTDB_SENT_KEYS_PATH}/${k.replace(/[./#[\]$]/g, "_")}`))
          )
        )
        console.log(`[ReminderPoller] Removed ${keysToRemove.length} stale keys from RTDB`)
      } catch { /* non-critical */ }
    }

    localStorage.setItem(COOK_TIME_SNAPSHOT_KEY, JSON.stringify(newSnapshot))
  } catch { /* non-critical */ }
}

// ── Main poller ───────────────────────────────────────────────────────────────

export function ReminderPoller() {
  const poll = async () => {
    try {
      // Load orders from RTDB-backed in-memory store
      let orders: any[] = []
      try {
        const { getCustomerOrders } = await import("@/lib/inventory-store")
        orders = getCustomerOrders()
      } catch {
        const raw = typeof window !== "undefined" ? localStorage.getItem("yellowbell_customer_orders") : null
        orders = raw ? JSON.parse(raw) : []
      }

      // Clear sent keys for any orders whose delivery time was edited
      await clearSentKeysForChangedOrders(orders)

      // Merge local + RTDB sent keys so cross-device dedup is complete
      const localKeys = getSentKeys()
      const rtdbKeys = await fetchRTDBSentKeys()
      const merged = new Set([...localKeys, ...rtdbKeys])

      // Sync merged set back to local so we don't re-fetch next poll
      saveSentKeysLocal(merged)

      const sentKeys = Array.from(merged)

      const res = await fetch("/api/send-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders, sentKeys }),
      })
      const data = await res.json()

      if (Array.isArray(data.newSentKeys) && data.newSentKeys.length > 0) {
        // Save to local
        const updated = new Set([...merged, ...data.newSentKeys])
        saveSentKeysLocal(updated)
        // Push to RTDB so all other admin devices immediately know these reminders were sent
        await pushKeysToRTDB(data.newSentKeys)
      }

      console.log("[ReminderPoller] ✅ Checked reminders:", data)
    } catch (err) {
      console.warn("[ReminderPoller] Could not reach /api/send-reminders:", err)
    }
  }

  useEffect(() => {
    poll()
    const interval = setInterval(poll, 5 * 60 * 1000)
    const onUpdate = () => poll()
    window.addEventListener("orders-updated", onUpdate)
    window.addEventListener("customer-orders-updated", onUpdate)
    return () => {
      clearInterval(interval)
      window.removeEventListener("orders-updated", onUpdate)
      window.removeEventListener("customer-orders-updated", onUpdate)
    }
  }, [])

  return null
}