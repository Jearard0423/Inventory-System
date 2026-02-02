"use client"

import { useAuth } from "./AuthProvider"
import { LogOut } from "lucide-react"
import { useState } from "react"

export function ProfileHeader() {
  const ctx = useAuth()
  const user = ctx?.user ?? null
  const signOut = ctx?.signOut ?? null
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  if (!user || !signOut) return null

  const email = user.email || "Admin"
  const initials = email
    .split("@")[0]
    .split(".")
    .map((part: string) => part[0].toUpperCase())
    .join("")

  const handleLogout = async () => {
    setShowLogoutConfirm(false)
    await signOut()
  }

  return (
    <div style={{
      position: "sticky",
      top: 0,
      display: "flex",
      alignItems: "center",
      gap: 16,
      zIndex: 40,
      background: "white",
      padding: "12px 24px",
      borderBottom: "1px solid #e5e7eb",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      marginBottom: 16
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #eab308, #fb923c)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          fontSize: 14
        }}>
          {initials}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#111827"
          }}>
            {email.split("@")[0]}
          </div>
          <div style={{
            fontSize: 12,
            color: "#6b7280"
          }}>
            {email}
          </div>
        </div>
      </div>
      <button
        onClick={() => setShowLogoutConfirm(true)}
        style={{
          padding: "8px 12px",
          background: "#f3f4f6",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: "#6b7280",
          transition: "all 150ms ease"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#e5e7eb"
          e.currentTarget.style.color = "#111827"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#f3f4f6"
          e.currentTarget.style.color = "#6b7280"
        }}
      >
        <LogOut size={16} />
        Logout
      </button>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50
        }}>
          <div style={{
            background: "white",
            borderRadius: 12,
            padding: 24,
            maxWidth: 400,
            width: "90%",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 8,
              color: "#111827"
            }}>
              Sign Out?
            </h3>
            <p style={{
              color: "#6b7280",
              marginBottom: 24,
              fontSize: 14
            }}>
              Are you sure you want to sign out? You'll need to sign in again to access the dashboard.
            </p>
            <div style={{
              display: "flex",
              gap: 12
            }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1,
                  padding: 10,
                  background: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 150ms ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#e5e7eb"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#f3f4f6"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 1,
                  padding: 10,
                  background: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 150ms ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#b91c1c"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#dc2626"
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
