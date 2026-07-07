"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Only register in production
    if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_FORCE_SW) {
      return
    }

    if (!("serviceWorker" in navigator)) {
      console.warn("Service Workers are not supported in this browser")
      return
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        })

        console.log("Service Worker registered successfully:", registration)

        // Check for updates periodically
        setInterval(() => {
          registration.update()
        }, 60000) // Check every minute

        // Handle service worker updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              console.log("New Service Worker available, refresh to update")
              // You can show a notification here or auto-refresh
            }
          })
        })
      } catch (error) {
        console.error("Service Worker registration failed:", error)
      }
    }

    // Register after a short delay to ensure app is ready
    setTimeout(registerSW, 1000)
  }, [])

  return null
}
