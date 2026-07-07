"use client"

import { useRef, useState, useEffect } from "react"

interface CameraCaptureProps {
  onPhotoCapture: (blob: Blob) => void
  onCancel: () => void
}

export function CameraCapture({ onPhotoCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const startCamera = async () => {
      try {
        setIsLoading(true)
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          setStream(mediaStream)
        }
      } catch (err) {
        setError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Camera access denied. Check your browser permissions."
            : "Unable to access camera. Please check your device.",
        )
      } finally {
        setIsLoading(false)
      }
    }

    startCamera()

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const context = canvasRef.current.getContext("2d")
    if (!context) return

    canvasRef.current.width = videoRef.current.videoWidth
    canvasRef.current.height = videoRef.current.videoHeight
    context.drawImage(videoRef.current, 0, 0)

    canvasRef.current.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        setCapturedImage(url)
      }
    }, "image/jpeg")
  }

  const confirmCapture = () => {
    if (!canvasRef.current) return

    canvasRef.current.toBlob((blob) => {
      if (blob) {
        onPhotoCapture(blob)
        setCapturedImage(null)
      }
    }, "image/jpeg")
  }

  const retakePhoto = () => {
    setCapturedImage(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
        {error ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
            <button
              onClick={onCancel}
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        ) : capturedImage ? (
          <div className="space-y-4">
            <img src={capturedImage} alt="Captured" className="w-full rounded-lg" />
            <div className="flex gap-2">
              <button
                onClick={retakePhoto}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50"
              >
                Retake
              </button>
              <button
                onClick={confirmCapture}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
              >
                Use Photo
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex h-96 items-center justify-center bg-slate-100">
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
                  <p className="mt-2 text-sm text-slate-600">Starting camera...</p>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full rounded-lg bg-black"
                />
                <canvas ref={canvasRef} className="hidden" />
              </>
            )}
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={capturePhoto}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                📷 Capture
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
