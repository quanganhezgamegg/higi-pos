import type { Branding } from "@/lib/api/branding"
import { useImageDataUrl } from "@/routes/customer/image"

type Props = {
  branding: Branding
  className?: string
}

export default function BrandLogo({ branding, className = "" }: Props) {
  const logo = useImageDataUrl(branding.logo_path)

  if (logo) {
    return <img alt={branding.shop_name} className={`object-contain ${className}`} src={logo} />
  }

  return (
    <div
      aria-label={branding.shop_name}
      className={`flex items-center justify-center rounded bg-[var(--brand)] font-bold text-white ${className}`}
    >
      {branding.shop_name.slice(0, 2).toUpperCase()}
    </div>
  )
}
