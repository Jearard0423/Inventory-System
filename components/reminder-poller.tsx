"use client"

import { useEffect } from "react"

/**
 * ReminderPoller
 *
 * Mounts on the root layout so it runs on EVERY page — including the login page.
 * Every 5 minutes it calls /api/send-reminders which:
 *   1. Fetches all registered user emails from Firebase
 *   2. Fetches pending orders from Firebase
 *   3. Sends 1-hour and 2-hour reminder emails server-side
 *
 * No login required. Works as long as the browser tab is open anywhere in the app.
 */
export function ReminderPoller() {
  const poll = async () => {
    try {
      const res = await fetch("/api/send-reminders", { method: "POST" })
      const data = await res.json()
      console.log("[ReminderPoller] ✅ Checked reminders:", data)
    } catch (err) {
      console.warn("[ReminderPoller] Could not reach /api/send-reminders:", err)
    }
  }

  useEffect(() => {
    // Run immediately on mount
    poll()

    // Then every 5 minutes
    const interval = setInterval(poll, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  return null // renders nothing
}
