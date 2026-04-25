"use client"

import dynamic from "next/dynamic"

const TACAppShell = dynamic(
  () => import("@/components/tac/app-shell").then((mod) => mod.TACAppShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading workspace…
      </div>
    ),
  },
)

export default function Page() {
  return <TACAppShell />
}
