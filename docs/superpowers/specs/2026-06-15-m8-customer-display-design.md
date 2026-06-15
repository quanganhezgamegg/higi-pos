# HiGi POS — M8: Màn hình khách & Cá nhân hóa — Design Spec

| | |
|---|---|
| **Milestone** | M8 — Customer-facing display + Branding/Cá nhân hóa |
| **Ngày** | 2026-06-15 |
| **Trạng thái** | Chờ duyệt → lập plan → giao Codex thực thi |
| **Phụ thuộc** | M0–M7 đã hoàn tất (v1, đang ở `main`). Dùng lại: `orders`/`order_items` (M3), `payments` + `generate_bill_html` (M4), `settings` (M0/M7), pattern lưu ảnh + plugin dialog (M1). |
| **Master spec** | `docs/superpowers/specs/2026-06-12-higi-pos-design.md` |

## 1. Mục tiêu & phạm vi

Thêm **màn hình thứ hai hướng về khách** (chạy trên màn HDMI cắm vào máy POS) hiển thị đơn đang gọi + tổng tiền + mã VietQR thanh toán; đồng thời cho quán **cá nhân hóa thương hiệu** (logo, màu, ảnh) áp lên màn khách + hoá đơn. Giữ nguyên kiến trúc **offline, 1 máy, 0đ phần mềm**.

### Trong phạm vi M8
- Cửa sổ khách (Tauri multi-window) trên màn thứ 2, 4 trạng thái: **Idle / Order / Payment / Thank-you**.
- Đồng bộ realtime màn NV → màn khách bằng **Tauri event** (không mạng).
- **VietQR động sinh offline** (payload NAPAS/EMVCo + CRC16 → render SVG bằng crate `qrcode`).
- **Cá nhân hóa** (data-driven trong `settings`): logo + tên quán, **màu thương hiệu**, ảnh nền/chào, **ảnh khuyến mãi (slideshow)** — áp cho **màn khách + hoá đơn**.
- Cấu hình ngân hàng (chọn bank theo BIN + số TK + tên TK) + cấu hình branding trong màn Cài đặt.

### Ngoài phạm vi M8
- Khách tự bấm chọn món / tự thanh toán (kiosk) — chỉ "xem", không nhập.
- Đồng bộ qua mạng/thiết bị riêng (chỉ màn 2 cắm trực tiếp).
- Đối soát ngân hàng tự động (vẫn xác nhận thủ công qua loa báo tiền như M4).
- Theme toàn bộ màn nhân viên (chỉ brand màn khách + bill).

## 2. Quyết định thiết kế (đã chốt)

| # | Quyết định |
|---|---|
| 1 | Màn khách = **cửa sổ Tauri thứ 2** trên màn HDMI; **tự phát hiện màn thứ 2** để mở fullscreen, nếu chỉ 1 màn thì mở cửa sổ thường (để test). |
| 2 | Đồng bộ bằng **Tauri event** (`customer://update`); Rust giữ state `CustomerView` là nguồn sự thật. |
| 3 | **VietQR động**, payload + QR **sinh hoàn toàn offline** (free crate `qrcode`); cấu hình ngân hàng trong Settings. |
| 4 | Cá nhân hóa **data-driven** lưu trong `settings`; áp cho **màn khách + hoá đơn**; ảnh lưu trong `app_data_dir/images` (pattern M1). |

## 3. Kiến trúc

```
┌─────────────────────────┐         ┌──────────────────────────┐
│ Cửa sổ NV (main)         │         │ Cửa sổ khách (customer)  │
│ React: Sales/Payment...  │         │ React route #/customer   │
└───────────▲──────────────┘         └────────▲─────────────────┘
            │ invoke()                          │ listen("customer://update")
            │                                   │ + get_customer_view() lúc mount
┌───────────┴───────────────────────────────────┴──────────────┐
│ Rust core                                                      │
│  state: Mutex<CustomerView { phase, order_id }>                │
│  - lệnh NV (mở đơn / thêm-bớt món / sang payment / finalize)   │
│    → cập nhật CustomerView → app.emit("customer://update", …)  │
│  - get_customer_view(), get_payment_qr(), open_customer_display│
│  vietqr (payload NAPAS + CRC16), qrcode → SVG                  │
└───────────────────────────────────────────────────────────────┘
```

