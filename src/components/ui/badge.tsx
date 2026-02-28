import * as React from "react"

type BadgeVariant = "neutral" | "success" | "warning" | "danger"

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
}

const variants: Record<BadgeVariant, string> = {
  neutral:
    "bg-[color-mix(in_oklab,var(--rs-surface-2)_75%,transparent)] text-[var(--rs-text)] border-[var(--rs-border)]",
  success:
    "bg-[color-mix(in_oklab,var(--rs-success)_18%,transparent)] text-[color-mix(in_oklab,var(--rs-success)_65%,white)] border-[color-mix(in_oklab,var(--rs-success)_30%,transparent)]",
  warning:
    "bg-[color-mix(in_oklab,var(--rs-warning)_18%,transparent)] text-[color-mix(in_oklab,var(--rs-warning)_70%,white)] border-[color-mix(in_oklab,var(--rs-warning)_30%,transparent)]",
  danger:
    "bg-[color-mix(in_oklab,var(--rs-danger)_18%,transparent)] text-[color-mix(in_oklab,var(--rs-danger)_70%,white)] border-[color-mix(in_oklab,var(--rs-danger)_30%,transparent)]",
}

export function Badge({ className = "", variant = "neutral", ...props }: Props) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-medium",
        variants[variant],
        className,
      ].join(" ")}
      {...props}
    />
  )
}
