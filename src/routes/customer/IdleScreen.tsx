import { useEffect, useMemo, useState } from "react"
import type { Branding } from "@/lib/api/branding"
import BrandLogo from "@/routes/customer/BrandLogo"
import { useImageDataUrl } from "@/routes/customer/image"

type Props = {
  branding: Branding
}

export default function IdleScreen({ branding }: Props) {
  const [index, setIndex] = useState(0)
  const promoPath = branding.promo_images[index % Math.max(branding.promo_images.length, 1)]
  const promoImage = useImageDataUrl(promoPath)
  const background = useImageDataUrl(branding.idle_bg_path)
  const hasPromos = branding.promo_images.length > 0

  useEffect(() => {
    if (branding.promo_images.length < 2) return
    const id = window.setInterval(() => {
      setIndex((value) => (value + 1) % branding.promo_images.length)
    }, 5_000)
    return () => window.clearInterval(id)
  }, [branding.promo_images.length])

  const welcome = useMemo(
    () => branding.customer_welcome_text || "Chao mung quy khach",
    [branding.customer_welcome_text],
  )

  return (
    <main className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[color:color-mix(in_srgb,var(--brand)_8%,white)] p-12 text-center">
      {background && (
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-20"
          src={background}
        />
      )}
      <div className="relative z-10 flex h-full max-h-[720px] w-full max-w-6xl flex-col items-center justify-center gap-8">
        <BrandLogo branding={branding} className="size-36 text-5xl shadow-sm" />
        <div className="space-y-3">
          <h1 className="text-6xl font-bold tracking-normal text-[var(--brand)]">
            {branding.shop_name}
          </h1>
          <p className="text-3xl font-medium text-slate-700">{welcome}</p>
        </div>

        {hasPromos && promoImage && (
          <img
            alt=""
            className="h-[260px] w-full max-w-4xl rounded object-cover shadow-sm"
            src={promoImage}
          />
        )}
      </div>
    </main>
  )
}