- **Cửa sổ khách:** `WebviewWindow` nhãn `customer`, URL `#/customer`. Lệnh `open_customer_display()` liệt kê `app.available_monitors()`, nếu có ≥2 màn → tạo cửa sổ ở vị trí màn phụ + `set_fullscreen(true)`; nếu 1 màn → cửa sổ thường (1024×600) để test. `close_customer_display()` đóng.
- **State `CustomerView { phase: Idle|Order|Payment|ThankYou, order_id: Option<i64> }`** (Tauri managed `Mutex`). Khi state đổi → `app.emit("customer://update", payload)` với **payload đầy đủ** (xem §6) để cửa sổ khách render ngay, không cần query thêm.
- **Điểm tích hợp ở luồng NV (M3/M4):** khi NV mở/chọn một đơn để thao tác → `set_customer_order(order_id, phase=Order)`; mỗi lần `add_order_item`/`update_order_item`/`remove_order_item`/`apply_discount` trên đơn đó → phát lại event; khi mở màn thanh toán → `set_customer_phase(Payment)`; sau `finalize_order` → `set_customer_phase(ThankYou)` rồi tự về `Idle` sau ~6s (timer phía cửa sổ khách).

## 4. VietQR động (offline)

Cấu hình trong `settings`: `bank_bin` (BIN NAPAS, vd `970436`=Vietcombank), `bank_account_number`, `bank_account_name`. Lệnh `list_banks() -> [{bin, name, short_name}]` trả **danh sách bank nhúng sẵn** (hằng số trong code, free) cho dropdown.

`get_payment_qr(order_id) -> { qr_svg: String, amount: i64, content: String, bank_name, account_number }`:
1. Lấy `total` + `code` của đơn.
2. Dựng payload **EMVCo MPM / NAPAS** (TLV: `ID(2) + len(2) + value`):
   - `00`="01" (Payload Format Indicator)
   - `01`="11" (Point of Initiation; có thể dùng "12" cho one-time — kiểm chứng bằng quét app ngân hàng thật)
   - `38` (Merchant Account Info — NAPAS): `00`="A000000727", `01`={ `00`=bank_bin, `01`=account_number }, `02`="QRIBFTTA" (chuyển tới tài khoản)
   - `53`="704" (VND), `54`=amount (chuỗi số), `58`="VN"
   - `62` (Additional Data): `08`=content (mã đơn, vd `DH<order.code>`)
   - `63`=CRC16-CCITT (poly `0x1021`, init `0xFFFF`, HEX hoa 4 ký tự, tính trên toàn chuỗi + "6304")
3. Render payload → **SVG** bằng crate `qrcode` (offline). Trả SVG string.

> **Bắt buộc test:** unit test CRC16 + so payload với mẫu chuẩn; và **quét thử bằng app ngân hàng thật** để xác nhận số tiền + nội dung tự điền đúng (ghi vào plan như bước verify thủ công).

## 5. Cá nhân hóa (branding) — lưu trong `settings`

| key | ý nghĩa |
|---|---|
| `shop_name`, `shop_address`, `shop_phone` | thông tin quán (đã có một phần từ M7) |
| `brand_color` | màu thương hiệu (hex, vd `#6F4E37`) → áp qua biến CSS `--brand` |
| `logo_path` | ảnh logo (đường dẫn tương đối trong `images/`) |
| `idle_bg_path` | ảnh nền màn chờ |
| `promo_images` | JSON mảng đường dẫn ảnh khuyến mãi (slideshow) |
| `customer_welcome_text` | dòng chào (vd "Chào mừng quý khách") |
| `bill_footer` | chân hoá đơn |

- Ảnh: dùng lại lệnh lưu ảnh của M1 (dialog chọn file → copy vào `app_data_dir/images` → trả path); thêm `save_branding_image(kind)` nếu cần phân loại, hoặc tái dùng `save_product_image`.
- **Áp dụng:**
  - **Màn khách:** logo + `shop_name` ở header/idle; `brand_color` → biến CSS `--brand` (nút/viền/nền nhấn); `idle_bg_path` nền màn chờ; `promo_images` slideshow (đổi ảnh mỗi ~5s).
  - **Hoá đơn** (`generate_bill_html` của M4): chèn logo + tên + địa chỉ + SĐT + `bill_footer`, dùng `brand_color` cho tiêu đề/đường kẻ.

## 6. Payload event `customer://update`

```ts
type CustomerView = {
  phase: "idle" | "order" | "payment" | "thankyou"
  order?: {                       // có khi phase = order | payment
    code: string
    type: "DINE_IN" | "TAKEAWAY"
    table_name?: string
    items: { name: string; size?: string; sugar?: string; ice?: string;
             qty: number; line_total: number;
             toppings: { name: string; price: number }[] }[]
    subtotal: number; discount_total: number; total: number
  }
  payment?: { qr_svg: string; amount: number; content: string; bank_name: string; account_number: string } // khi phase=payment
}
```
Cửa sổ khách `listen("customer://update")` → set state → render; lúc mount gọi `get_customer_view()` để có trạng thái hiện tại. Branding lấy 1 lần qua `get_branding()` + nghe `branding://update` khi NV đổi cấu hình.

