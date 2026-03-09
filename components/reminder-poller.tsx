"use client"

import { useEffect } from "react"

/**
 * ReminderPoller
 *
 * Polls /api/send-reminders every 5 minutes.
 * Sends current customer orders from localStorage in the POST body
 * so the server never needs to read Firebase (fixes the 401 error).
 */
export function ReminderPoller() {
  const poll = async () => {
    try {
      const raw = typeof window !== 'undefined'
        ? localStorage.getItem('yellowbell_customer_orders')
        : null
      const orders = raw ? JSON.parse(raw) : []

      const res = await fetch("/api/send-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      })
      const data = await res.json()
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