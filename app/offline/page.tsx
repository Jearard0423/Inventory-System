"use client"

import React, { useEffect, useState } from "react"
import { Wifi, WifiOff, RefreshCw } from "lucide-react"

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Check if online on mount
    setIsOnline(navigator.onLine)

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
      padding: '1.5rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        padding: '48px 32px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* YRC Logo */}
        <div style={{
          marginBottom: 32,
          display: 'flex',
          justifyContent: 'center'
        }}>
          <img 
            src="/yrc-logo.png" 
            alt="YRC Logo" 
            style={{
              height: 120,
              width: 'auto',
              maxWidth: '100%',
              filter: 'opacity(0.8)',
              marginBottom: 24
            }}
          />
        </div>

        {/* Icon */}
        <div style={{
          fontSize: '64px',
          marginBottom: 24,
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
        }}>
          {isOnline ? (
            <Wifi size={64} style={{ color: '#10b981' }} />
          ) : (
            <WifiOff size={64} style={{ color: '#ef4444' }} />
          )}
        </div>

        {/* Heading */}
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: '#111827',
          margin: '0 0 12px 0',
          letterSpacing: '-0.02em'
        }}>
          {isOnline ? 'Connection Restored' : 'No Internet Connection'}
        </h1>

        {/* Description */}
        <p style={{
          fontSize: '1rem',
          color: '#6b7280',
          margin: '0 0 32px 0',
          lineHeight: 1.6
        }}>
          {isOnline 
            ? 'Your connection has been restored. You can now access the dashboard.'
            : 'Please check your internet connection and try again. Yellow Roast Co. Inventory System requires an active connection.'}
        </p>

        {/* Status Message */}
        <div style={{
          background: isOnline ? '#ecfdf5' : '#fef2f2',
          border: `2px solid ${isOnline ? '#d1fae5' : '#fecaca'}`,
          borderRadius: 8,
          padding: 16,
          marginBottom: 32,
          width: '100%'
        }}>
          <p style={{
            margin: 0,
            color: isOnline ? '#065f46' : '#991b1b',
            fontSize: '0.95rem',
            fontWeight: 500
          }}>
            {isOnline 
              ? '✓ Connected to internet'
              : '✗ Offline mode - some features may be unavailable'}
          </p>
        </div>

        {/* Retry Button */}
        <button
          onClick={handleRetry}
          style={{
            width: '100%',
            padding: '0.875rem 1.5rem',
            background: '#eab308',
            color: '#111827',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            boxShadow: '0 4px 6px -1px rgba(234, 179, 8, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fde047'
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(234, 179, 8, 0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#eab308'
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(234, 179, 8, 0.2)'
          }}
        >
          <RefreshCw size={20} />
          {isOnline ? 'Go to Dashboard' : 'Retry Connection'}
        </button>

        {/* Footer Help Text */}
        <p style={{
          fontSize: '0.875rem',
          color: '#9ca3af',
          margin: '32px 0 0 0',
          marginTop: 32
        }}>
          {isOnline
            ? 'If you continue to experience issues, please contact support.'
            : 'Connection issues? Check your WiFi or mobile data and try again.'}
        </p>

        {/* Footer */}
        <p style={{
          fontSize: '0.8rem',
          color: '#d1d5db',
          margin: '16px 0 0 0',
          marginTop: 16
        }}>
          Yellow Roast Co. Inventory System © 2024
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
