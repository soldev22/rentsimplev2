import { figtreeWordmark, sansWordmark, letteredR, letteredWordmark } from "@/components/brand/wordmarkOutlines"

export const BRAND_INK = "#0F172A"
export const BRAND_ACCENT = "#2563EB"
export const BRAND_PAPER = "#FFFFFF"

export type LogoProps = {
  height: number
  /** Background the logo sits on. */
  tone?: "light" | "dark"
  /** Single-colour version. */
  mono?: boolean
}

function getColors(tone: LogoProps["tone"], mono: LogoProps["mono"]) {
  const primary = tone === "dark" ? BRAND_PAPER : BRAND_INK
  return { primary, accent: mono ? primary : BRAND_ACCENT }
}

function Svg({ height, viewBox, children }: { height: number; viewBox: [number, number, number, number]; children: React.ReactNode }) {
  const [, , width, viewHeight] = viewBox
  return (
    <svg
      role="img"
      aria-label="RentSimple"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox.join(" ")}
      height={height}
      width={(height * width) / viewHeight}
      style={{ display: "block", maxWidth: "100%", height: "auto", flexShrink: 0 }}
    >
      {children}
    </svg>
  )
}

// Symbols share a 32-unit grid; lockups scale them to 86 wordmark units, centred on the cap height.
const SYMBOL_SIZE = 86
const SYMBOL_TOP = -78
const SYMBOL_GAP = 28

// ---------- 01 Lettered ----------

const LETTERED_DOT_SIZE = 14
const letteredDotX = (letteredWordmark.dot.x1 + letteredWordmark.dot.x2) / 2 - LETTERED_DOT_SIZE / 2
const letteredDotY = (letteredWordmark.dot.y1 + letteredWordmark.dot.y2) / 2 - LETTERED_DOT_SIZE / 2

export function LetteredSymbol({ height, tone, mono }: LogoProps) {
  const { primary, accent } = getColors(tone, mono)
  return (
    <Svg height={height} viewBox={[0, -80, 88, 88]}>
      <path d={letteredR.d} fill={primary} />
      <rect x={67} y={-72} width={LETTERED_DOT_SIZE} height={LETTERED_DOT_SIZE} fill={accent} />
    </Svg>
  )
}

export function LetteredLockup({ height, tone, mono }: LogoProps) {
  const { primary, accent } = getColors(tone, mono)
  const { x1, x2 } = letteredWordmark.bbox
  return (
    <Svg height={height} viewBox={[x1 - 2, -80, x2 - x1 + 4, 105]}>
      <path d={letteredWordmark.d} fill={primary} />
      <rect x={letteredDotX} y={letteredDotY} width={LETTERED_DOT_SIZE} height={LETTERED_DOT_SIZE} fill={accent} />
    </Svg>
  )
}

// ---------- 02 Doorway ----------

// A plain frontage: one window and a front door, cut out of a single block.
const doorwayBlock = "M6 0H26A6 6 0 0 1 32 6V26A6 6 0 0 1 26 32H24V12H16V32H6A6 6 0 0 1 0 26V6A6 6 0 0 1 6 0ZM6 12H11V17H6Z"

function DoorwayShapes({ tone, mono }: Omit<LogoProps, "height">) {
  const { primary, accent } = getColors(tone, mono)
  return (
    <>
      <path d={doorwayBlock} fill={primary} fillRule="evenodd" />
      {mono ? null : (
        <>
          <rect x={16} y={12} width={8} height={20} fill={accent} />
          <rect x={6} y={12} width={5} height={5} fill={accent} />
        </>
      )}
    </>
  )
}

export function DoorwaySymbol({ height, tone, mono }: LogoProps) {
  return (
    <Svg height={height} viewBox={[0, 0, 32, 32]}>
      <DoorwayShapes tone={tone} mono={mono} />
    </Svg>
  )
}

export function DoorwayLockup({ height, tone, mono }: LogoProps) {
  const { primary } = getColors(tone, mono)
  const { x1, x2 } = figtreeWordmark.bbox
  const offset = SYMBOL_SIZE + SYMBOL_GAP - x1
  return (
    <Svg height={height} viewBox={[-2, -80, offset + x2 + 4, 105]}>
      <g transform={`translate(0 ${SYMBOL_TOP}) scale(${SYMBOL_SIZE / 32})`}>
        <DoorwayShapes tone={tone} mono={mono} />
      </g>
      <path d={figtreeWordmark.d} fill={primary} transform={`translate(${offset} 0)`} />
    </Svg>
  )
}

// ---------- 03 Done ----------

function DoneShapes({ tone, mono }: Omit<LogoProps, "height">) {
  const { primary, accent } = getColors(tone, mono)
  return (
    <g fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6H6V26H26V15" stroke={primary} />
      <path d="M11 15.5L15.5 20L28 5" stroke={accent} />
    </g>
  )
}

export function DoneSymbol({ height, tone, mono }: LogoProps) {
  return (
    <Svg height={height} viewBox={[0, 0, 32, 32]}>
      <DoneShapes tone={tone} mono={mono} />
    </Svg>
  )
}

export function DoneLockup({ height, tone, mono }: LogoProps) {
  const { primary } = getColors(tone, mono)
  const { x1, x2 } = sansWordmark.bbox
  const offset = SYMBOL_SIZE + SYMBOL_GAP - x1
  return (
    <Svg height={height} viewBox={[-2, -80, offset + x2 + 4, 105]}>
      <g transform={`translate(0 ${SYMBOL_TOP}) scale(${SYMBOL_SIZE / 32})`}>
        <DoneShapes tone={tone} mono={mono} />
      </g>
      <path d={sansWordmark.d} fill={primary} transform={`translate(${offset} 0)`} />
    </Svg>
  )
}
