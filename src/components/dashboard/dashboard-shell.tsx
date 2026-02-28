"use client"

import React from "react"

export function DashboardShell(props: { title: string; userId?: string; children: React.ReactNode }) {
  const { title, userId, children } = props

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {userId ? (
          <p className="text-sm text-gray-600">
            Dev user: <span className="font-mono">{userId}</span>
          </p>
        ) : null}
      </header>

      {children}
    </main>
  )
}
