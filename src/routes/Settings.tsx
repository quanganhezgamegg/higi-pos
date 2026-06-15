import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { formatVnd } from "@/lib/format"
import {
  appVersion,
  backupDatabase,
  getSettingsBulk,
  setSettingsBulk,
  updateSugarIceLevels,
} from "@/lib/api/settings"
import {
  createDiscount,
  listDiscounts,
  setDiscountActive,
  updateDiscount,
  type Discount,
  type DiscountInput,
} from "@/lib/api/payments"

const settingKeys = [
  "shop_name",
  "shop_address",
  "shop_phone",
  "bill_footer",
  "default_backup_dir",
  "sugar_levels",
  "ice_levels",
]

const emptyDiscount: DiscountInput = {
  name: "",
  type: "PERCENT",
  value: 0,
  scope: "ORDER",
  valid_from: null,
  valid_to: null,
  sort_order: 0,
}

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [discountForm, setDiscountForm] = useState<DiscountInput>(emptyDiscount)
  const [editingDiscountId, setEditingDiscountId] = useState<number | null>(null)
  const [version, setVersion] = useState("")
  const [backupPath, setBackupPath] = useState("")
  const [backupResult, setBackupResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setError(null)
    try {
      const [values, nextDiscounts, nextVersion] = await Promise.all([
        getSettingsBulk(settingKeys),
        listDiscounts(true),
        appVersion(),
      ])
      setSettings(Object.fromEntries(values.map((item) => [item.key, item.value ?? ""])))
      setDiscounts(nextDiscounts)
      setVersion(nextVersion)
      setBackupPath(values.find((item) => item.key === "default_backup_dir")?.value ?? "")
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    Promise.all([getSettingsBulk(settingKeys), listDiscounts(true), appVersion()])
      .then(([values, nextDiscounts, nextVersion]) => {
        setSettings(Object.fromEntries(values.map((item) => [item.key, item.value ?? ""])))
        setDiscounts(nextDiscounts)
        setVersion(nextVersion)
        setBackupPath(values.find((item) => item.key === "default_backup_dir")?.value ?? "")
      })
      .catch((e) => setError(String(e)))
  }, [])

  function setValue(key: string, value: string) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function saveSettings() {
    setError(null)
    try {
      await setSettingsBulk(settingKeys.map((key) => ({ key, value: settings[key] ?? "" })))
      await updateSugarIceLevels({
        sugar_levels: splitCsv(settings.sugar_levels),
        ice_levels: splitCsv(settings.ice_levels),
      })
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  async function saveDiscount() {
    setError(null)
    try {
      if (editingDiscountId) await updateDiscount(editingDiscountId, discountForm)
      else await createDiscount(discountForm)
      setDiscountForm(emptyDiscount)
      setEditingDiscountId(null)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  async function runBackup() {
    setError(null)
    setBackupResult(null)
    try {
      await setSettingsBulk([{ key: "default_backup_dir", value: backupPath }])
      setBackupResult(await backupDatabase(backupPath))
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cài đặt</h1>
          <p className="text-sm text-muted-foreground">Phiên bản {version || "..."}</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/">Trang chủ</Link>
        </Button>
      </header>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="grid gap-3 rounded-lg border bg-background p-4">
        <h2 className="font-semibold">Thông tin quán & bill</h2>
        <Input
          placeholder="Tên quán"
          value={settings.shop_name ?? ""}
          onChange={(event) => setValue("shop_name", event.target.value)}
        />
        <Input
          placeholder="Địa chỉ"
          value={settings.shop_address ?? ""}
          onChange={(event) => setValue("shop_address", event.target.value)}
        />
        <Input
          placeholder="Số điện thoại"
          value={settings.shop_phone ?? ""}
          onChange={(event) => setValue("shop_phone", event.target.value)}
        />
        <Input
          placeholder="Footer bill"
          value={settings.bill_footer ?? ""}
          onChange={(event) => setValue("bill_footer", event.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder="Mức đường, cách nhau bằng dấu phẩy"
            value={settings.sugar_levels ?? ""}
            onChange={(event) => setValue("sugar_levels", event.target.value)}
          />
          <Input
            placeholder="Mức đá, cách nhau bằng dấu phẩy"
            value={settings.ice_levels ?? ""}
            onChange={(event) => setValue("ice_levels", event.target.value)}
          />
        </div>
        <Button className="w-fit" onClick={saveSettings}>
          Lưu cài đặt
        </Button>
      </section>

      <section className="grid gap-3 rounded-lg border bg-background p-4">
        <h2 className="font-semibold">Preset chiết khấu</h2>
        <div className="grid grid-cols-[1fr_130px_120px_130px_auto] gap-2">
          <Input
            placeholder="Tên chiết khấu"
            value={discountForm.name}
            onChange={(event) => setDiscountForm((form) => ({ ...form, name: event.target.value }))}
          />
          <select
            className="rounded-md border bg-background px-2"
            value={discountForm.type}
            onChange={(event) =>
              setDiscountForm((form) => ({
                ...form,
                type: event.target.value as DiscountInput["type"],
              }))
            }
          >
            <option value="PERCENT">Phần trăm</option>
            <option value="AMOUNT">Số tiền</option>
          </select>
          <Input
            type="number"
            value={discountForm.value}
            onChange={(event) =>
              setDiscountForm((form) => ({ ...form, value: Number(event.target.value) }))
            }
          />
          <select
            className="rounded-md border bg-background px-2"
            value={discountForm.scope}
            onChange={(event) =>
              setDiscountForm((form) => ({
                ...form,
                scope: event.target.value as DiscountInput["scope"],
              }))
            }
          >
            <option value="ORDER">Toàn đơn</option>
            <option value="ITEM">Theo dòng</option>
          </select>
          <Button onClick={saveDiscount}>{editingDiscountId ? "Cập nhật" : "Thêm"}</Button>
        </div>
        <div className="divide-y rounded-md border">
          {discounts.map((discount) => (
            <div key={discount.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="font-medium">{discount.name}</p>
                <p className="text-sm text-muted-foreground">
                  {discount.type === "PERCENT" ? `${discount.value}%` : formatVnd(discount.value)} -{" "}
                  {discount.scope === "ORDER" ? "Toàn đơn" : "Theo dòng"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={discount.is_active}
                  onCheckedChange={(checked) =>
                    setDiscountActive(discount.id, checked).then(refresh)
                  }
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingDiscountId(discount.id)
                    setDiscountForm({
                      name: discount.name,
                      type: discount.type,
                      value: discount.value,
                      scope: discount.scope,
                      valid_from: discount.valid_from,
                      valid_to: discount.valid_to,
                      sort_order: discount.sort_order,
                    })
                  }}
                >
                  Sửa
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border bg-background p-4">
        <h2 className="font-semibold">Sao lưu dữ liệu</h2>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            placeholder="Thư mục backup, ví dụ C:\\HiGiBackup"
            value={backupPath}
            onChange={(event) => setBackupPath(event.target.value)}
          />
          <Button onClick={runBackup}>Backup DB</Button>
        </div>
        {backupResult && <p className="text-sm text-muted-foreground">Đã lưu: {backupResult}</p>}
      </section>
    </div>
  )
}

function splitCsv(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}
