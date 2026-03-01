"use client"

import { ReactNode, useEffect } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { NotificationBell } from "@/components/notification-bell"
import { checkAndFireOrderReminders } from "@/lib/order-reminders"

export function AppLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Fire reminders immediately on load, then every minute
    checkAndFireOrderReminders()
    const reminderInterval = setInterval(checkAndFireOrderReminders, 60 * 1000)
    return () => clearInterval(reminderInterval)
  }, [])
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <div className="relative flex min-h-screen flex-col">
        {children}
        <div className="fixed bottom-4 right-4 z-50">
          <NotificationBell />
        </div>
      </div>
      <Toaster />
    </ThemeProvider>
  )
}
