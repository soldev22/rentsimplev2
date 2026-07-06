"use client"

import type {
  TenantCommunicationChannel,
  TenantCommunicationDirection,
  TenantCommunicationEntry,
} from "@/lib/auth"

type CommunicationDraft = {
  occurredAt: string
  channel: TenantCommunicationChannel
  direction: TenantCommunicationDirection
  subject: string
  summary: string
}

type TenantCommunicationThreadProps = {
  entries: TenantCommunicationEntry[]
  draft?: CommunicationDraft
  onDraftChange?: <Key extends keyof CommunicationDraft>(field: Key, value: CommunicationDraft[Key]) => void
  onAddEntry?: () => void
  title?: string
  description?: string
  emptyMessage?: string
}

const communicationChannelOptions: Array<{ value: TenantCommunicationChannel; label: string }> = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "portal", label: "Portal" },
  { value: "letter", label: "Letter" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Other" },
]

const communicationDirectionOptions: Array<{ value: TenantCommunicationDirection; label: string }> = [
  { value: "outbound", label: "Outbound to tenant" },
  { value: "inbound", label: "Inbound from tenant" },
]

function getChannelLabel(channel: TenantCommunicationChannel) {
  return communicationChannelOptions.find((option) => option.value === channel)?.label ?? channel
}

function getDirectionLabel(direction: TenantCommunicationDirection) {
  return communicationDirectionOptions.find((option) => option.value === direction)?.label ?? direction
}

function getBubbleClasses(direction: TenantCommunicationDirection) {
  return direction === "outbound"
    ? "ml-auto border-slate-900 bg-slate-900 text-white"
    : "mr-auto border-slate-200 bg-white text-slate-900"
}

function getMetaClasses(direction: TenantCommunicationDirection) {
  return direction === "outbound" ? "text-cyan-100" : "text-cyan-700"
}

function getNotificationBadgeClasses(direction: TenantCommunicationDirection, status: string) {
  if (status === "sent") {
    return direction === "outbound"
      ? "border border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
      : "border border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  if (status === "failed") {
    return direction === "outbound"
      ? "border border-rose-300/40 bg-rose-400/10 text-rose-100"
      : "border border-rose-200 bg-rose-50 text-rose-700"
  }

  return direction === "outbound"
    ? "border border-amber-300/40 bg-amber-400/10 text-amber-100"
    : "border border-amber-200 bg-amber-50 text-amber-700"
}

function getNotificationLabel(entry: TenantCommunicationEntry) {
  const notification = entry.notification

  if (!notification || entry.direction !== "outbound") {
    return null
  }

  if (notification.status === "sent") {
    return `${(notification.channel ?? entry.channel).toUpperCase()} sent`
  }

  if (notification.status === "failed") {
    return `${(notification.channel ?? entry.channel).toUpperCase()} failed`
  }

  if (notification.status === "skipped") {
    return `${(notification.channel ?? entry.channel).toUpperCase()} skipped`
  }

  return null
}

function getNotificationRoutingSummary(entry: TenantCommunicationEntry) {
  const notification = entry.notification

  if (!notification || entry.direction !== "outbound" || notification.channel !== "email") {
    return [] as string[]
  }

  const lines: string[] = []

  if (notification.fromAddress) {
    lines.push(`From: ${notification.fromAddress}`)
  }

  if (notification.replyTo && notification.replyTo !== notification.fromAddress) {
    lines.push(`Reply-to: ${notification.replyTo}`)
  }

  if (notification.copiedTo && notification.copiedTo.length > 0) {
    lines.push(`Copied to landlord: ${notification.copiedTo.join(", ")}`)
  }

  return lines
}

export default function TenantCommunicationThread({
  entries,
  draft,
  onDraftChange,
  onAddEntry,
  title = "Conversation thread",
  description = "Record calls, messages, and other contact in one chronological thread.",
  emptyMessage = "No communication has been recorded yet.",
}: TenantCommunicationThreadProps) {
  const canCompose = Boolean(draft && onDraftChange && onAddEntry)
  const composerDraft = canCompose ? draft : undefined
  const handleDraftChange = canCompose ? onDraftChange : undefined
  const handleAddEntry = canCompose ? onAddEntry : undefined

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          {entries.length} entr{entries.length === 1 ? "y" : "ies"}
        </div>
      </div>

      {canCompose && composerDraft && handleDraftChange && handleAddEntry ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Date and time
              <input
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                type="datetime-local"
                value={composerDraft.occurredAt}
                onChange={(event) => handleDraftChange("occurredAt", event.target.value)}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Channel
              <select
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                value={composerDraft.channel}
                onChange={(event) => handleDraftChange("channel", event.target.value as TenantCommunicationChannel)}
                aria-label="Select communication channel"
                title="Select the communication channel (email, phone, SMS, etc.)"
              >
                {communicationChannelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Direction
              <select
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                value={composerDraft.direction}
                onChange={(event) => handleDraftChange("direction", event.target.value as TenantCommunicationDirection)}
                aria-label="Select communication direction"
                title="Select whether this is incoming or outgoing communication"
              >
                {communicationDirectionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Subject
              <input
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                value={composerDraft.subject}
                onChange={(event) => handleDraftChange("subject", event.target.value)}
                placeholder="Phone call, rent reminder, repair update"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700 md:col-span-2">
              Message or note
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
                value={composerDraft.summary}
                onChange={(event) => handleDraftChange("summary", event.target.value)}
                placeholder="Capture what was said, any commitments made, and the next step."
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="flex flex-col items-end gap-2">
              <div className="text-xs text-slate-500">Outbound email and SMS entries will attempt delivery when the tenancy record is saved.</div>
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={handleAddEntry}
              >
                Add to conversation
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className={`flex ${entry.direction === "outbound" ? "justify-end" : "justify-start"}`}>
              <article className={`max-w-3xl rounded-2xl border px-4 py-4 shadow-sm ${getBubbleClasses(entry.direction)}`}>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold">{entry.subject}</div>
                    <div className={`mt-1 text-xs uppercase tracking-[0.16em] ${getMetaClasses(entry.direction)}`}>
                      {getDirectionLabel(entry.direction)} · {getChannelLabel(entry.channel)}
                    </div>
                    {getNotificationLabel(entry) ? (
                      <div
                        className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getNotificationBadgeClasses(entry.direction, entry.notification?.status ?? "skipped")}`}
                      >
                        {getNotificationLabel(entry)}
                      </div>
                    ) : null}
                  </div>
                  <div className={`text-xs ${entry.direction === "outbound" ? "text-slate-300" : "text-slate-500"}`}>
                    {new Date(entry.occurredAt).toLocaleString()} · {entry.recordedByName}
                  </div>
                </div>
                <p className={`mt-3 whitespace-pre-wrap text-sm ${entry.direction === "outbound" ? "text-slate-100" : "text-slate-700"}`}>
                  {entry.summary}
                </p>
                {entry.notification?.detail ? (
                  <div className={`mt-3 space-y-1 text-xs ${entry.direction === "outbound" ? "text-slate-300" : "text-slate-500"}`}>
                    <p>{entry.notification.detail}</p>
                    {getNotificationRoutingSummary(entry).map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                ) : null}
              </article>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}