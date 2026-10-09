import type { Metadata } from "next"

import {
  BRAND_ACCENT,
  BRAND_INK,
  BRAND_PAPER,
  DoneLockup,
  DoneSymbol,
  DoorwayLockup,
  DoorwaySymbol,
  LetteredLockup,
  LetteredSymbol,
  type LogoProps,
} from "@/components/brand/RentSimpleLogos"

export const metadata: Metadata = {
  title: "Logo concepts · RentSimple",
  robots: { index: false, follow: false },
}

type Concept = {
  number: string
  name: string
  font: string
  thinking: [string, string]
  Lockup: (props: LogoProps) => React.ReactNode
  Symbol: (props: LogoProps) => React.ReactNode
}

const concepts: Concept[] = [
  {
    number: "01",
    name: "Lettered",
    font: "Manrope Bold, converted to outlines (SIL Open Font License)",
    thinking: [
      "A sturdy, tightly set sans with the dot of the i squared off in blue: one small, deliberate detail instead of a picture.",
      "The R and its square become the symbol, so the app icon and the wordmark are the same idea at different sizes.",
    ],
    Lockup: LetteredLockup,
    Symbol: LetteredSymbol,
  },
  {
    number: "02",
    name: "Doorway",
    font: "Figtree SemiBold, converted to outlines (SIL Open Font License)",
    thinking: [
      "A plain frontage, one window and a front door, with no roof and no key: every property you look after, and the way into the shared portal.",
      "Three blocks and nothing fine to lose when it shrinks, so it still reads as a favicon at 16px.",
    ],
    Lockup: DoorwayLockup,
    Symbol: DoorwaySymbol,
  },
  {
    number: "03",
    name: "Done",
    font: "Source Sans 3 Medium, converted to outlines (SIL Open Font License)",
    thinking: [
      "A box with the tick breaking out of one corner: the repair reported, sorted and signed off.",
      "The open corner stops it reading as a form field and gives the mark a little forward movement.",
    ],
    Lockup: DoneLockup,
    Symbol: DoneSymbol,
  },
]

function Panel({ tone, label, children }: { tone: "light" | "dark"; label: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col">
      <div
        className="flex min-h-48 flex-1 items-center justify-center rounded-2xl border p-8 shadow-sm"
        style={tone === "dark" ? { background: BRAND_INK, borderColor: BRAND_INK } : { background: "#FFFFFF", borderColor: "#E2E8F0" }}
      >
        {children}
      </div>
      <figcaption className="mt-2 text-xs text-slate-500">{label}</figcaption>
    </figure>
  )
}

function BrowserTab({ Symbol, tone }: { Symbol: Concept["Symbol"]; tone: "light" | "dark" }) {
  const isDark = tone === "dark"
  return (
    <div
      className="flex items-center gap-2 rounded-t-md px-3 py-2 text-xs"
      style={{ background: isDark ? "#1E293B" : "#F1F5F9", color: isDark ? "#E2E8F0" : "#334155" }}
    >
      <Symbol height={16} tone={tone} />
      <span>RentSimple · Portal</span>
    </div>
  )
}

function SmallSizes({ Symbol, Lockup, tone }: { Symbol: Concept["Symbol"]; Lockup: Concept["Lockup"]; tone: "light" | "dark" }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-end gap-6">
        <div className="flex flex-col items-center gap-2">
          <Symbol height={32} tone={tone} />
          <span className={tone === "dark" ? "text-[10px] text-slate-400" : "text-[10px] text-slate-500"}>32px</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Symbol height={16} tone={tone} />
          <span className={tone === "dark" ? "text-[10px] text-slate-400" : "text-[10px] text-slate-500"}>16px</span>
        </div>
        <BrowserTab Symbol={Symbol} tone={tone} />
      </div>
      <Lockup height={32} tone={tone} />
    </div>
  )
}

export default function BrandExplorePage() {
  return (
    <div className="bg-slate-100 py-14 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Brand / explore</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Three logo concepts</h1>
          <p className="mt-4 leading-7 text-slate-600">
            Plain, calm, competent, local, in the platform&apos;s colours. Each concept uses two flat colours at most: navy{" "}
            <span className="inline-block h-3 w-3 rounded-sm align-middle" style={{ background: BRAND_INK }} /> {BRAND_INK} and blue{" "}
            <span className="inline-block h-3 w-3 rounded-sm align-middle" style={{ background: BRAND_ACCENT }} /> {BRAND_ACCENT}, reversed to{" "}
            {BRAND_PAPER} on dark. All lettering is outlined paths, so nothing depends on a font being installed.
          </p>
        </header>

        {concepts.map(({ number, name, font, thinking, Lockup, Symbol }) => (
          <section key={number} className="mt-16 border-t border-slate-200 pt-10" aria-labelledby={`concept-${number}`}>
            <div className="grid gap-6 lg:grid-cols-[1fr_2fr] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Concept {number}</p>
                <h2 id={`concept-${number}`} className="mt-2 text-2xl font-bold">{name}</h2>
                <p className="mt-2 text-xs text-slate-500">{font}</p>
              </div>
              <div className="space-y-1 leading-7 text-slate-700">
                <p>{thinking[0]}</p>
                <p>{thinking[1]}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <Panel tone="light" label="Large, on white">
                <Lockup height={88} />
              </Panel>
              <Panel tone="dark" label="Large, on dark">
                <Lockup height={88} tone="dark" />
              </Panel>
              <Panel tone="light" label="Single colour, on white">
                <div className="flex items-center gap-8"><Symbol height={72} mono /><Lockup height={40} mono /></div>
              </Panel>
              <Panel tone="dark" label="Single colour, on dark">
                <div className="flex items-center gap-8"><Symbol height={72} tone="dark" mono /><Lockup height={40} tone="dark" mono /></div>
              </Panel>
              <Panel tone="light" label="Small: symbol at 32px and 16px, browser tab, lockup at 32px">
                <SmallSizes Symbol={Symbol} Lockup={Lockup} tone="light" />
              </Panel>
              <Panel tone="dark" label="Small, on dark">
                <SmallSizes Symbol={Symbol} Lockup={Lockup} tone="dark" />
              </Panel>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
