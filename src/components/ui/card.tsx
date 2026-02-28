import * as React from "react"

type DivProps = React.HTMLAttributes<HTMLDivElement>

export function Card({ className = "", ...props }: DivProps) {
  return (
    <div
      className={[
        "rounded-[var(--radius-rs)] border",
        "bg-[var(--rs-surface)] text-[var(--rs-text)]",
        "border-[var(--rs-border)] shadow-[var(--rs-shadow-sm)]",
        className,
      ].join(" ")}
      {...props}
    />
  )
}

export function CardHeader({ className = "", ...props }: DivProps) {
  return (
    <div className={["px-5 pt-5 pb-3", className].join(" ")} {...props} />
  )
}

export function CardTitle({ className = "", ...props }: DivProps) {
  return (
    <div
      className={[
        "text-[15px] font-semibold tracking-tight",
        className,
      ].join(" ")}
      {...props}
    />
  )
}

export function CardDescription({ className = "", ...props }: DivProps) {
  return (
    <div
      className={[
        "text-[13px] text-[var(--rs-text-muted)]",
        className,
      ].join(" ")}
      {...props}
    />
  )
}

export function CardContent({ className = "", ...props }: DivProps) {
  return <div className={["px-5 pb-5", className].join(" ")} {...props} />
}

export function CardFooter({ className = "", ...props }: DivProps) {
  return <div className={["px-5 pb-5 pt-0", className].join(" ")} {...props} />
}
