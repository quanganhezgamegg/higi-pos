import { useEffect, useState } from "react"
import { getSetting, setSetting } from "@/lib/api/settings"
import { Button } from "@/components/ui/button"

const KEY = "shop_name"

export default function Settings() {
  const [name, setName] = useState("")
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSetting(KEY)
      .then((v) => {
        setSaved(v)
        if (v) setName(v)
      })
      .catch((e) => setError(String(e)))
  }, [])

  async function onSave() {
    setError(null)
    try {
      await setSetting(KEY, name)
      setSaved(name)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-2xl font-bold">Cài đặt quán</h1>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">Tên quán</span>
        <input
          className="rounded-md border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <Button onClick={onSave}>Lưu</Button>
      <p className="text-sm text-muted-foreground">
        Đã lưu: <strong>{saved ?? "(chưa có)"}</strong>
      </p>
      {error && <p className="text-sm text-destructive">Lỗi: {error}</p>}
    </div>
  )
}
