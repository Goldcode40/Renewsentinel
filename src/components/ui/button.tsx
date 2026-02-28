import * as React from "react"

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
type ButtonSize = "sm" | "md" | "lg"

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-rs-sm)] " +
  "font-medium transition active:translate-y-[0.5px] disabled:opacity-50 disabled:pointer-events-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--rs-primary)_45%,transparent)] " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--rs-bg)]"

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-[13px]",
  lg: "h-10 px-5 text-[14px]",
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--rs-primary)] text-white shadow-[var(--rs-shadow-sm)] " +
    "hover:bg-[var(--rs-primary-2)]",
  secondary:
    "bg-[var(--rs-surface-2)] text-[var(--rs-text)] border border-[var(--rs-border)] " +
    "hover:bg-[color-mix(in_oklab,var(--rs-surface-2)_85%,white)]",
  ghost:
    "bg-transparent text-[var(--rs-text)] hover:bg-[color-mix(in_oklab,var(--rs-surface)_70%,transparent)]",
  danger:
    "bg-[var(--rs-danger)] text-white shadow-[var(--rs-shadow-sm)] hover:brightness-110",
}

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  return (
    <button
      className={[base, sizes[size], variants[variant], className].join(" ")}
      {...props}
    />
  )
}
