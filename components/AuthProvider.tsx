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
  // Return context (may be null) so consumers can handle unauthenticated state safely
  return ctx
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const IDLE_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
  const idleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetIdleTimer = React.useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(async () => {
      await firebaseSignOut(auth)
    }, IDLE_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
      if (u) {
        resetIdleTimer()
        // Write this admin's email to /users/{uid} in RTDB so the reminder
        // system can always find ALL admin emails — even when no one is logged in.
        // This runs on every login/page refresh so the record stays current.
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

  // Auto-logout after 10 min of inactivity
  useEffect(() => {
    if (!user) return
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"]
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }))
    resetIdleTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer))
      if (idleTimer.current) clearTimeout(idleTimer.current)
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

  // while loading, do not render app children — prevents unauthenticated
  // pages from mounting during a hard refresh which caused the dashboard
  // to appear non-functional. Render null (or a loader) until auth state
  // is resolved.
  if (loading) return null

  // if not authenticated, show login UI
  if (!user) return <LoginClient onSignIn={signIn} />

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}