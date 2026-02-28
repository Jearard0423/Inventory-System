/**
 * Offline detection and error boundary
 * This file provides hooks and utilities for detecting offline state
 */

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Hook to detect offline state and redirect to offline page
 */
export function useOfflineDetection() {
  const [isOffline, setIsOffline] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check initial state
    setIsOffline(!navigator.onLine)

    const handleOnline = () => {
      setIsOffline(false)
    }

    const handleOffline = () => {
      setIsOffline(true)
      // Redirect to offline page
      router.push('/offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [router])

  return isOffline
}

/**
 * Offline Error Boundary Component
 */
export function OfflineErrorBoundary({ children }: { children: React.ReactNode }) {
  const isOffline = useOfflineDetection()

  if (isOffline) {
    return null // Router will handle the redirect
  }

  return <>{children}</>
}

