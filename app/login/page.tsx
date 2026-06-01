"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"


export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState("agent")

  const redirectByRole = (role: string) => {
    switch (role) {
      case "applicant":
        return "/dashboard/applicant"
      case "landlord":
        return "/dashboard/landlord"
      case "agent":
        return "/dashboard/agent"
      case "builder":
        return "/dashboard/builder"
      default:
        return "/"
    }
  }

  const handleLogin = () => {
    localStorage.setItem("userRole", role)
    const path = redirectByRole(role)
    router.push(path)
  }

  return (
    <div className="login-container">
      <h1 className="login-title">Login</h1>

      <label htmlFor="role">Select Role</label>

      <select
        id="role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        <option value="applicant">Applicant</option>
        <option value="landlord">Landlord</option>
        <option value="agent">Agent</option>
        <option value="builder">Builder</option>
      </select>

      <button
        onClick={handleLogin}
        className="login-button"
      >
        Login
      </button>
    </div>
  )
}