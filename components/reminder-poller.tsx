"use client"

import { useEffect } from "react"

const SENT_KEY = "yellowbell_email_reminders_sent_v1"

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

export function ReminderPoller() {
  const poll = async () => {
    try {
      const raw = typeof window !== "undefined"
        ? localStorage.getItem("yellowbell_customer_orders")
        : null
      const orders = raw ? JSON.parse(raw) : []
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
    return () => clearInterval(interval)
  }, [])

  return null
}