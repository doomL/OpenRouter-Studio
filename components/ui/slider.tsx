"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  className?: string
  value?: number[]
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number | readonly number[]) => void
  disabled?: boolean
}

function Slider({
  className,
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  disabled,
}: SliderProps) {
  const currentValue = value?.[0] ?? defaultValue?.[0] ?? min

  return (
    <input
      type="range"
      data-slot="slider"
      min={min}
      max={max}
      step={step}
      value={currentValue}
      disabled={disabled}
      onChange={(e) => {
        const v = parseFloat(e.target.value)
        onValueChange?.(v)
      }}
      className={cn(
        "w-full h-1 appearance-none rounded-full bg-muted cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-ring [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-pointer",
        "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-ring [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:cursor-pointer",
        className
      )}
    />
  )
}

export { Slider }
