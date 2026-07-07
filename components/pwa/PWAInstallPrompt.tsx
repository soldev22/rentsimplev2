"use client"

import { useEffect, useState } from "react"

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Handle the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    // Handle app installed
    const handleAppInstalled = () => {
      setInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
      console.log("PWA was installed")
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true)
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log(`User response: ${outcome}`)

    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  if (installed || !showPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white rounded-lg shadow-lg p-4 max-w-sm">
      <p className="text-sm font-medium mb-3">
        Install RentSimple on your device for quick access
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleInstall}
          className="flex-1 bg-white text-blue-600 px-4 py-2 rounded font-medium text-sm hover:bg-blue-50"
        >
          Install
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="px-4 py-2 rounded font-medium text-sm hover:bg-blue-700"
        >
          Later
        </button>
      </div>
    </div>
  )
}
