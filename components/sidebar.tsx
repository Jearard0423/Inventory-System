"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { Home, ShoppingCart, Package, ChefHat, Truck, Bell, TrendingUp, ChevronLeft, Menu, Clock, CheckCircle, X, ArrowLeft, Plus, ClipboardList, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getUnreadCount } from "@/lib/notifications-store"
import { getTodaysOrderCount } from "@/lib/orders"

const navItems = [
  { href: "/", icon: Home, label: "Dashboard" },
  { href: "/new-order", icon: Plus, label: "New Order" },
  { href: "/orders", icon: ShoppingCart, label: "Orders" },
  { href: "/prepared-orders", icon: ClipboardList, label: "Prepared Orders" },
  { href: "/prepared-orders-inventory", icon: BarChart3, label: "Prepared Orders Inventory" },
  { href: "/kitchen", icon: ChefHat, label: "Kitchen View" },
  { href: "/delivery", icon: Truck, label: "Delivery" },
  { href: "/inventory", icon: Package, label: "Inventory" },
  { href: "/sales", icon: TrendingUp, label: "Sales Summary" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [todaysOrderCount, setTodaysOrderCount] = useState(0)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  // Initialize client-side state after mount
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved) {
      setCollapsed(JSON.parse(saved))
    }
  }, [])

  // Save collapsed state to localStorage whenever it changes and handle body scroll
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("sidebar-collapsed", JSON.stringify(collapsed))
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent("sidebar-state-changed"))
    }
  }, [collapsed, mounted])

  // Prevent body scrolling when mobile menu is open
  useEffect(() => {
    if (!mounted) return
    
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [mobileOpen, mounted]);

  useEffect(() => {
    if (!mounted) return
    
    const updateCounts = () => {
      setUnreadCount(getUnreadCount())
      setTodaysOrderCount(getTodaysOrderCount())
    }

    updateCounts()
    window.addEventListener("notifications-updated", updateCounts)
    window.addEventListener("orders-updated", updateCounts)
    window.addEventListener("inventory-updated", updateCounts)

    return () => {
      window.removeEventListener("notifications-updated", updateCounts)
      window.removeEventListener("orders-updated", updateCounts)
      window.removeEventListener("inventory-updated", updateCounts)
    }
  }, [mounted])

  // Auto-collapse sidebar when navigating to new-order or orders page
  useEffect(() => {
    if (!mounted) return
    
    if (pathname === "/new-order" || pathname === "/orders") {
      setCollapsed(true)
    }
  }, [pathname, mounted])

  return (
    <>
      {/* Mobile toggle button - Only visible when sidebar is closed on mobile */}
      {!mobileOpen && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-3 left-3 z-50 md:hidden bg-sidebar/95 backdrop-blur-sm text-sidebar-foreground h-12 w-12 rounded-lg"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </Button>
      )}

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-background/90 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
          style={{
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'none',
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 flex flex-col",
          "border-r border-sidebar-border shadow-lg",
          collapsed ? "w-20" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        style={{
          willChange: 'transform',
          transitionProperty: 'transform, width',
          transitionDuration: '300ms',
          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Logo and close button section */}
        <div className="flex h-16 items-center justify-between px-3 sm:px-4 border-b border-sidebar-border bg-sidebar/95 backdrop-blur-sm">
          {!collapsed ? (
            <div className="flex items-center gap-2 sm:gap-3 flex-1">
              <Image src="/yrc-logo.png" alt="Yellowbell Roast Co." width={32} height={32} className="rounded-md sm:w-10 sm:h-10" />
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-bold text-sidebar-foreground">YELLOWBELL</span>
                <span className="text-xs sm:text-xs text-sidebar-foreground/70">ROAST CO.</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto md:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground h-8 w-8"
                onClick={() => setMobileOpen(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <Image src="/yrc-logo.png" alt="YRC" width={28} height={28} className="rounded-md" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav 
          className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4" 
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
            maxHeight: 'calc(100vh - 64px)',
            overscrollBehavior: 'contain',
            msOverflowStyle: 'none',
            overflowY: 'auto',
            overflowX: 'hidden',
            // @ts-ignore - Custom properties for webkit scrollbar
            '--scrollbar-width': '4px',
            '--scrollbar-thumb': 'rgba(255, 255, 255, 0.2)',
            '--scrollbar-track': 'transparent',
            '--scrollbar-thumb-hover': 'rgba(255, 255, 255, 0.3)',
          } as React.CSSProperties}
        >
          <ul className="space-y-1 sm:space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              const isNotifications = item.href === "/notifications"

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg transition-colors relative",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isActive && "bg-sidebar-primary text-sidebar-primary-foreground",
                      collapsed && "justify-center",
                      "min-h-[44px] sm:min-h-[48px]"
                    )}
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                    {!collapsed && <span className="text-xs sm:text-sm font-medium">{item.label}</span>}
                    {(isNotifications ? unreadCount > 0 : item.href === "/orders" && todaysOrderCount > 0) && (
                      <span
                        className={cn(
                          "absolute flex items-center justify-center min-w-[18px] sm:min-w-[20px] h-4 sm:h-5 px-1 sm:px-1.5 text-white text-xs font-bold rounded-full",
                          collapsed ? "top-1 right-1" : "right-2 sm:right-3",
                          isNotifications ? "bg-red-500" : "bg-blue-500"
                        )}
                      >
                        {isNotifications 
                          ? (unreadCount > 99 ? "99+" : unreadCount)
                          : (todaysOrderCount > 99 ? "99+" : todaysOrderCount)
                        }
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="hidden md:block border-t border-sidebar-border p-3 sm:p-4 flex-shrink-0 bg-sidebar">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full text-sidebar-foreground hover:bg-sidebar-accent",
              "py-3 sm:py-4 px-2 sm:px-3 h-auto rounded-md transition-colors",
              collapsed && "px-0"
            )}
          >
            <ChevronLeft className={cn("h-3 w-3 sm:h-4 sm:w-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span className="ml-1 sm:ml-2 text-xs sm:text-sm">Collapse</span>}
          </Button>
        </div>
      </aside>
    </>
  )
}
