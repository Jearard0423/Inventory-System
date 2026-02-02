"use client"

import type { ReactNode } from "react"
import { useState, useEffect } from "react"
import { Sidebar } from "./sidebar"

export function POSLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Check sidebar state on mount and when storage changes
  useEffect(() => {
    const checkSidebarState = () => {
      const saved = localStorage.getItem("sidebar-collapsed")
      setSidebarCollapsed(saved ? JSON.parse(saved) : false)
    }

    // Initial check
    checkSidebarState()

    // Listen for storage changes and custom events
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "sidebar-collapsed") {
        checkSidebarState()
      }
    }

    const handleCustomEvent = () => {
      checkSidebarState()
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("sidebar-state-changed", handleCustomEvent)
    
    // Also check periodically as a fallback
    const interval = setInterval(checkSidebarState, 100)
    
    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("sidebar-state-changed", handleCustomEvent)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="h-screen bg-background overflow-hidden flex">
      <Sidebar />
      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"} overflow-y-auto`}>
        <div className="container mx-auto p-4 lg:p-8 pt-4 lg:pt-6">{children}</div>
      </main>
    </div>
  )
}
