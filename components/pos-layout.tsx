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
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {/* Small mobile sidebar opener as a fallback trigger (dispatches event listened by Sidebar) */}
        <button
          aria-label="Open menu"
          onClick={() => window.dispatchEvent(new Event('open-mobile-sidebar'))}
          className="fixed top-3 left-3 z-50 lg:hidden bg-sidebar/95 backdrop-blur-sm text-sidebar-foreground h-10 w-10 rounded-lg flex items-center justify-center"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
        </button>
        <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"} overflow-y-auto`}>
          <div className="container mx-auto p-4 lg:p-8 pt-16 lg:pt-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}