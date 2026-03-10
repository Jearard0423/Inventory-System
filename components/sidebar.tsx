"use client"

import React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { Home, ShoppingCart, Package, ChefHat, Truck, Bell, TrendingUp, ChevronLeft, Menu, Clock, CheckCircle, X, ArrowLeft, Plus, ClipboardList, BarChart3, LogOut, Calculator, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getUnreadCount } from "@/lib/notifications-store"
import { getTodaysOrderCount } from "@/lib/orders"
import { useAuth } from "@/components/AuthProvider"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const navItems = [
  { href: "/", icon: Home, label: "Dashboard" },
  { href: "/new-order", icon: Plus, label: "New Order" },
  { href: "/orders", icon: ShoppingCart, label: "Orders" },
  { href: "/order-history", icon: Clock, label: "Order History" },
  { href: "/prepared-orders", icon: ClipboardList, label: "Prepared Orders" },
  { href: "/kitchen", icon: ChefHat, label: "Kitchen View" },
  { href: "/delivery", icon: Truck, label: "Delivery" },
  { href: "/inventory", icon: Package, label: "Inventory" },
  { href: "/inventory/pricing", icon: Calculator, label: "Pricing Calculator" },
  { href: "/sales", icon: TrendingUp, label: "Sales Summary" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/ai-assistant", icon: Sparkles, label: "AI Assistant" },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [todaysOrderCount, setTodaysOrderCount] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const pathname = usePathname()
  const auth = useAuth()

  // Initialize client-side state after mount
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("sidebar-collapsed")
    if (saved) {
      setCollapsed(JSON.parse(saved))
    }
    // allow external components to open mobile sidebar via custom event
    const handleOpenMobile = () => setMobileOpen(true)
    window.addEventListener('open-mobile-sidebar', handleOpenMobile)
    return () => window.removeEventListener('open-mobile-sidebar', handleOpenMobile)
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
          className="fixed top-3 right-3 z-50 lg:hidden bg-sidebar text-sidebar-foreground h-10 w-10 rounded-lg shadow-md"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </Button>
      )}

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-background/90 backdrop-blur-sm z-40 lg:hidden"
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
                className="ml-auto lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground h-8 w-8"
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
          className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 min-h-0" 
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent',
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

        <div className="border-t border-sidebar-border p-2 sm:p-4 space-y-1 sm:space-y-2 flex-shrink-0 bg-sidebar">
          {/* User Profile Section */}
          {auth?.user && (
            <div className={cn(
              "mb-2 sm:mb-4 pb-2 sm:pb-4 border-b border-sidebar-border",
              collapsed ? "flex justify-center" : ""
            )}>
              <div className={cn(
                "flex items-center gap-3",
                collapsed && "justify-center"
              )}>
                <div className={cn(
                  "w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center text-white font-semibold text-sm shrink-0",
                )}>
                  {(auth.user.email || "A").split("@")[0].split(".").slice(0, 2).map((p: string) => p[0].toUpperCase()).join("")}
                </div>
                {!collapsed && (
                  <div className="flex flex-col min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-sidebar-foreground truncate">
                      {(auth.user.email || "Admin").split("@")[0]}
                    </p>
                    <p className="text-xs text-sidebar-foreground/70 truncate">
                      {auth.user.email}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Logout Button — always visible on all screen sizes */}
          <Button
            onClick={() => setShowLogoutDialog(true)}
            className={cn(
              "w-full hover:bg-red-500/20 hover:text-red-400 text-red-400",
              "py-2 sm:py-3 px-2 sm:px-3 h-auto rounded-md transition-colors",
              collapsed ? "justify-center" : "justify-start"
            )}
            variant="ghost"
            size="sm"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="ml-2 text-xs sm:text-sm font-medium">Logout</span>}
          </Button>

          {/* Collapse Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "w-full text-sidebar-foreground hover:bg-sidebar-accent",
              "py-2 sm:py-3 px-2 sm:px-3 h-auto rounded-md transition-colors",
              collapsed ? "justify-center" : "justify-start"
            )}
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span className="ml-2 text-xs sm:text-sm">Collapse</span>}
          </Button>
        </div>

        {/* Logout Confirmation Dialog */}
        <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign Out?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to sign out? You'll need to sign in again to access the dashboard.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (auth?.signOut) {
                    await auth.signOut()
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Sign Out
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </aside>
    </>
  )
}