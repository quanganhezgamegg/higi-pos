import { useEffect, useState } from "react"
import { readImageDataUrl } from "@/lib/api/menu"

export function useImageDataUrl(path: string | null | undefined) {
  const [image, setImage] = useState<{ path: string; dataUrl: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!path) return

    readImageDataUrl(path)
      .then((url) => {
        if (!cancelled) setImage({ path, dataUrl: url })
      })
      .catch(() => {
        if (!cancelled) setImage(null)
      })

    return () => {
      cancelled = true
    }
  }, [path])

  return image && image.path === path ? image.dataUrl : null
}
