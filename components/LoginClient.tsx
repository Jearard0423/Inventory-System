"use client"

import React, { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

export default function LoginClient({ onSignIn }: { onSignIn: (e: string, p: string) => Promise<void>, onSignUp?: (e: string, p: string) => Promise<void> }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    setError(null)
    if (!email.trim()) { setError("Email is required"); return }
    if (!password) { setError("Password is required"); return }
    setLoading(true)
    try {
      await onSignIn(email, password)
    } catch (err: any) {
      const msg = err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password' || err?.code === 'auth/user-not-found'
        ? "Invalid email or password"
        : err?.message || "Sign in failed"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f9fafb', padding: '1.5rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        width: 420, maxWidth: '100%', background: 'white', border: '1px solid #e5e7eb',
        borderRadius: 12, padding: '32px 48px 48px 48px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <img 
            src="/yrc-logo.png" 
            alt="YRC Logo" 
            style={{ height: 100, width: 'auto', maxWidth: '100%' }}
            onError={(e) => { (e.target as HTMLImageElement).src = '/yrclogo.jpg' }}
          />
        </div>

        <h2 style={{ margin: 0, marginBottom: 4, fontSize: '1.5rem', fontWeight: 700, color: '#111827', textAlign: 'center' }}>
          Welcome Back
        </h2>
        <p style={{ margin: 0, marginBottom: 28, fontSize: '0.9rem', color: '#6b7280', textAlign: 'center' }}>
          Yellowbell Roast Co. — Inventory System
        </p>

        {error && (
          <div style={{
            background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 6,
            marginBottom: 16, fontSize: '0.875rem', border: '1px solid #fecaca', width: '100%'
          }}>
            {error}
          </div>
        )}

        {/* Email */}
        <input
          value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Email address" type="email" disabled={loading}
          style={{
            width: '100%', padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 6,
            marginBottom: 12, fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit'
          }}
          onFocus={e => e.target.style.borderColor = '#dc2626'}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          onKeyDown={e => e.key === 'Enter' && !loading && handleSignIn()}
        />

        {/* Password */}
        <div style={{ width: '100%', position: 'relative', marginBottom: 28 }}>
          <input
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" type={showPassword ? "text" : "password"} disabled={loading}
            style={{
              width: '100%', padding: '0.75rem 2.5rem 0.75rem 0.75rem', border: '1px solid #e5e7eb',
              borderRadius: 6, fontSize: '0.95rem', boxSizing: 'border-box', fontFamily: 'inherit'
            }}
            onFocus={e => e.target.style.borderColor = '#dc2626'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            onKeyDown={e => e.key === 'Enter' && !loading && handleSignIn()}
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} disabled={loading}
            style={{
              position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex'
            }}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button onClick={handleSignIn} disabled={loading}
          style={{
            width: '100%', padding: '0.75rem', background: loading ? '#fca5a5' : '#dc2626',
            color: 'white', border: 'none', borderRadius: 6, fontWeight: 600,
            fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 150ms'
          }}
          onMouseEnter={e => !loading && (e.currentTarget.style.background = '#b91c1c')}
          onMouseLeave={e => !loading && (e.currentTarget.style.background = '#dc2626')}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: '0.8rem', color: '#9ca3af' }}>
          Yellowbell Roast Co. © 2024
        </p>
      </div>
    </div>
  )
}