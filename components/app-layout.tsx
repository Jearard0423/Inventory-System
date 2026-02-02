"use client"

import { ReactNode } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { NotificationBell } from "@/components/notification-bell"

export function AppLayout({ children }: { children: ReactNode }) {
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
