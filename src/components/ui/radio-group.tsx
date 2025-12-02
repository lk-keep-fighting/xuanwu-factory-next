"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface RadioGroupContextValue {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({})

export interface RadioGroupProps {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, onValueChange, disabled = false, className, children }, ref) => {
    return (
      <RadioGroupContext.Provider value={{ value, onValueChange, disabled }}>
        <div ref={ref} role="radiogroup" className={cn("grid gap-2", className)}>
          {children}
        </div>
      </RadioGroupContext.Provider>
    )
  }
)
RadioGroup.displayName = "RadioGroup"

export interface RadioGroupItemProps {
  value: string
  id?: string
  disabled?: boolean
  className?: string
}

const RadioGroupItem = React.forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  ({ value, id, disabled: itemDisabled, className }, ref) => {
    const context = React.useContext(RadioGroupContext)
    const isChecked = context.value === value
    const isDisabled = itemDisabled || context.disabled

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        id={id}
        aria-checked={isChecked}
        disabled={isDisabled}
        className={cn(
          "aspect-square h-4 w-4 rounded-full border border-gray-300 text-blue-600",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isChecked && "border-blue-600 bg-blue-600",
          className
        )}
        onClick={() => {
          if (!isDisabled && context.onValueChange) {
            context.onValueChange(value)
          }
        }}
      >
        {isChecked && (
          <span className="flex items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-white" />
          </span>
        )}
      </button>
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