## 7. Wireframe 4 trạng thái (mục tiêu cho Codex; shadcn + Tailwind)

**Idle** — `bg-[--brand]/5`, căn giữa, logo lớn, slideshow promo nền mờ:
```
┌──────────────────────────────────────────────┐
│                                                │
│                  [ LOGO ]                      │
│                HiGi Coffee                     │
│         « Chào mừng quý khách »                │
│                                                │
│        [ ảnh khuyến mãi — slideshow ]          │
└──────────────────────────────────────────────┘
```

**Order** — header brand, danh sách cuộn, footer tổng tiền lớn:
```
┌──────────────────────────────────────────────┐
│ [logo] HiGi Coffee                  Bàn 5      │  ← bg-[--brand], text trắng
├──────────────────────────────────────────────┤
│ Cà phê sữa  (L · ít đá)      x1     35.000 ₫  │
│    + Trân châu                       5.000 ₫  │
│ Trà đào                       x2    50.000 ₫  │
│ ⋮ (cuộn)                                       │
├──────────────────────────────────────────────┤
│ TỔNG CỘNG                          90.000 ₫   │  ← text-4xl font-bold text-[--brand]
└──────────────────────────────────────────────┘
```

**Payment** — QR to bên trái, số tiền + thông tin CK bên phải:
```
┌──────────────────────────────────────────────┐
│ [logo] HiGi Coffee — Quét mã để thanh toán     │
│  ┌───────────────┐     TỔNG TIỀN               │
│  │               │     90.000 ₫   (text-5xl)   │
│  │   QR (SVG)     │     Vietcombank             │
│  │               │     1234567 — HIGI COFFEE   │
│  └───────────────┘     Nội dung: DH<code>      │
└──────────────────────────────────────────────┘
```

**Thank-you** — căn giữa, ~6s rồi về Idle:
```
┌──────────────────────────────────────────────┐
│                  [ LOGO ]                      │
│           Cảm ơn quý khách! ♥                  │
│              Hẹn gặp lại                        │
└──────────────────────────────────────────────┘
```

Gợi ý kỹ thuật FE: route `#/customer` không có nav; component con `IdleScreen`/`OrderScreen`/`PaymentScreen`/`ThankYouScreen` theo `phase`; `brand_color` set vào `style={{'--brand': color}}` ở root; tiền dùng `formatVnd`. Tối ưu cho màn nằm ngang, chữ lớn (khách đứng xa đọc được).

## 8. Lệnh (Tauri commands) thêm mới
- `open_customer_display()` / `close_customer_display()`
- `get_customer_view() -> CustomerView`
- `set_customer_order(order_id, phase)` + `set_customer_phase(phase)` (gọi từ luồng NV) — và các lệnh sửa đơn của M3/M4 phát lại event nếu đụng đơn đang hiển thị
- `get_payment_qr(order_id) -> PaymentQr`
- `list_banks() -> Vec<Bank>`
- `get_branding() -> Branding` / cập nhật qua `set_settings_bulk` (M7) + `save_branding_image`

Đăng ký vào `invoke_handler` trong `lib.rs`. FE wrapper: `src/lib/api/customer.ts`, `src/lib/api/branding.ts`.

## 9. Phi chức năng
- **Offline**, **0đ** (chỉ thư viện mã nguồn mở: `qrcode`; QR FE render từ SVG do Rust trả).
- Không có màn 2 → vẫn mở được cửa sổ khách dạng thường để test.
- Hiệu năng: event nhẹ; slideshow/timer phía FE.
- **Test:** Rust unit cho VietQR payload + CRC16 (so mẫu chuẩn) + branding get/set; FE test render 4 trạng thái theo `phase` + định dạng VND. Verify thủ công: quét QR bằng app ngân hàng thật.

## 10. Tiêu chí hoàn thành (acceptance)
1. Cắm màn 2 → `Mở màn hình khách` → cửa sổ khách fullscreen trên màn phụ (1 màn → cửa sổ thường).
2. NV gọi món → màn khách hiện đơn + tổng tiền cập nhật **realtime**.
3. Sang thanh toán → màn khách hiện **VietQR** + tổng tiền; **quét bằng app ngân hàng thật tự điền đúng số tiền + nội dung**.
4. Chốt PAID → màn khách hiện cảm ơn rồi về idle.
5. Cài đặt branding (logo/màu/ảnh nền/ảnh KM/info) → áp đúng lên **màn khách (idle/header/slideshow)** và **hoá đơn**.
6. Toàn bộ offline; không cần màn 2 vẫn chạy/test được; Rust tests (CRC16/payload/branding) + FE tests xanh; CI xanh.
