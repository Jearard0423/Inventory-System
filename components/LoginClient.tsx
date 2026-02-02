"use client"

import React, { useState } from "react"

export default function LoginClient({ onSignIn }: { onSignIn: (e: string, p: string) => Promise<void> }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    setError(null)
    setLoading(true)
    try {
      await onSignIn(email, password)
    } catch (err: any) {
      setError(err?.message || "Sign in failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f9fafb',
      padding: '1.5rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        width: 420,
        maxWidth: '100%',
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '32px 48px 48px 48px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* YRC Logo */}
        <div style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'center'
        }}>
          <img 
            src="/yrc-logo.png" 
            alt="YRC Logo" 
            style={{
              height: 100,
              width: 'auto',
              maxWidth: '100%'
            }}
          />
        </div>

        {/* Heading */}
        <h2 style={{
          margin: 0,
          marginBottom: 8,
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#111827',
          textAlign: 'center'
        }}>
          Sign In
        </h2>
        <p style={{
          margin: 0,
          marginBottom: 24,
          fontSize: '0.95rem',
          color: '#6b7280',
          textAlign: 'center'
        }}>
          Access the Dashboard
        </p>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
            fontSize: '0.875rem',
            border: '1px solid #fecaca'
          }}>
            {error}
          </div>
        )}

        {/* Email Input */}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          type="email"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            marginBottom: 12,
            fontSize: '0.95rem',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            transition: 'border-color 150ms ease'
          }}
          onFocus={(e) => e.target.style.borderColor = '#eab308'}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />

        {/* Password Input */}
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            marginBottom: 24,
            fontSize: '0.95rem',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            transition: 'border-color 150ms ease'
          }}
          onFocus={(e) => e.target.style.borderColor = '#eab308'}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />

        {/* Sign In Button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: loading ? '#fde047' : '#eab308',
            color: '#111827',
            border: 'none',
            borderRadius: 6,
            fontWeight: 500,
            fontSize: '0.95rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background-color 150ms ease',
            boxShadow: '0 1px 2px 0 rgba(234, 179, 8, 0.2)'
          }}
          onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#fde047')}
          onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#eab308')}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          marginTop: 24,
          fontSize: '0.85rem',
          color: '#9ca3af'
        }}>
          Yellowbell Roast Co. © 2024
        </p>
      </div>
    </div>
  )
}
