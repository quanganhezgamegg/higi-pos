import { useEffect } from "react"
import type { Branding } from "@/lib/api/branding"
import BrandLogo from "@/routes/customer/BrandLogo"

type Props = {
  branding: Branding
  onDone: () => void
}

export default function ThankYouScreen({ branding, onDone }: Props) {
  useEffect(() => {
    const id = window.setTimeout(onDone, 6_000)
    return () => window.clearTimeout(id)
  }, [onDone])

  return (
    <main className="flex h-full w-full flex-col items-center justify-center gap-8 bg-[color:color-mix(in_srgb,var(--brand)_8%,white)] p-12 text-center">
      <BrandLogo branding={branding} className="size-36 text-5xl shadow-sm" />
      <div className="space-y-4">
        <h1 className="text-6xl font-bold tracking-normal text-[var(--brand)]">
          Cam on quy khach!
        </h1>
        <p className="text-3xl font-medium text-slate-600">Hen gap lai</p>
      </div>
    </main>
  )
}
