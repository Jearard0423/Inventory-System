"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, firebaseSignOut } from "@/lib/firebase"
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

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

  // while loading, render nothing to avoid flicker
  if (loading) return <>{children}</>

  // if not authenticated, show login UI
  if (!user) return <LoginClient onSignIn={signIn} />

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
