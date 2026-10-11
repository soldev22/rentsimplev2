"use client"

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react"
import MeetingRequestForm from "@/components/forms/MeetingRequestForm"

const MeetingPanelContext = createContext<(() => void) | null>(null)

export function MeetingRequestButton({ className = "" }: { className?: string }) {
  const open = useContext(MeetingPanelContext)
  if (!open) throw new Error("MeetingRequestButton requires MeetingRequestProvider.")
  return <button type="button" onClick={open} aria-haspopup="dialog" className={className}>Request a meeting</button>
}

export function MeetingRequestProvider({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const id = useId()

  useEffect(() => {
    if (!open || !dialog.current) return
    const panel = dialog.current
    const previousOverflow = document.body.style.overflow
    panel.showModal()
    document.body.style.overflow = "hidden"
    panel.querySelector<HTMLInputElement>('input[name="firstName"]')?.focus()
    return () => {
      panel.close()
      document.body.style.overflow = previousOverflow
      if (trigger.current?.isConnected) trigger.current.focus()
    }
  }, [open])

  function show() {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setConfirmed(false)
    setOpen(true)
  }

  return (
    <MeetingPanelContext.Provider value={show}>
      {children}
      {open ? (
        <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={confirmed ? undefined : `${id}-intro`}
          onCancel={(event) => { event.preventDefault(); setOpen(false) }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              event.stopPropagation()
              setOpen(false)
            }
          }}
          className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-xl overflow-y-auto border-0 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-900/50 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <h2 id={`${id}-title`} className="text-2xl font-bold">{confirmed ? "Meeting request received" : "Request a meeting"}</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close meeting request panel"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2">Close</button>
          </div>
          {!confirmed ? <p id={`${id}-intro`} className="mb-6 mt-3 text-sm text-slate-600">Tell us about your properties and when you&apos;re available. We&apos;ll contact you to agree the details.</p> : null}
          <div className={confirmed ? "mt-6" : ""}>
            <MeetingRequestForm onSuccess={() => setConfirmed(true)} />
          </div>
        </dialog>
      ) : null}
    </MeetingPanelContext.Provider>
  )
}
