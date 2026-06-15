import { useCallback, useEffect, useState } from "react"
import type { CSSProperties } from "react"
import { listen } from "@tauri-apps/api/event"
import { getBranding, type Branding } from "@/lib/api/branding"
import { getCustomerView, setCustomerPhase, type CustomerView } from "@/lib/api/customer"
import IdleScreen from "@/routes/customer/IdleScreen"
import OrderScreen from "@/routes/customer/OrderScreen"
import PaymentScreen from "@/routes/customer/PaymentScreen"
import ThankYouScreen from "@/routes/customer/ThankYouScreen"

const DEFAULT_BRANDING: Branding = {
  shop_name: "HiGi Coffee",
  shop_address: "",
  shop_phone: "",
  brand_color: "#6F4E37",
  logo_path: null,
  idle_bg_path: null,
  promo_images: [],
  customer_welcome_text: "Chao mung quy khach",
  bill_footer: "Cam on quy khach!",
}

export default function CustomerDisplay() {
  const [view, setView] = useState<CustomerView>({ phase: "idle", order: null, payment: null })
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING)

  useEffect(() => {
    void getCustomerView().then(setView).catch(console.error)
    void getBranding().then(setBranding).catch(console.error)

    const unlistenCustomer = listen<CustomerView>("customer://update", (event) => {
      setView(event.payload)
    })
    const unlistenBranding = listen<void>("branding://update", () => {
      void getBranding().then(setBranding).catch(console.error)
    })

    return () => {
      void unlistenCustomer.then((fn) => fn())
      void unlistenBranding.then((fn) => fn())
    }
  }, [])

  const backToIdle = useCallback(() => {
    setView({ phase: "idle", order: null, payment: null })
    void setCustomerPhase("idle").catch(console.error)
  }, [])

  return (
    <div
      className="h-screen w-screen overflow-hidden bg-white"
      style={{ "--brand": branding.brand_color } as CSSProperties}
    >
      {view.phase === "idle" && <IdleScreen branding={branding} />}
      {view.phase === "order" && view.order && (
        <OrderScreen branding={branding} order={view.order} />
      )}
      {view.phase === "payment" && view.order && (
        <PaymentScreen branding={branding} order={view.order} payment={view.payment} />
      )}
      {view.phase === "thankyou" && <ThankYouScreen branding={branding} onDone={backToIdle} />}
    </div>
  )
}
