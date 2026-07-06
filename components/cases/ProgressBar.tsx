"use client"

import { useEffect, useRef } from "react"
import styles from "./ProgressBar.module.css"

export function ProgressBar({ percentage }: { percentage: number }) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage))
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.setProperty("--progress-width", `${clampedPercentage}%`)
    }
  }, [clampedPercentage])

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.fill} />
    </div>
  )
}
