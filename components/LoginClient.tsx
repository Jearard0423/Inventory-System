"use client"

import React, { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

export default function LoginClient({ onSignIn, onSignUp }: { onSignIn: (e: string, p: string) => Promise<void>, onSignUp?: (e: string, p: string) => Promise<void> }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)

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

  async function handleSignUp() {
    setError(null)
    
    // Validation
    if (!email.trim()) {
      setError("Email is required")
      return
    }
    
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    // Check if email is from yellow roast domain (verification)
    if (!email.includes('@yellowroastco') && email !== 'yellowroastco2024@gmail.com') {
      setError("Only Yellow Roast Co. staff members can create accounts. Please use your company email.")
      return
    }

    setLoading(true)
    try {
      if (onSignUp) {
        await onSignUp(email, password)
        setVerificationSent(true)
        setEmail("")
        setPassword("")
        setConfirmPassword("")
        setTimeout(() => {
          setVerificationSent(false)
          setIsSignUp(false)
        }, 3000)
      }
    } catch (err: any) {
      setError(err?.message || "Sign up failed")
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
          {isSignUp ? 'Create Account' : 'Sign In'}
        </h2>
        <p style={{
          margin: 0,
          marginBottom: 24,
          fontSize: '0.95rem',
          color: '#6b7280',
          textAlign: 'center'
        }}>
          {isSignUp ? 'Join Yellow Roast Co.' : 'Access the Dashboard'}
        </p>

        {/* Success Message */}
        {verificationSent && (
          <div style={{
            background: '#dcfce7',
            color: '#166534',
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
            fontSize: '0.875rem',
            border: '1px solid #bbf7d0',
            width: '100%',
            textAlign: 'center'
          }}>
            Account created! Please check your email to verify.
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
            fontSize: '0.875rem',
            border: '1px solid #fecaca',
            width: '100%'
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

        {/* Password Input with Visibility Toggle */}
        <div style={{
          width: '100%',
          position: 'relative',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center'
        }}>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type={showPassword ? "text" : "password"}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem 2.5rem 0.75rem 0.75rem',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              fontSize: '0.95rem',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              transition: 'border-color 150ms ease',
              paddingRight: '2.5rem'
            }}
            onFocus={(e) => e.target.style.borderColor = '#eab308'}
            onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            onKeyPress={(e) => e.key === 'Enter' && !loading && (isSignUp ? handleSignUp() : handleSignIn())}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={loading}
            style={{
              position: 'absolute',
              right: '0.75rem',
              background: 'none',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6b7280'
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.color = '#eab308')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.color = '#6b7280')}
          >
            {showPassword ? (
              <EyeOff size={20} />
            ) : (
              <Eye size={20} />
            )}
          </button>
        </div>

        {/* Confirm Password Input (Sign Up only) */}
        {isSignUp && (
          <div style={{
            width: '100%',
            position: 'relative',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center'
          }}>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              type={showConfirmPassword ? "text" : "password"}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem 2.5rem 0.75rem 0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                fontSize: '0.95rem',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                transition: 'border-color 150ms ease',
                paddingRight: '2.5rem'
              }}
              onFocus={(e) => e.target.style.borderColor = '#eab308'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              onKeyPress={(e) => e.key === 'Enter' && !loading && handleSignUp()}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={loading}
              style={{
                position: 'absolute',
                right: '0.75rem',
                background: 'none',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                padding: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280'
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.color = '#eab308')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.color = '#6b7280')}
            >
              {showConfirmPassword ? (
                <EyeOff size={20} />
              ) : (
                <Eye size={20} />
              )}
            </button>
          </div>
        )}

        {!isSignUp && (
          <div style={{ marginBottom: 24 }} />
        )}

        {/* Sign In / Sign Up Button */}
        <button
          onClick={isSignUp ? handleSignUp : handleSignIn}
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
          {loading ? (isSignUp ? 'Creating Account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In')}
        </button>

        {/* Toggle Sign In / Sign Up */}
        <p style={{
          textAlign: 'center',
          marginTop: 16,
          fontSize: '0.85rem',
          color: '#6b7280'
        }}>
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
              setEmail("")
              setPassword("")
              setConfirmPassword("")
            }}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: '#eab308',
              cursor: loading ? 'not-allowed' : 'pointer',
              textDecoration: 'underline',
              fontSize: 'inherit',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.color = '#d97706')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.color = '#eab308')}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>

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
