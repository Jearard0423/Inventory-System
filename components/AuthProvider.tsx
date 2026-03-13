"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, firebaseSignOut, database } from "@/lib/firebase"
import { ref, set } from "firebase/database"
import LoginClient from "./LoginClient"

type User = any

const AuthContext = createContext<{
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
} | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  return ctx
}

const IDLE_TIMEOUT_MS  = 5 * 60 * 60 * 1000  // 5 hours
const WARN_BEFORE_MS   = 2 * 60 * 1000        // warn 2 minutes before logout

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown]     = useState(WARN_BEFORE_MS / 1000)

  const idleTimer    = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer    = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAllTimers = () => {
    if (idleTimer.current)    clearTimeout(idleTimer.current)
    if (warnTimer.current)    clearTimeout(warnTimer.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  const resetIdleTimer = React.useCallback(() => {
    clearAllTimers()
    setShowWarning(false)
    setCountdown(WARN_BEFORE_MS / 1000)

    // Show warning 2 min before logout
    warnTimer.current = setTimeout(() => {
      setShowWarning(true)
      let secs = WARN_BEFORE_MS / 1000
      setCountdown(secs)
      countdownRef.current = setInterval(() => {
        secs -= 1
        setCountdown(secs)
        if (secs <= 0 && countdownRef.current) clearInterval(countdownRef.current)
      }, 1000)
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS)

    // Auto-logout after full idle timeout
    idleTimer.current = setTimeout(async () => {
      setShowWarning(false)
      await firebaseSignOut(auth)
    }, IDLE_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
      if (u) {
        resetIdleTimer()
        // Write admin email to RTDB /users so reminder system finds all admins
        if (u.email) {
          set(ref(database, `users/${u.uid}`), {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName || u.email,
            lastSeen: new Date().toISOString(),
          }).catch(() => {})
        }
      }
    })
    return () => unsubscribe()
  }, [])

  // Reset timer on any user activity
  useEffect(() => {
    if (!user) return
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"]
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }))
    resetIdleTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer))
      clearAllTimers()
    }
  }, [user, resetIdleTimer])

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signUp(email: string, password: string) {
    await createUserWithEmailAndPassword(auth, email, password)
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  const value = { user, loading, signIn, signUp, signOut }

  if (loading) return null
  if (!user) return <LoginClient onSignIn={signIn} />

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60

  return (
    <AuthContext.Provider value={value}>
      {children}

      {/* Auto-logout warning dialog */}
      {showWarning && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff", borderRadius: "16px", padding: "32px 28px",
              maxWidth: "420px", width: "100%", textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            {/* Icon */}
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>⏰</div>

            {/* Title */}
            <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 800, color: "#1f2937" }}>
              Still there?
            </h2>

            {/* Subtitle */}
            <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#6b7280" }}>
              You've been inactive for a while.<br />
              You'll be logged out automatically in:
            </p>

            {/* Countdown */}
            <div
              style={{
                display: "inline-block",
                background: countdown <= 30 ? "#fee2e2" : "#fef3c7",
                border: `2px solid ${countdown <= 30 ? "#f87171" : "#f59e0b"}`,
                borderRadius: "12px",
                padding: "12px 28px",
                marginBottom: "24px",
              }}
            >
              <span
                style={{
                  fontSize: "36px", fontWeight: 900, fontVariantNumeric: "tabular-nums",
                  color: countdown <= 30 ? "#dc2626" : "#d97706",
                  fontFamily: "monospace",
                }}
              >
                {mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`}
              </span>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={resetIdleTimer}
                style={{
                  flex: 1, padding: "12px 20px", borderRadius: "10px",
                  background: "#C8333A", color: "#fff",
                  border: "none", cursor: "pointer",
                  fontSize: "15px", fontWeight: 700,
                }}
              >
                I'm still here
              </button>
              <button
                onClick={signOut}
                style={{
                  flex: 1, padding: "12px 20px", borderRadius: "10px",
                  background: "#f3f4f6", color: "#374151",
                  border: "1px solid #e5e7eb", cursor: "pointer",
                  fontSize: "15px", fontWeight: 600,
                }}
              >
                Log out now
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  )
}