# M8 — Customer display & Branding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm cửa sổ màn khách (Tauri multi-window) hiển thị 4 trạng thái Idle/Order/Payment/Thank-you với đồng bộ realtime qua Tauri event; VietQR động sinh hoàn toàn offline (NAPAS/EMVCo TLV + CRC16 → SVG); cá nhân hóa thương hiệu (logo/màu/ảnh nền/ảnh KM) áp lên màn khách + hoá đơn; cấu hình trong màn Settings.

**Architecture:** `CustomerView` state (Rust `Mutex`) là nguồn sự thật → mỗi lần thay đổi phát `customer://update` với payload đầy đủ → cửa sổ khách `listen()` + re-render. VietQR sinh trong Rust (`services/vietqr.rs`), trả SVG string, không cần FE render. Branding đọc từ `settings` (đã có từ M7), lệnh `get_branding()` gom nhiều key thành struct. Lệnh `open_customer_display()` dùng `app.available_monitors()` để tự phát hiện màn 2 và mở fullscreen.

**Tech Stack:** Rust crate `qrcode` (offline, SVG output); `tauri::WebviewWindowBuilder` (Tauri 2); Tauri `AppHandle::emit`; React + shadcn/ui + Tailwind; `@tauri-apps/api/event` (`listen`); Vitest.

**Spec:** `docs/superpowers/specs/2026-06-15-m8-customer-display-design.md` §1–§10 (nguồn sự thật — đọc kỹ §4 VietQR payload, §6 event payload, §7 wireframes, §8 command signatures).

**Mẫu code (đã có — đọc trước khi code):**
- `src-tauri/src/lib.rs` — builder, `generate_handler!`, managed state pattern.
- `src-tauri/src/commands/settings.rs` + `src-tauri/src/repo/settings.rs` — `set_settings_bulk` / `get_settings_bulk` tái dùng.
- `src-tauri/src/commands/image.rs` — dialog + copy vào `images/` + trả relative path.
- `src-tauri/src/commands/payments.rs` + `src-tauri/src/repo/payments.rs` — `generate_bill_html` sẽ mở rộng.
- `src-tauri/src/repo/orders.rs` + `src-tauri/src/domain/orders.rs` — `Order`/`OrderItem` shape cho snapshot.
- `src/lib/api/menu.ts`, `src/routes/Settings.tsx`, `src/App.tsx` (HashRouter), `src/lib/format.ts` (`formatVnd`).

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `src-tauri/src/services/vietqr.rs` | `build_vietqr_payload`, `crc16_ccitt`, `build_qr_svg`; hằng số `BANKS`; unit tests TDD |
| `src-tauri/src/domain/customer.rs` | `CustomerPhase`, `CustomerOrderView`, `CustomerPaymentView`, `CustomerView`, `PaymentQr`, `Bank`, `Branding` |
| `src-tauri/src/commands/customer.rs` | `open_customer_display`, `close_customer_display`, `get_customer_view`, `set_customer_order`, `set_customer_phase`, `get_payment_qr`, `list_banks`, `get_branding`, `save_branding_image` |
| `src/lib/api/customer.ts` | invoke wrappers + TS types cho CustomerView, PaymentQr, set_customer_order, set_customer_phase |
| `src/lib/api/branding.ts` | invoke wrappers + TS types cho Branding, Bank, get_branding, list_banks, save_branding_image |
| `src/routes/Customer.tsx` | Route `#/customer` — mount logic + phase switch + `listen("customer://update")` |
| `src/routes/customer/IdleScreen.tsx` | Màn chờ — logo, shop_name, welcome_text, slideshow promo |
| `src/routes/customer/OrderScreen.tsx` | Màn gọi món — header brand, danh sách items cuộn, footer tổng |
| `src/routes/customer/PaymentScreen.tsx` | Màn QR + tổng tiền + thông tin CK |
| `src/routes/customer/ThankYouScreen.tsx` | Màn cảm ơn + timer 6s về Idle |
| Sửa: `src-tauri/src/services/mod.rs` | Thêm `pub mod vietqr;` |
| Sửa: `src-tauri/src/domain/mod.rs` | Thêm `pub mod customer;` |
| Sửa: `src-tauri/src/commands/mod.rs` | Thêm `pub mod customer;` |
| Sửa: `src-tauri/src/lib.rs` | Thêm `CustomerView` managed state; đăng ký 9 commands M8 vào `generate_handler!` |
| Sửa: `src-tauri/src/commands/orders.rs` | `add_order_item`, `update_order_item`, `remove_order_item`, `cancel_order` → gọi `emit_customer_update` nếu đúng đơn đang hiển thị |
| Sửa: `src-tauri/src/commands/payments.rs` | `apply_discount`, `add_payment` → emit; `finalize_order` → `set_customer_phase(ThankYou)` + emit |
| Sửa: `src-tauri/src/repo/payments.rs` | `generate_bill_html` — thêm logo + brand_color + shop info + footer từ branding |
| Sửa: `src/App.tsx` | Thêm route `#/customer` |
| Sửa: `src/routes/Settings.tsx` | Thêm section "Cá nhân hóa" + section "Màn hình khách" |
| Sửa: `src-tauri/Cargo.toml` | Thêm dep `qrcode = "0.14"` |

---

## Task 1: Cargo dep — thêm crate `qrcode`

**Files:** Sửa `src-tauri/Cargo.toml`.

- [ ] **Step 1: Thêm dependency** — mở `src-tauri/Cargo.toml`, thêm vào `[dependencies]`:

```toml
qrcode = "0.14"
```

- [ ] **Step 2: Build kiểm tra dep tải được** — Run:
```bash
cargo build --manifest-path src-tauri/Cargo.toml
```
Expected: build pass (qrcode download + compile OK).

- [ ] **Step 3: Commit**
```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore(deps): add qrcode crate for offline VietQR SVG generation"
```

---

## Task 2: VietQR service (TDD) — payload builder + CRC16 + SVG

**Files:** Create `src-tauri/src/services/vietqr.rs`; Modify `src-tauri/src/services/mod.rs`.

Đây là phần **rủi ro kỹ thuật cao nhất** — payload phải khớp NAPAS/EMVCo spec để app ngân hàng quét được. TDD là bắt buộc: viết test so mẫu trước, impl sau.

- [ ] **Step 1: Khai báo module** — thêm `pub mod vietqr;` vào `src-tauri/src/services/mod.rs`.

- [ ] **Step 2: Viết test THẤT BẠI trước** — tạo `src-tauri/src/services/vietqr.rs` chỉ với phần tests:

```rust
// src-tauri/src/services/vietqr.rs

#[cfg(test)]
mod tests {
    use super::*;

    // --- CRC16 tests ---

    #[test]
    fn crc16_known_value() {
        // "123456789" là chuỗi test chuẩn CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no refin/refout)
        // Kết quả chuẩn = 0x29B1
        let result = crc16_ccitt(b"123456789");
        assert_eq!(result, 0x29B1, "CRC16 CCITT-FALSE phải ra 0x29B1 cho '123456789'");
    }

    #[test]
    fn crc16_empty_string() {
        // CRC16 của chuỗi rỗng với init=0xFFFF, poly=0x1021 = 0xFFFF
        let result = crc16_ccitt(b"");
        assert_eq!(result, 0xFFFF);
    }

    // --- TLV builder tests ---

    #[test]
    fn tlv_builds_id_len_value() {
        // TLV("00", "01") → "000201"
        let result = tlv("00", "01");
        assert_eq!(result, "000201");
    }

    #[test]
    fn tlv_pads_len_to_two_digits() {
        // TLV("58", "VN") → "5802VN"
        let result = tlv("58", "VN");
        assert_eq!(result, "5802VN");
    }

    #[test]
    fn tlv_len_of_long_value() {
        // value 11 chars → len "11"
        let v = "A000000727";  // 10 chars
        let result = tlv("00", v);
        assert_eq!(&result[2..4], "10", "len phải là 10");
    }

    // --- Full payload test (so mẫu biết trước) ---
    // Mẫu: BIN=970436 (Vietcombank), account=1234567890, amount=50000,
    //       content="DH000001"
    // Payload trước CRC (không kèm CRC field value):
    //   00020101021138570010A0000007270142060970436011010123456789020208QRIBFTTA
    //   5303704540650000058 02VN62140810DH0000016304
    // CRC tính trên: <payload_above> + "6304" (không có value)
    // → 4 ký tự HEX hoa.
    //
    // Lưu ý: test này xác minh cấu trúc đúng; giá trị CRC exact được kiểm tra
    // bằng quét app ngân hàng thật ở Task verify cuối plan.

    #[test]
    fn payload_contains_required_fields() {
        let payload = build_vietqr_payload("970436", "1234567890", 50_000, "DH000001");
        // Payload Format Indicator
        assert!(payload.contains("000201"), "missing PFI");
        // Point of Initiation (11=reusable or 12=one-time)
        assert!(payload.contains("010211") || payload.contains("010212"), "missing POI");
        // NAPAS merchant account tag 38
        assert!(payload.starts_with("00020101"), "phải bắt đầu bằng 000201");
        assert!(payload.contains("38"), "missing NAPAS tag 38");
        // BIN
        assert!(payload.contains("970436"), "missing BIN");
        // Account number
        assert!(payload.contains("1234567890"), "missing account");
        // QRIBFTTA (chuyển khoản tài khoản)
        assert!(payload.contains("QRIBFTTA"), "missing QRIBFTTA");
        // Currency VND = 704
        assert!(payload.contains("5303704"), "missing VND currency");
        // Amount
        assert!(payload.contains("54"), "missing amount tag");
        assert!(payload.contains("50000"), "missing amount value");
        // Country VN
        assert!(payload.contains("5802VN"), "missing country VN");
        // Additional data content
        assert!(payload.contains("DH000001"), "missing order content");
        // CRC tag 63 + 04 len + 4-char hex
        let crc_pos = payload.rfind("6304").expect("missing CRC tag 6304");
        let crc_val = &payload[crc_pos + 4..];
        assert_eq!(crc_val.len(), 4, "CRC value phải đúng 4 ký tự HEX");
        assert!(crc_val.chars().all(|c| c.is_ascii_hexdigit() && (c.is_ascii_uppercase() || c.is_ascii_digit())),
            "CRC value phải là HEX hoa: {crc_val}");
    }

    #[test]
    fn payload_crc_is_self_consistent() {
        // Kiểm tra CRC trong payload khớp với CRC tính lại trên phần trước 4 ký tự cuối
        let payload = build_vietqr_payload("970436", "1234567890", 50_000, "DH000001");
        // Payload = <body>"6304"<XXXX>
        // CRC tính trên <body>"6304"
        let crc_pos = payload.rfind("6304").expect("missing CRC tag");
        let msg = &payload[..crc_pos + 4]; // phần tính CRC
        let crc_val = &payload[crc_pos + 4..];
        let expected = format!("{:04X}", crc16_ccitt(msg.as_bytes()));
        assert_eq!(crc_val, &expected, "CRC tự nhất quán: tính lại phải khớp embedded CRC");
    }

    #[test]
    fn build_qr_svg_returns_valid_svg() {
        let payload = build_vietqr_payload("970436", "1234567890", 50_000, "DH000001");
        let svg = build_qr_svg(&payload);
        assert!(svg.starts_with("<svg") || svg.contains("<svg"), "phải là SVG hợp lệ");
        assert!(svg.contains("</svg>"), "SVG phải có closing tag");
    }
}
```

- [ ] **Step 3: Chạy → FAIL** — Run: `cargo test --manifest-path src-tauri/Cargo.toml vietqr`
Expected: lỗi unresolved `crc16_ccitt`, `tlv`, `build_vietqr_payload`, `build_qr_svg` — đúng theo TDD.

- [ ] **Step 4: Viết implementation** — thêm vào ĐẦU `src-tauri/src/services/vietqr.rs` (trên `#[cfg(test)]`):

```rust
// src-tauri/src/services/vietqr.rs
//
// VietQR offline — EMVCo MPM / NAPAS spec.
// Tài liệu: NAPAS VietQR Integration Guide v1.0
// Payload format: chuỗi ASCII, ID(2) + Length(2, decimal) + Value.

use qrcode::{QrCode, EcLevel};
use qrcode::render::svg;

// --------------- Danh sách ngân hàng nhúng sẵn (free, offline) ---------------
// BIN NAPAS (6 chữ số), tên đầy đủ, tên viết tắt.
// Nguồn: NAPAS public bank list / VietQR open data.
#[derive(Debug, Clone, serde::Serialize)]
pub struct Bank {
    pub bin: String,
    pub name: String,
    pub short_name: String,
}

pub fn list_banks() -> Vec<Bank> {
    vec![
        Bank { bin: "970436".into(), name: "Ngân hàng TMCP Ngoại Thương Việt Nam".into(), short_name: "Vietcombank".into() },
        Bank { bin: "970415".into(), name: "Ngân hàng TMCP Công Thương Việt Nam".into(), short_name: "VietinBank".into() },
        Bank { bin: "970418".into(), name: "Ngân hàng TMCP Đầu Tư và Phát Triển Việt Nam".into(), short_name: "BIDV".into() },
        Bank { bin: "970405".into(), name: "Ngân hàng Nông nghiệp và PTNT Việt Nam".into(), short_name: "Agribank".into() },
        Bank { bin: "970422".into(), name: "Ngân hàng TMCP Quân Đội".into(), short_name: "MB Bank".into() },
        Bank { bin: "970432".into(), name: "Ngân hàng TMCP Việt Nam Thịnh Vượng".into(), short_name: "VPBank".into() },
        Bank { bin: "970423".into(), name: "Ngân hàng TMCP Tiên Phong".into(), short_name: "TPBank".into() },
        Bank { bin: "970407".into(), name: "Ngân hàng TMCP Kỹ Thương Việt Nam".into(), short_name: "Techcombank".into() },
        Bank { bin: "970443".into(), name: "Ngân hàng TMCP Sài Gòn Thương Tín".into(), short_name: "Sacombank".into() },
        Bank { bin: "970426".into(), name: "Ngân hàng TMCP Sài Gòn Công Thương".into(), short_name: "ACB".into() },
        Bank { bin: "970448".into(), name: "Ngân hàng TMCP Bưu điện Liên Việt".into(), short_name: "LienVietPostBank".into() },
        Bank { bin: "970441".into(), name: "Ngân hàng TMCP Quốc tế Việt Nam".into(), short_name: "VIB".into() },
        Bank { bin: "970454".into(), name: "Ngân hàng TMCP Việt Á".into(), short_name: "VietABank".into() },
        Bank { bin: "970416".into(), name: "Ngân hàng TMCP Á Châu".into(), short_name: "ACB".into() },
        Bank { bin: "970430".into(), name: "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh".into(), short_name: "HDBank".into() },
        Bank { bin: "422589".into(), name: "Ngân hàng TMCP Đông Nam Á".into(), short_name: "SeABank".into() },
        Bank { bin: "970403".into(), name: "Ngân hàng TMCP Đông Á".into(), short_name: "DongABank".into() },
        Bank { bin: "796500".into(), name: "Ví điện tử MoMo".into(), short_name: "MoMo".into() },
        Bank { bin: "963388".into(), name: "Ví ZaloPay".into(), short_name: "ZaloPay".into() },
    ]
}

pub fn bank_name_by_bin(bin: &str) -> String {
    list_banks()
        .into_iter()
        .find(|b| b.bin == bin)
        .map(|b| b.short_name)
        .unwrap_or_else(|| bin.to_string())
}

// --------------- TLV helper ---------------

/// Xây dựng TLV field: ID (2 ký tự) + length (2 chữ số decimal) + value.
/// Ví dụ: tlv("00", "01") → "000201"
pub fn tlv(id: &str, value: &str) -> String {
    format!("{}{:02}{}", id, value.len(), value)
}

// --------------- CRC16-CCITT ---------------
// Poly: 0x1021, Init: 0xFFFF, RefIn: false, RefOut: false, XorOut: 0x0000
// Alias: CRC-16/CCITT-FALSE

pub fn crc16_ccitt(data: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &byte in data {
        crc ^= (byte as u16) << 8;
        for _ in 0..8 {
            if crc & 0x8000 != 0 {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    crc
}

// --------------- VietQR Payload builder ---------------
//
// Cấu trúc EMVCo MPM / NAPAS (theo spec §4):
//
// 00 = "01"                          (Payload Format Indicator)
// 01 = "12"                          (Point of Initiation: 12 = one-time QR)
// 38 = [NAPAS merchant account]       (Merchant Account Information)
//   38.00 = "A000000727"             (NAPAS app ID)
//   38.01 = [bank info]
//     38.01.00 = bin                 (Bank BIN)
//     38.01.01 = account_number      (Số tài khoản)
//   38.02 = "QRIBFTTA"              (QR transfer to bank account)
// 53 = "704"                         (Transaction Currency: VND)
// 54 = amount (string)               (Transaction Amount — chỉ có khi > 0)
// 58 = "VN"                          (Country Code)
// 62 = [Additional Data]
//   62.08 = content                  (Purpose of Transaction / bill reference)
// 63 = CRC (tính sau, 4 HEX hoa)

pub fn build_vietqr_payload(
    bank_bin: &str,
    account_number: &str,
    amount: i64,
    content: &str,
) -> String {
    // --- 38.01: bank sub-fields ---
    let bank_inner = format!(
        "{}{}",
        tlv("00", bank_bin),
        tlv("01", account_number),
    );
    // --- tag 38: NAPAS merchant account info ---
    let napas_account = format!(
        "{}{}{}",
        tlv("00", "A000000727"),
        tlv("01", &bank_inner),
        tlv("02", "QRIBFTTA"),
    );
    let tag38 = tlv("38", &napas_account);

    // --- tag 62: Additional Data ---
    let additional = tlv("08", content);
    let tag62 = tlv("62", &additional);

    // --- amount: tag 54 (chỉ có nếu amount > 0) ---
    let amount_str = amount.to_string();
    let tag54 = if amount > 0 {
        tlv("54", &amount_str)
    } else {
        String::new()
    };

    // --- Assemble payload body (không có CRC) ---
    let body = format!(
        "{}{}{}{}{}{}{}",
        tlv("00", "01"),         // PFI
        tlv("01", "12"),         // Point of Initiation (12 = one-time)
        tag38,                   // NAPAS merchant account
        tlv("53", "704"),        // VND
        tag54,                   // amount (optional)
        tlv("58", "VN"),         // country
        tag62,                   // additional data
    );

    // --- CRC: tính trên body + "6304" ---
    let crc_input = format!("{body}6304");
    let crc_val = crc16_ccitt(crc_input.as_bytes());
    let crc_str = format!("{:04X}", crc_val);

    format!("{body}6304{crc_str}")
}

// --------------- QR SVG renderer ---------------

/// Render payload → SVG string dùng crate `qrcode`.
/// SVG không embed font, hiển thị tốt ở mọi kích thước vì vector.
pub fn build_qr_svg(payload: &str) -> String {
    let code = QrCode::with_error_correction_level(payload.as_bytes(), EcLevel::M)
        .expect("QR code generation failed");
    code.render::<svg::Color>()
        .min_dimensions(200, 200)
        .build()
}
```

- [ ] **Step 5: Chạy → PASS** — Run: `cargo test --manifest-path src-tauri/Cargo.toml vietqr`
Expected: tất cả tests trong `vietqr::tests` pass (đặc biệt `crc16_known_value = 0x29B1` và `payload_crc_is_self_consistent`).

- [ ] **Step 6: Commit**
```bash
git add src-tauri/src/services/vietqr.rs src-tauri/src/services/mod.rs
git commit -m "feat(services): add VietQR payload builder + CRC16-CCITT + SVG renderer (TDD)"
```

---

## Task 3: Domain structs cho customer, branding, QR

**Files:** Create `src-tauri/src/domain/customer.rs`; Modify `src-tauri/src/domain/mod.rs`.

- [ ] **Step 1: Tạo `src-tauri/src/domain/customer.rs`**:

```rust
// src-tauri/src/domain/customer.rs
use serde::{Deserialize, Serialize};

/// Phase hiển thị trên màn khách — cũng là discriminant cho event payload.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum CustomerPhase {
    #[default]
    Idle,
    Order,
    Payment,
    ThankYou,
}

/// Topping snapshot cho màn khách (không cần id).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerToppingView {
    pub name: String,
    pub price: i64,
}

/// Item snapshot cho màn khách.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerItemView {
    pub name: String,
    pub size: Option<String>,
    pub sugar: Option<String>,
    pub ice: Option<String>,
    pub qty: i64,
    pub line_total: i64,
    pub toppings: Vec<CustomerToppingView>,
}

/// Thông tin đơn hàng cho màn khách (không có id nội bộ, chỉ dữ liệu hiển thị).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerOrderView {
    pub code: String,
    #[serde(rename = "type")]
    pub order_type: String, // "DINE_IN" | "TAKEAWAY"
    pub table_name: Option<String>,
    pub items: Vec<CustomerItemView>,
    pub subtotal: i64,
    pub discount_total: i64,
    pub total: i64,
}

/// Thông tin QR thanh toán cho màn khách.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomerPaymentView {
    pub qr_svg: String,
    pub amount: i64,
    pub content: String,
    pub bank_name: String,
    pub account_number: String,
}

/// State đầy đủ truyền đến màn khách qua event `customer://update`.
/// Khớp với spec §6.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CustomerView {
    pub phase: CustomerPhase,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<CustomerOrderView>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payment: Option<CustomerPaymentView>,
}

/// Kết quả của lệnh `get_payment_qr`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentQr {
    pub qr_svg: String,
    pub amount: i64,
    pub content: String,
    pub bank_name: String,
    pub account_number: String,
}

/// Struct branding gom các setting key (spec §5).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Branding {
    pub shop_name: String,
    pub shop_address: String,
    pub shop_phone: String,
    pub brand_color: String,       // hex, e.g. "#6F4E37"
    pub logo_path: Option<String>, // relative trong images/
    pub idle_bg_path: Option<String>,
    pub promo_images: Vec<String>, // JSON array path
    pub customer_welcome_text: String,
    pub bill_footer: String,
}
```

- [ ] **Step 2: Khai báo module** — thêm `pub mod customer;` vào `src-tauri/src/domain/mod.rs`.

- [ ] **Step 3: Build** — Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: OK.

- [ ] **Step 4: Commit**
```bash
git add src-tauri/src/domain/customer.rs src-tauri/src/domain/mod.rs
git commit -m "feat(domain): add CustomerView, CustomerPhase, PaymentQr, Branding domain structs"
```

---

## Task 4: Managed state `CustomerView` + helper `emit_customer_update`

**Files:** Sửa `src-tauri/src/lib.rs`; tạo `src-tauri/src/commands/customer.rs` (phần state + emit helper — commands đầy đủ ở Task 5).

Đây là phần cốt lõi của kiến trúc event-driven: khi nào cần phát sự kiện, dùng helper này. Phải implement trước Task 5 (integration vào orders/payments commands).

- [ ] **Step 1: Thêm managed state vào `src-tauri/src/lib.rs`** — thêm `mod commands; mod customer_state;` và cấu trúc:

Sửa `src-tauri/src/lib.rs` — thêm `use crate::domain::customer::CustomerView;` và quản lý `Mutex<CustomerView>`:

```rust
// Thêm vào phần use ở đầu lib.rs (sau `use crate::db::AppDb;`):
use crate::domain::customer::CustomerView;

// Thêm vào hàm run(), sau app.manage(AppDb(...)):
app.manage(std::sync::Mutex::new(CustomerView::default()));
```

Tham chiếu pattern đã có: `app.manage(AppDb(Mutex::new(conn)));` trong `lib.rs:28`.

- [ ] **Step 2: Tạo `src-tauri/src/commands/customer.rs`** — phần state + emit helper:

```rust
// src-tauri/src/commands/customer.rs
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::db::AppDb;
use crate::domain::customer::{
    Branding, CustomerOrderView, CustomerPaymentView, CustomerPhase, CustomerView, PaymentQr,
};
use crate::domain::orders::OrderType;
use crate::repo::{orders, settings};
use crate::services::vietqr;

// --------------- Emit helper (gọi từ orders + payments commands sau thay đổi đơn) ---------------

/// Lấy CustomerView hiện tại, cập nhật nếu cần, emit "customer://update".
/// Gọi từ: add_order_item, update_order_item, remove_order_item, apply_discount, add_payment, finalize_order.
pub fn emit_customer_update(
    app: &AppHandle,
    db: &State<'_, AppDb>,
    customer_state: &State<'_, Mutex<CustomerView>>,
) -> Result<(), String> {
    let view = {
        let guard = customer_state.lock().map_err(|e| e.to_string())?;
        guard.clone()
    };

    // Nếu phase Idle → không cần rebuild, chỉ emit
    let rebuilt = if matches!(view.phase, CustomerPhase::Idle) {
        view
    } else if let Some(order_id) = get_current_order_id(customer_state) {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let phase = {
            let guard = customer_state.lock().map_err(|e| e.to_string())?;
            guard.phase.clone()
        };
        rebuild_view(&conn, order_id, &phase, app).map_err(|e| e.to_string())?
    } else {
        view
    };

    {
        let mut guard = customer_state.lock().map_err(|e| e.to_string())?;
        *guard = rebuilt.clone();
    }

    app.emit("customer://update", &rebuilt).map_err(|e| e.to_string())
}

/// Lấy order_id đang được hiển thị từ state (dùng trick: serialize rồi check).
/// Đơn giản hơn: lưu order_id riêng. Ta dùng cách: kiểm tra order field.
fn get_current_order_id(state: &State<'_, Mutex<CustomerView>>) -> Option<i64> {
    // order_id không lưu trong CustomerView vì spec không expose. Cần lưu riêng.
    // → Dùng thread_local hoặc thêm field `current_order_id` vào CustomerView.
    // Để giữ CustomerView sạch (khớp spec §6 chỉ dùng cho serialization ra FE),
    // ta thêm wrapper state CustomerDisplayState { view, order_id }.
    // Xem Task 4 Step 3 bên dưới.
    let _ = state;
    None // placeholder — thay bằng impl thật ở Step 3
}

// --------------- CustomerDisplayState (internal, không serialize ra FE) ---------------

/// State nội bộ giữ cả view + order_id hiện tại (order_id không expose ra FE).
#[derive(Debug, Default)]
pub struct CustomerDisplayState {
    pub view: CustomerView,
    pub current_order_id: Option<i64>,
}

// --------------- Rebuild view từ DB ---------------

pub fn rebuild_view(
    conn: &rusqlite::Connection,
    order_id: i64,
    phase: &CustomerPhase,
    app: &AppHandle,
) -> rusqlite::Result<CustomerView> {
    let order = orders::get_order(conn, order_id)?;

    // Build table_name nếu DINE_IN
    let table_name: Option<String> = if matches!(order.order_type, OrderType::DineIn) {
        order.table_id.and_then(|tid| {
            conn.query_row(
                "SELECT name FROM tables WHERE id=?1",
                [tid],
                |r| r.get::<_, String>(0),
            ).ok()
        })
    } else {
        None
    };

    let items: Vec<crate::domain::customer::CustomerItemView> = order
        .items
        .iter()
        .map(|item| crate::domain::customer::CustomerItemView {
            name: item.product_name.clone(),
            size: item.size_name.clone(),
            sugar: item.sugar_level.clone(),
            ice: item.ice_level.clone(),
            qty: item.quantity,
            line_total: item.line_total,
            toppings: item
                .toppings
                .iter()
                .map(|t| crate::domain::customer::CustomerToppingView {
                    name: t.topping_name.clone(),
                    price: t.price,
                })
                .collect(),
        })
        .collect();

    let order_view = CustomerOrderView {
        code: order.code.clone(),
        order_type: match order.order_type {
            OrderType::DineIn => "DINE_IN".into(),
            OrderType::Takeaway => "TAKEAWAY".into(),
        },
        table_name,
        items,
        subtotal: order.subtotal,
        discount_total: order.discount_total,
        total: order.total,
    };

    let payment_view = if matches!(phase, CustomerPhase::Payment) {
        let bin = settings::get_setting(conn, "bank_bin")?.unwrap_or_default();
        let account = settings::get_setting(conn, "bank_account_number")?.unwrap_or_default();
        if !bin.is_empty() && !account.is_empty() {
            let content = format!("DH{}", order.code);
            let payload = vietqr::build_vietqr_payload(&bin, &account, order.total, &content);
            let qr_svg = vietqr::build_qr_svg(&payload);
            Some(CustomerPaymentView {
                qr_svg,
                amount: order.total,
                content,
                bank_name: vietqr::bank_name_by_bin(&bin),
                account_number: account,
            })
        } else {
            None
        }
    } else {
        None
    };

    Ok(CustomerView {
        phase: phase.clone(),
        order: if matches!(phase, CustomerPhase::Order | CustomerPhase::Payment) {
            Some(order_view)
        } else {
            None
        },
        payment: payment_view,
    })
}
```

- [ ] **Step 3: Refactor state thành `CustomerDisplayState`** — cập nhật `lib.rs` để manage `Mutex<CustomerDisplayState>` thay vì `Mutex<CustomerView>`:

```rust
// lib.rs — thay dòng manage CustomerView bằng:
use crate::commands::customer::CustomerDisplayState;
// ...
app.manage(Mutex::new(CustomerDisplayState::default()));
```

Và cập nhật signature của `emit_customer_update` trong `commands/customer.rs` để dùng `State<'_, Mutex<CustomerDisplayState>>`:

```rust
pub fn emit_customer_update_for_order(
    app: &AppHandle,
    db: &State<'_, AppDb>,
    cs: &State<'_, Mutex<CustomerDisplayState>>,
) -> Result<(), String> {
    let (order_id, phase) = {
        let guard = cs.lock().map_err(|e| e.to_string())?;
        (guard.current_order_id, guard.view.phase.clone())
    };
    let Some(order_id) = order_id else { return Ok(()); };
    if matches!(phase, CustomerPhase::Idle) { return Ok(()); }

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let rebuilt = rebuild_view(&conn, order_id, &phase, app).map_err(|e| e.to_string())?;
    drop(conn); // release lock trước khi lock cs

    {
        let mut guard = cs.lock().map_err(|e| e.to_string())?;
        guard.view = rebuilt.clone();
    }
    app.emit("customer://update", &rebuilt).map_err(|e| e.to_string())
}
```

- [ ] **Step 4: Build** — Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: OK (chưa có commands registered nên warning về unused, nhưng compile pass).

- [ ] **Step 5: Commit**
```bash
git add src-tauri/src/commands/customer.rs src-tauri/src/lib.rs
git commit -m "feat(customer): add CustomerDisplayState managed state + emit helper"
```

---

## Task 5: Tauri commands cho customer (9 commands mới)

**Files:** Hoàn thiện `src-tauri/src/commands/customer.rs`; Modify `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`.

- [ ] **Step 1: Khai báo module** — thêm `pub mod customer;` vào `src-tauri/src/commands/mod.rs`.

- [ ] **Step 2: Thêm 9 Tauri commands vào `commands/customer.rs`** — thêm phần commands vào cuối file (sau emit helper):

```rust
// ---- Commands ----

#[tauri::command]
pub fn open_customer_display(app: AppHandle) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;

    // Đóng cửa sổ cũ nếu đang mở (tránh duplicate)
    if let Some(existing) = app.get_webview_window("customer") {
        let _ = existing.close();
    }

    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary = app.primary_monitor().map_err(|e| e.to_string())?;

    // Tìm màn phụ (không phải primary)
    let secondary = primary.as_ref().and_then(|p| {
        monitors.iter().find(|m| m.position() != p.position())
    });

    let builder = WebviewWindowBuilder::new(&app, "customer", tauri::WebviewUrl::App("index.html#/customer".into()))
        .title("HiGi — Màn hình khách")
        .decorations(false)
        .always_on_top(true);

    if let Some(monitor) = secondary {
        // Mở fullscreen trên màn phụ
        let pos = monitor.position();
        let size = monitor.size();
        builder
            .position(pos.x as f64, pos.y as f64)
            .inner_size(size.width as f64, size.height as f64)
            .fullscreen(true)
            .build()
            .map_err(|e| e.to_string())?;
    } else {
        // 1 màn → cửa sổ thường để test
        builder
            .inner_size(1024.0, 600.0)
            .center()
            .build()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn close_customer_display(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("customer") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_customer_view(
    cs: State<'_, Mutex<CustomerDisplayState>>,
) -> Result<CustomerView, String> {
    let guard = cs.lock().map_err(|e| e.to_string())?;
    Ok(guard.view.clone())
}

/// Gọi từ Sales/Payment màn NV: chọn đơn để hiển thị lên màn khách.
/// phase: "idle" | "order" | "payment" | "thankyou"
#[tauri::command]
pub fn set_customer_order(
    app: AppHandle,
    db: State<'_, AppDb>,
    cs: State<'_, Mutex<CustomerDisplayState>>,
    order_id: i64,
    phase: String,
) -> Result<(), String> {
    let phase = parse_phase(&phase)?;
    {
        let mut guard = cs.lock().map_err(|e| e.to_string())?;
        guard.current_order_id = Some(order_id);
        guard.view.phase = phase.clone();
    }
    emit_customer_update_for_order(&app, &db, &cs)
}

/// Đổi phase mà không đổi order_id (vd: Order → Payment → ThankYou → Idle).
#[tauri::command]
pub fn set_customer_phase(
    app: AppHandle,
    db: State<'_, AppDb>,
    cs: State<'_, Mutex<CustomerDisplayState>>,
    phase: String,
) -> Result<(), String> {
    let phase = parse_phase(&phase)?;
    {
        let mut guard = cs.lock().map_err(|e| e.to_string())?;
        guard.view.phase = phase.clone();
        if matches!(phase, CustomerPhase::Idle | CustomerPhase::ThankYou) {
            // Khi sang Idle/ThankYou, xóa order snapshot khỏi view
            if matches!(phase, CustomerPhase::Idle) {
                guard.view.order = None;
                guard.view.payment = None;
                guard.current_order_id = None;
            }
        }
    }

    // ThankYou + Idle: emit ngay; không cần rebuild từ DB
    let phase_val = {
        let guard = cs.lock().map_err(|e| e.to_string())?;
        guard.view.phase.clone()
    };
    if matches!(phase_val, CustomerPhase::Idle | CustomerPhase::ThankYou) {
        let view = {
            let guard = cs.lock().map_err(|e| e.to_string())?;
            guard.view.clone()
        };
        app.emit("customer://update", &view).map_err(|e| e.to_string())?;
        return Ok(());
    }

    emit_customer_update_for_order(&app, &db, &cs)
}

/// Sinh QR thanh toán cho đơn. Gọi khi mở màn Payment.
#[tauri::command]
pub fn get_payment_qr(
    db: State<'_, AppDb>,
    order_id: i64,
) -> Result<PaymentQr, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let order = orders::get_order(&conn, order_id).map_err(|e| e.to_string())?;
    let bin = settings::get_setting(&conn, "bank_bin")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let account = settings::get_setting(&conn, "bank_account_number")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    if bin.is_empty() || account.is_empty() {
        return Err("Chưa cấu hình ngân hàng. Vào Cài đặt → Màn hình khách để cấu hình.".into());
    }
    let content = format!("DH{}", order.code);
    let payload = vietqr::build_vietqr_payload(&bin, &account, order.total, &content);
    let qr_svg = vietqr::build_qr_svg(&payload);
    Ok(PaymentQr {
        qr_svg,
        amount: order.total,
        content,
        bank_name: vietqr::bank_name_by_bin(&bin),
        account_number: account,
    })
}

#[tauri::command]
pub fn list_banks() -> Vec<crate::services::vietqr::Bank> {
    vietqr::list_banks()
}

/// Lấy branding (gom các setting key thành struct Branding).
#[tauri::command]
pub fn get_branding(db: State<'_, AppDb>) -> Result<Branding, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let get = |key: &str| -> String {
        settings::get_setting(&conn, key).ok().flatten().unwrap_or_default()
    };
    let promo_raw = get("promo_images");
    let promo_images: Vec<String> = if promo_raw.is_empty() {
        vec![]
    } else {
        serde_json::from_str(&promo_raw).unwrap_or_default()
    };
    Ok(Branding {
        shop_name: get("shop_name"),
        shop_address: get("shop_address"),
        shop_phone: get("shop_phone"),
        brand_color: {
            let c = get("brand_color");
            if c.is_empty() { "#6F4E37".into() } else { c }
        },
        logo_path: {
            let p = get("logo_path");
            if p.is_empty() { None } else { Some(p) }
        },
        idle_bg_path: {
            let p = get("idle_bg_path");
            if p.is_empty() { None } else { Some(p) }
        },
        promo_images,
        customer_welcome_text: {
            let t = get("customer_welcome_text");
            if t.is_empty() { "Chào mừng quý khách".into() } else { t }
        },
        bill_footer: {
            let f = get("bill_footer");
            if f.is_empty() { "Cảm ơn quý khách!".into() } else { f }
        },
    })
}

/// Lưu ảnh branding (logo / idle_bg / promo item) — tái dùng pattern image.rs M1.
/// `kind`: "logo" | "idle_bg" | "promo" — dùng để đặt tên file gợi nhớ (không bắt buộc).
/// Trả về relative path `images/<uuid>.<ext>` để lưu vào settings.
#[tauri::command]
pub fn save_branding_image(
    app: AppHandle,
    source_path: String,
    _kind: String,
) -> Result<String, String> {
    // Tái dùng hoàn toàn logic của `save_product_image` trong commands/image.rs
    // Gọi trực tiếp để không duplicate code:
    crate::commands::image::save_product_image(app, source_path)
}

// --------------- helpers ---------------

fn parse_phase(s: &str) -> Result<CustomerPhase, String> {
    match s {
        "idle" => Ok(CustomerPhase::Idle),
        "order" => Ok(CustomerPhase::Order),
        "payment" => Ok(CustomerPhase::Payment),
        "thankyou" => Ok(CustomerPhase::ThankYou),
        _ => Err(format!("phase không hợp lệ: {s}")),
    }
}
```

- [ ] **Step 3: Đăng ký 9 commands vào `lib.rs`** — thêm vào `invoke_handler(tauri::generate_handler![...])`  (sau `commands::image::read_image_data_url,`):

```rust
commands::customer::open_customer_display,
commands::customer::close_customer_display,
commands::customer::get_customer_view,
commands::customer::set_customer_order,
commands::customer::set_customer_phase,
commands::customer::get_payment_qr,
commands::customer::list_banks,
commands::customer::get_branding,
commands::customer::save_branding_image,
```

- [ ] **Step 4: Build** — Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: OK.

- [ ] **Step 5: Commit**
```bash
git add src-tauri/src/commands/customer.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(commands): add 9 customer display commands (open_window, get_view, set_order, get_payment_qr, get_branding, save_branding_image, list_banks)"
```

---

## Task 6: Tích hợp emit vào luồng NV — orders + payments commands

**Files:** Sửa `src-tauri/src/commands/orders.rs`; Sửa `src-tauri/src/commands/payments.rs`.

Đây là điểm tích hợp — mỗi lần NV thay đổi đơn đang hiển thị trên màn khách, màn khách tự cập nhật realtime.

**Quy tắc:** gọi `emit_customer_update_for_order(app, db, cs)` NGAY SAU KHI lệnh repo thành công, TRƯỚC KHI trả kết quả. Nếu emit fail → log error nhưng KHÔNG trả lỗi về FE (emit failure không nên block NV). `set_customer_phase("thankyou")` được gọi sau `finalize_order`.

- [ ] **Step 1: Sửa `commands/orders.rs`** — thêm `AppHandle`, `CustomerDisplayState` vào các commands sau:

Pattern cho `add_order_item` (tương tự cho `update_order_item`, `remove_order_item`):
```rust
// Thêm import ở đầu commands/orders.rs:
use std::sync::Mutex;
use tauri::AppHandle;
use crate::commands::customer::{CustomerDisplayState, emit_customer_update_for_order};

// Sửa signature:
#[tauri::command]
pub fn add_order_item(
    app: AppHandle,
    db: State<AppDb>,
    cs: State<'_, Mutex<CustomerDisplayState>>,
    order_id: i64,
    payload: OrderItemInput,
) -> Result<Order, String> {
    let conn = lock(&db)?;
    let order = orders::add_order_item(&conn, order_id, payload).map_err(|e| e.to_string())?;
    drop(conn); // release DB lock trước emit (tránh deadlock)
    let _ = emit_customer_update_for_order(&app, &db, &cs); // fire-and-forget
    Ok(order)
}
```

Áp tương tự cho: `update_order_item`, `remove_order_item`, `cancel_order`.

Chú ý `cancel_order`: sau cancel → `set_customer_phase("idle")` nếu đây là đơn đang hiển thị:
```rust
#[tauri::command]
pub fn cancel_order(
    app: AppHandle,
    db: State<AppDb>,
    cs: State<'_, Mutex<CustomerDisplayState>>,
    id: i64,
) -> Result<Order, String> {
    let conn = lock(&db)?;
    let order = orders::cancel_order(&conn, id).map_err(|e| e.to_string())?;
    drop(conn);
    // Nếu đây là đơn đang hiển thị → về Idle
    {
        let is_current = {
            let guard = cs.lock().map_err(|e| e.to_string())?;
            guard.current_order_id == Some(id)
        };
        if is_current {
            let mut guard = cs.lock().map_err(|e| e.to_string())?;
            *guard = CustomerDisplayState::default(); // reset to idle
            drop(guard);
            let view = crate::domain::customer::CustomerView::default();
            let _ = app.emit("customer://update", &view);
        } else {
            let _ = emit_customer_update_for_order(&app, &db, &cs);
        }
    }
    Ok(order)
}
```

- [ ] **Step 2: Sửa `commands/payments.rs`** — thêm emit vào `apply_discount`, `add_payment`, `finalize_order`:

```rust
// Thêm imports ở đầu commands/payments.rs:
use std::sync::Mutex;
use tauri::AppHandle;
use crate::commands::customer::{CustomerDisplayState, emit_customer_update_for_order};
use crate::domain::customer::CustomerPhase;

// apply_discount:
#[tauri::command]
pub fn apply_discount(
    app: AppHandle,
    db: State<AppDb>,
    cs: State<'_, Mutex<CustomerDisplayState>>,
    order_id: i64,
    payload: ApplyDiscountInput,
) -> Result<Order, String> {
    let conn = lock(&db)?;
    let order = payments::apply_discount(&conn, order_id, payload).map_err(|e| e.to_string())?;
    drop(conn);
    let _ = emit_customer_update_for_order(&app, &db, &cs);
    Ok(order)
}

// finalize_order: sau finalize → emit ThankYou phase
#[tauri::command]
pub fn finalize_order(
    app: AppHandle,
    db: State<AppDb>,
    cs: State<'_, Mutex<CustomerDisplayState>>,
    order_id: i64,
) -> Result<Order, String> {
    let conn = lock(&db)?;
    let order = payments::finalize_order(&conn, order_id).map_err(|e| e.to_string())?;
    drop(conn);
    // Sang ThankYou (timer về Idle phía FE ~6s)
    {
        let mut guard = cs.lock().map_err(|e| e.to_string())?;
        guard.view.phase = CustomerPhase::ThankYou;
        guard.view.payment = None; // ẩn QR
        // Giữ order view để hiện "Cảm ơn" kèm tên đơn nếu muốn
    }
    let view = {
        let guard = cs.lock().map_err(|e| e.to_string())?;
        guard.view.clone()
    };
    let _ = app.emit("customer://update", &view);
    Ok(order)
}

// add_payment (emit để cập nhật total nếu partial payment):
#[tauri::command]
pub fn add_payment(
    app: AppHandle,
    db: State<AppDb>,
    cs: State<'_, Mutex<CustomerDisplayState>>,
    order_id: i64,
    payload: PaymentInput,
) -> Result<Order, String> {
    let conn = lock(&db)?;
    let order = payments::add_payment(&conn, order_id, payload).map_err(|e| e.to_string())?;
    drop(conn);
    let _ = emit_customer_update_for_order(&app, &db, &cs);
    Ok(order)
}
```

- [ ] **Step 3: Build** — Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: OK. Có thể có warning unused imports trong commands chưa sửa — chấp nhận.

- [ ] **Step 4: Commit**
```bash
git add src-tauri/src/commands/orders.rs src-tauri/src/commands/payments.rs
git commit -m "feat(integration): emit customer://update on order mutations + ThankYou on finalize"
```

---

## Task 7: Bill branding — mở rộng `generate_bill_html`

**Files:** Sửa `src-tauri/src/repo/payments.rs` hàm `generate_bill_html` (dòng 272–326).

Hiện tại `generate_bill_html` đã đọc `shop_name`, `shop_address`, `shop_phone`, `bill_footer`. M8 thêm: logo (embed base64), `brand_color`, footer đúng.

- [ ] **Step 1: Sửa `generate_bill_html`** — thay hàm hiện tại bằng phiên bản mở rộng:

```rust
pub fn generate_bill_html(conn: &Connection, order_id: i64) -> rusqlite::Result<String> {
    let order = orders::get_order(conn, order_id)?;
    let get = |key: &str| -> String {
        settings::get_setting(conn, key)
            .ok()
            .flatten()
            .unwrap_or_default()
    };
    let shop_name = {
        let v = get("shop_name");
        if v.is_empty() { "HiGi POS".into() } else { v }
    };
    let shop_address = get("shop_address");
    let shop_phone = get("shop_phone");
    let footer = {
        let v = get("bill_footer");
        if v.is_empty() { "Cảm ơn quý khách!".into() } else { v }
    };
    let brand_color = {
        let v = get("brand_color");
        if v.is_empty() { "#6F4E37".into() } else { v }
    };
    let logo_path = get("logo_path"); // relative path trong images/

    // Embed logo dưới dạng base64 nếu có (tái dùng logic read_image_data_url)
    let logo_html = if !logo_path.is_empty() {
        // Dùng trực tiếp settings để lấy app_data_dir — không có app handle ở đây.
        // Lấy từ settings key "app_data_dir" mà setup() đã lưu, HOẶC bỏ qua nếu không có.
        // Giải pháp thực tế: truyền app_data_dir vào hàm, hoặc đọc env var.
        // M8 approach: thêm tham số `app_data_dir: Option<&str>` vào signature.
        // → Sửa signature của generate_bill_html thành:
        //   pub fn generate_bill_html(conn, order_id, app_data_dir: Option<&std::path::Path>)
        // Xem Step 2 bên dưới.
        String::new() // placeholder — thay bằng img tag sau khi refactor
    } else {
        String::new()
    };

    let rows = order
        .items
        .iter()
        .map(|item| {
            let toppings_html: String = item
                .toppings
                .iter()
                .map(|t| format!(
                    "<tr><td style=\"padding-left:16px;color:#666\">+ {}</td><td style=\"text-align:right;color:#666\">{}</td></tr>",
                    html_escape(&t.topping_name),
                    t.price
                ))
                .collect();
            format!(
                "<tr><td>{} x{}{}{}</td><td style=\"text-align:right\">{}</td></tr>{}",
                html_escape(&item.product_name),
                item.quantity,
                item.size_name.as_deref().map(|s| format!(" ({})", s)).unwrap_or_default(),
                item.sugar_level.as_deref().map(|s| format!(" · {s}")).unwrap_or_default(),
                item.line_total,
                toppings_html
            )
        })
        .collect::<String>();

    Ok(format!(
        r#"<!doctype html>
<html><head><meta charset="utf-8"><title>Hoá đơn {code}</title>
<style>
:root {{ --brand: {brand_color}; }}
body {{ font-family: Arial, sans-serif; max-width: 320px; margin: 0 auto; color: #111; }}
.header {{ text-align: center; border-bottom: 2px solid var(--brand); padding-bottom: 8px; margin-bottom: 8px; }}
.header h1 {{ font-size: 18px; margin: 4px 0; color: var(--brand); }}
.header p {{ margin: 2px 0; font-size: 11px; color: #555; }}
.logo {{ max-width: 80px; max-height: 80px; display: block; margin: 0 auto 4px; }}
.meta {{ font-size: 11px; margin: 4px 0; }}
table {{ width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }}
td {{ border-bottom: 1px dashed #ddd; padding: 5px 0; }}
.subtotal-row td {{ color: #555; font-size: 11px; }}
.discount-row td {{ color: #e53e3e; font-size: 11px; }}
.total-row td {{ font-size: 16px; font-weight: bold; color: var(--brand); border-top: 2px solid var(--brand); border-bottom: none; padding-top: 8px; }}
.footer {{ text-align: center; margin-top: 16px; font-size: 11px; color: #555; border-top: 1px dashed #ccc; padding-top: 8px; }}
@media print {{ body {{ margin: 0; }} button {{ display: none; }} }}
</style></head>
<body>
<div class="header">
{logo_html}
<h1>{shop_name}</h1>
<p>{shop_address}</p>
<p>{shop_phone}</p>
</div>
<p class="meta">Mã đơn: <strong>{code}</strong></p>
<p class="meta">Thời gian: {paid_at}</p>
<table>
{rows}
<tr class="subtotal-row"><td>Tạm tính</td><td style="text-align:right">{subtotal}</td></tr>
<tr class="discount-row"><td>Giảm giá</td><td style="text-align:right">-{discount}</td></tr>
<tr class="total-row"><td>TỔNG CỘNG</td><td style="text-align:right">{total}</td></tr>
</table>
<div class="footer">{footer}</div>
</body></html>"#,
        code = html_escape(&order.code),
        shop_name = html_escape(&shop_name),
        shop_address = html_escape(&shop_address),
        shop_phone = html_escape(&shop_phone),
        brand_color = html_escape(&brand_color),
        logo_html = logo_html,
        rows = rows,
        subtotal = order.subtotal,
        discount = order.discount_total,
        total = order.total,
        paid_at = html_escape(&order.paid_at.unwrap_or(order.created_at)),
        footer = html_escape(&footer)
    ))
}
```

- [ ] **Step 2: Thêm `app_data_dir` param + embed logo** — sửa signature thành:

```rust
pub fn generate_bill_html(
    conn: &Connection,
    order_id: i64,
    app_data_dir: Option<&std::path::Path>,
) -> rusqlite::Result<String>
```

Và trong `logo_html`:
```rust
let logo_html = if !logo_path.is_empty() {
    if let Some(dir) = app_data_dir {
        let full = dir.join(&logo_path);
        if let Ok(bytes) = std::fs::read(&full) {
            let ext = full.extension().and_then(|e| e.to_str()).unwrap_or("png");
            let mime = match ext { "jpg" | "jpeg" => "image/jpeg", "webp" => "image/webp", _ => "image/png" };
            use base64::Engine;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            format!("<img class=\"logo\" src=\"data:{mime};base64,{b64}\" alt=\"logo\">")
        } else { String::new() }
    } else { String::new() }
} else { String::new() };
```

- [ ] **Step 3: Cập nhật caller** — trong `src-tauri/src/commands/payments.rs`, lệnh `generate_bill_html`:

```rust
#[tauri::command]
pub fn generate_bill_html(
    app: tauri::AppHandle,
    db: State<AppDb>,
    order_id: i64,
) -> Result<String, String> {
    let conn = lock(&db)?;
    let app_data_dir = app.path().app_data_dir().ok();
    payments::generate_bill_html(&conn, order_id, app_data_dir.as_deref())
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 4: Build + test** — Run:
```bash
cargo build --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml bill
```
Expected: build + tests pass. Lưu ý: test hiện tại trong `repo/payments.rs` gọi `generate_bill_html(conn, id)` — cần cập nhật thêm `None` cho param mới.

- [ ] **Step 5: Commit**
```bash
git add src-tauri/src/repo/payments.rs src-tauri/src/commands/payments.rs
git commit -m "feat(bill): extend generate_bill_html with logo, brand_color, toppings, styled total row"
```

---

## Task 8: Frontend — API wrappers (`customer.ts` + `branding.ts`)

**Files:** Create `src/lib/api/customer.ts`; Create `src/lib/api/branding.ts`.

Theo mẫu `src/lib/api/menu.ts` — `invoke` wrappers + TS types khớp domain Rust.

- [ ] **Step 1: Tạo `src/lib/api/customer.ts`**:

```typescript
// src/lib/api/customer.ts
import { invoke } from "@tauri-apps/api/core"

export type CustomerPhase = "idle" | "order" | "payment" | "thankyou"

export type CustomerToppingView = {
  name: string
  price: number
}

export type CustomerItemView = {
  name: string
  size: string | null
  sugar: string | null
  ice: string | null
  qty: number
  line_total: number
  toppings: CustomerToppingView[]
}

export type CustomerOrderView = {
  code: string
  type: "DINE_IN" | "TAKEAWAY"
  table_name: string | null
  items: CustomerItemView[]
  subtotal: number
  discount_total: number
  total: number
}

export type CustomerPaymentView = {
  qr_svg: string
  amount: number
  content: string
  bank_name: string
  account_number: string
}

export type CustomerView = {
  phase: CustomerPhase
  order?: CustomerOrderView
  payment?: CustomerPaymentView
}

export type PaymentQr = {
  qr_svg: string
  amount: number
  content: string
  bank_name: string
  account_number: string
}

export function getCustomerView(): Promise<CustomerView> {
  return invoke("get_customer_view")
}

export function setCustomerOrder(orderId: number, phase: CustomerPhase): Promise<void> {
  return invoke("set_customer_order", { order_id: orderId, phase })
}

export function setCustomerPhase(phase: CustomerPhase): Promise<void> {
  return invoke("set_customer_phase", { phase })
}

export function getPaymentQr(orderId: number): Promise<PaymentQr> {
  return invoke("get_payment_qr", { order_id: orderId })
}

export function openCustomerDisplay(): Promise<void> {
  return invoke("open_customer_display")
}

export function closeCustomerDisplay(): Promise<void> {
  return invoke("close_customer_display")
}
```

- [ ] **Step 2: Tạo `src/lib/api/branding.ts`**:

```typescript
// src/lib/api/branding.ts
import { invoke } from "@tauri-apps/api/core"

export type Branding = {
  shop_name: string
  shop_address: string
  shop_phone: string
  brand_color: string
  logo_path: string | null
  idle_bg_path: string | null
  promo_images: string[]
  customer_welcome_text: string
  bill_footer: string
}

export type Bank = {
  bin: string
  name: string
  short_name: string
}

export function getBranding(): Promise<Branding> {
  return invoke("get_branding")
}

export function listBanks(): Promise<Bank[]> {
  return invoke("list_banks")
}

/** Lưu ảnh branding (dialog chọn file → copy vào images/). Trả relative path. */
export function saveBrandingImage(sourcePath: string, kind: string): Promise<string> {
  return invoke("save_branding_image", { source_path: sourcePath, kind })
}
```

- [ ] **Step 3: Commit**
```bash
git add src/lib/api/customer.ts src/lib/api/branding.ts
git commit -m "feat(fe-api): add customer.ts and branding.ts invoke wrappers"
```

---

## Task 9: Frontend — route `#/customer` + 4 màn hình

**Files:** Create `src/routes/Customer.tsx`; Create các subcomponent; Sửa `src/App.tsx`.

Theo spec §7 wireframes. Dùng Tailwind + shadcn/ui. Chữ to, tối ưu màn nằm ngang, không có navbar. Branding load 1 lần qua `get_branding()` lúc mount + reload khi nhận `branding://update`.

- [ ] **Step 1: Tạo `src/routes/Customer.tsx`** — root component cho route `/customer`:

```tsx
// src/routes/Customer.tsx
import { useEffect, useRef, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import { getCustomerView, type CustomerView } from "@/lib/api/customer"
import { getBranding, type Branding } from "@/lib/api/branding"
import IdleScreen from "./customer/IdleScreen"
import OrderScreen from "./customer/OrderScreen"
import PaymentScreen from "./customer/PaymentScreen"
import ThankYouScreen from "./customer/ThankYouScreen"

const DEFAULT_BRANDING: Branding = {
  shop_name: "HiGi Coffee",
  shop_address: "",
  shop_phone: "",
  brand_color: "#6F4E37",
  logo_path: null,
  idle_bg_path: null,
  promo_images: [],
  customer_welcome_text: "Chào mừng quý khách",
  bill_footer: "Cảm ơn quý khách!",
}

export default function CustomerDisplay() {
  const [view, setView] = useState<CustomerView>({ phase: "idle" })
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING)

  useEffect(() => {
    // Load trạng thái hiện tại lúc mount
    getCustomerView().then(setView).catch(console.error)
    getBranding().then(setBranding).catch(console.error)

    // Lắng nghe update từ cửa sổ NV
    const unlisten = listen<CustomerView>("customer://update", (event) => {
      setView(event.payload)
    })
    const unlistenBranding = listen<void>("branding://update", () => {
      getBranding().then(setBranding).catch(console.error)
    })

    return () => {
      unlisten.then((fn) => fn())
      unlistenBranding.then((fn) => fn())
    }
  }, [])

  const { brand_color } = branding

  return (
    <div
      className="w-screen h-screen overflow-hidden bg-white"
      style={{ "--brand": brand_color } as React.CSSProperties}
    >
      {view.phase === "idle" && <IdleScreen branding={branding} />}
      {view.phase === "order" && view.order && (
        <OrderScreen order={view.order} branding={branding} />
      )}
      {view.phase === "payment" && view.order && (
        <PaymentScreen order={view.order} payment={view.payment ?? null} branding={branding} />
      )}
      {view.phase === "thankyou" && (
        <ThankYouScreen branding={branding} onDone={() => setView({ phase: "idle" })} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Tạo `src/routes/customer/IdleScreen.tsx`** — theo wireframe §7 "Idle":

```tsx
// Màn chờ: logo lớn căn giữa, shop_name, customer_welcome_text, slideshow promo.
// - bg: bg-[--brand]/5 (rất nhạt); logo max 160px; promo images đổi mỗi 5s.
// - Dùng Tailwind: "flex flex-col items-center justify-center h-full gap-6"
// Props: { branding: Branding }
// Slideshow: dùng useState(0) + useEffect setInterval 5000ms → index % promo_images.length
// Logo: dùng read_image_data_url (invoke) nếu logo_path có, cache vào state.
// Nền idle: nếu idle_bg_path → <img class="absolute inset-0 w-full h-full object-cover opacity-20">
```

Cài đặt theo mô tả trên — component tương đối đơn giản. Tham chiếu spec §7 "Idle" wireframe.

- [ ] **Step 3: Tạo `src/routes/customer/OrderScreen.tsx`** — theo wireframe §7 "Order":

```tsx
// Header: bg-[--brand] text-white, [logo nhỏ] + shop_name bên trái, tên bàn bên phải.
// Body: danh sách cuộn (overflow-y-auto) — mỗi item: tên + (size · sugar) x qty = line_total
//       toppings indent nhỏ hơn.
// Footer: "TỔNG CỘNG" + formatVnd(total) — text-4xl font-bold text-[--brand].
// Props: { order: CustomerOrderView; branding: Branding }
// Dùng formatVnd từ @/lib/format.ts
```

- [ ] **Step 4: Tạo `src/routes/customer/PaymentScreen.tsx`** — theo wireframe §7 "Payment":

```tsx
// Layout 2 cột: trái = QR SVG (dangerouslySetInnerHTML={{ __html: payment.qr_svg }}) 280px;
// phải = TỔNG TIỀN (text-5xl), bank_name, account_number, nội dung CK.
// Header brand như OrderScreen.
// Props: { order: CustomerOrderView; payment: CustomerPaymentView | null; branding: Branding }
// Nếu payment null (chưa có QR) → hiện spinner hoặc thông báo "Đang tải QR...".
```

- [ ] **Step 5: Tạo `src/routes/customer/ThankYouScreen.tsx`** — theo wireframe §7 "Thank-you":

```tsx
// Căn giữa: logo, "Cảm ơn quý khách! ♥" text-5xl, "Hẹn gặp lại" text-2xl.
// useEffect: setTimeout 6000ms → onDone() (callback → setView idle ở Customer.tsx)
// Props: { branding: Branding; onDone: () => void }
```

- [ ] **Step 6: Đăng ký route trong `src/App.tsx`** — thêm vào `createHashRouter`:

```tsx
import CustomerDisplay from "@/routes/Customer"
// Trong router array:
{ path: "/customer", element: <CustomerDisplay /> },
```

- [ ] **Step 7: Build FE** — Run: `npm run build` (hoặc `npx tauri build --debug`)
Expected: build pass, không có TypeScript error.

- [ ] **Step 8: Commit**
```bash
git add src/routes/Customer.tsx src/routes/customer/ src/App.tsx
git commit -m "feat(fe): add customer display route with 4 phase screens (Idle/Order/Payment/ThankYou)"
```

---

## Task 10: Settings UI — "Cá nhân hóa" + "Màn hình khách"

**Files:** Sửa `src/routes/Settings.tsx`.

Theo pattern đã có trong Settings.tsx — thêm 2 section mới phía dưới section chiết khấu. Dùng `getBranding`, `listBanks`, `saveBrandingImage`, `openCustomerDisplay`, `closeCustomerDisplay`, `readImageDataUrl` (từ image api).

- [ ] **Step 1: Thêm state + load branding** — trong Settings component:

```tsx
// Thêm import:
import { getBranding, listBanks, saveBrandingImage, type Branding, type Bank } from "@/lib/api/branding"
import { openCustomerDisplay, closeCustomerDisplay } from "@/lib/api/customer"
import { open } from "@tauri-apps/plugin-dialog"  // dialog chọn file

// Thêm state:
const [branding, setBranding] = useState<Branding>({ ... default ... })
const [banks, setBanks] = useState<Bank[]>([])
const [bankBin, setBankBin] = useState("")
const [bankAccount, setBankAccount] = useState("")
const [bankAccountName, setBankAccountName] = useState("")
```

Trong `refresh()`, thêm: `getBranding().then(setBranding)`, `listBanks().then(setBanks)`.

Load `bank_bin`, `bank_account_number`, `bank_account_name` từ `getSettingsBulk` (thêm vào `settingKeys`).

- [ ] **Step 2: Section "Cá nhân hóa"** — thêm vào JSX (tham chiếu spec §5):

```tsx
{/* === Section Cá nhân hóa === */}
<section className="border rounded-lg p-4 space-y-4">
  <h2 className="text-lg font-semibold">Cá nhân hóa thương hiệu</h2>

  {/* Logo */}
  <div className="flex items-center gap-3">
    <label className="text-sm w-32">Logo quán</label>
    {branding.logo_path && <img ... />} {/* hiện preview nếu có */}
    <Button variant="outline" onClick={async () => {
      const path = await open({ filters: [{ name: "Image", extensions: ["png","jpg","jpeg","webp"] }] })
      if (path && typeof path === "string") {
        const rel = await saveBrandingImage(path, "logo")
        // Lưu vào settings:
        await invoke("set_settings_bulk", { payload: [{ key: "logo_path", value: rel }] })
        getBranding().then(setBranding)
      }
    }}>Chọn ảnh logo</Button>
  </div>

  {/* brand_color */}
  <div className="flex items-center gap-3">
    <label className="text-sm w-32">Màu thương hiệu</label>
    <Input type="color" className="w-16 h-8 p-0 cursor-pointer"
      value={branding.brand_color}
      onChange={(e) => setBranding(b => ({ ...b, brand_color: e.target.value }))} />
    <span className="text-xs text-muted-foreground">{branding.brand_color}</span>
  </div>

  {/* shop_name, customer_welcome_text, bill_footer — dùng Input thông thường */}
  {/* Ánh xạ thẳng vào settings qua setSettingsBulk khi nhấn "Lưu cài đặt" */}

  {/* idle_bg_path — tương tự logo */}
  {/* promo_images — list + thêm/xóa ảnh, serialize thành JSON để lưu vào setting "promo_images" */}
</section>

{/* === Section Màn hình khách === */}
<section className="border rounded-lg p-4 space-y-4">
  <h2 className="text-lg font-semibold">Màn hình khách (VietQR)</h2>

  {/* Bank dropdown */}
  <div className="flex items-center gap-3">
    <label className="text-sm w-32">Ngân hàng</label>
    <select className="border rounded px-2 py-1 text-sm"
      value={bankBin}
      onChange={(e) => setBankBin(e.target.value)}>
      <option value="">-- Chọn ngân hàng --</option>
      {banks.map(b => <option key={b.bin} value={b.bin}>{b.short_name} ({b.bin})</option>)}
    </select>
  </div>

  {/* Số tài khoản, Tên tài khoản */}
  <div className="flex items-center gap-3">
    <label className="text-sm w-32">Số tài khoản</label>
    <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="1234567890" />
  </div>
  <div className="flex items-center gap-3">
    <label className="text-sm w-32">Tên tài khoản</label>
    <Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="NGUYEN VAN A" />
  </div>

  {/* Nút Mở / Đóng màn hình khách */}
  <div className="flex gap-2">
    <Button onClick={() => openCustomerDisplay().catch(setError)}>Mở màn hình khách</Button>
    <Button variant="outline" onClick={() => closeCustomerDisplay().catch(setError)}>Đóng</Button>
  </div>
</section>
```

- [ ] **Step 3: Thêm bank settings vào save** — trong `handleSave` (hoặc nút "Lưu cài đặt"), thêm các key mới:

```ts
// Thêm vào payload của setSettingsBulk khi lưu:
{ key: "bank_bin", value: bankBin },
{ key: "bank_account_number", value: bankAccount },
{ key: "bank_account_name", value: bankAccountName },
{ key: "brand_color", value: branding.brand_color },
{ key: "customer_welcome_text", value: branding.customer_welcome_text },
// logo_path, idle_bg_path, promo_images lưu ngay khi chọn file (xem Step 2)
```

- [ ] **Step 4: Build + Vitest** — Run: `npm run build`
Expected: OK.

- [ ] **Step 5: Commit**
```bash
git add src/routes/Settings.tsx
git commit -m "feat(settings): add Branding + Customer Display sections with bank dropdown and open window button"
```

---

## Task 11: Tests — FE (Vitest) + Rust branding

**Files:** Create `src/routes/customer/CustomerDisplay.test.tsx`; Sửa branding settings tests.

Mục tiêu: kiểm tra 4 trạng thái render theo `phase`, `formatVnd`, timer ThankYou.

- [ ] **Step 1: Tạo `src/routes/customer/CustomerDisplay.test.tsx`**:

```tsx
// src/routes/customer/CustomerDisplay.test.tsx
import { render, screen, act } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import ThankYouScreen from "./ThankYouScreen"
import OrderScreen from "./OrderScreen"
import PaymentScreen from "./PaymentScreen"
import type { CustomerOrderView } from "@/lib/api/customer"
import type { Branding } from "@/lib/api/branding"

const DEFAULT_BRANDING: Branding = {
  shop_name: "Test", shop_address: "", shop_phone: "",
  brand_color: "#6F4E37", logo_path: null, idle_bg_path: null,
  promo_images: [], customer_welcome_text: "Chào", bill_footer: "Cảm ơn",
}

const SAMPLE_ORDER: CustomerOrderView = {
  code: "ORD-001", type: "TAKEAWAY", table_name: null,
  items: [{ name: "Cà phê sữa", size: "L", sugar: "70%", ice: "Vừa",
            qty: 2, line_total: 60000, toppings: [] }],
  subtotal: 60000, discount_total: 0, total: 60000,
}

describe("OrderScreen", () => {
  it("hiển thị tên món và tổng tiền", () => {
    render(<OrderScreen order={SAMPLE_ORDER} branding={DEFAULT_BRANDING} />)
    expect(screen.getByText(/Cà phê sữa/)).toBeTruthy()
    expect(screen.getByText(/60\.000/)).toBeTruthy()
  })
})

describe("PaymentScreen", () => {
  it("hiển thị 'Đang tải QR' khi không có payment", () => {
    render(<PaymentScreen order={SAMPLE_ORDER} payment={null} branding={DEFAULT_BRANDING} />)
    expect(screen.getByText(/Đang tải QR/i)).toBeTruthy()
  })

  it("hiển thị SVG QR khi có payment", () => {
    const payment = {
      qr_svg: "<svg><rect/></svg>", amount: 60000,
      content: "DHORD-001", bank_name: "Vietcombank", account_number: "123",
    }
    render(<PaymentScreen order={SAMPLE_ORDER} payment={payment} branding={DEFAULT_BRANDING} />)
    expect(screen.getByText("Vietcombank")).toBeTruthy()
  })
})

describe("ThankYouScreen", () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it("gọi onDone sau 6 giây", () => {
    const onDone = vi.fn()
    render(<ThankYouScreen branding={DEFAULT_BRANDING} onDone={onDone} />)
    expect(onDone).not.toBeCalled()
    act(() => { vi.advanceTimersByTime(6001) })
    expect(onDone).toBeCalledTimes(1)
  })
})
```

- [ ] **Step 2: Chạy Vitest** — Run: `npx vitest run src/routes/customer/`
Expected: 4 tests pass.

- [ ] **Step 3: Rust test branding get/set** — thêm vào `src-tauri/src/services/vietqr.rs::tests` (hoặc tạo test trong `repo/settings.rs`):

```rust
// Thêm vào repo/settings.rs #[cfg(test)] mod tests:
#[test]
fn branding_settings_round_trip() {
    let mut c = rusqlite::Connection::open_in_memory().unwrap();
    crate::db::migrations::run(&mut c).unwrap();
    set_setting(&c, "brand_color", "#FF5733").unwrap();
    set_setting(&c, "shop_name", "HiGi Test").unwrap();
    set_setting(&c, "logo_path", "images/logo.png").unwrap();
    assert_eq!(get_setting(&c, "brand_color").unwrap().unwrap(), "#FF5733");
    assert_eq!(get_setting(&c, "shop_name").unwrap().unwrap(), "HiGi Test");
    assert_eq!(get_setting(&c, "logo_path").unwrap().unwrap(), "images/logo.png");
}
```

- [ ] **Step 4: Chạy tất cả Rust tests** — Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: tất cả tests pass (bao gồm vietqr, branding_settings_round_trip).

- [ ] **Step 5: Commit**
```bash
git add src/routes/customer/CustomerDisplay.test.tsx src-tauri/src/repo/settings.rs
git commit -m "test: add CustomerDisplay phase tests (Vitest) + branding settings round-trip (Rust)"
```

---

## Task 12: Verify thủ công — quét VietQR bằng app ngân hàng thật

Đây là bước bắt buộc theo spec §4 và §9 — không thể tự động hóa.

- [ ] **Step 1: Chuẩn bị** — Khởi động app (`npx tauri dev`), vào Settings → Màn hình khách → chọn ngân hàng (ví dụ Vietcombank BIN 970436) + nhập số TK thật + tên TK.

- [ ] **Step 2: Tạo đơn test** — Vào Sales → tạo đơn TAKEAWAY với 1 món, bấm Thanh toán. Màn NV hiện màn Payment.

- [ ] **Step 3: Mở màn hình khách** — Vào Settings → bấm "Mở màn hình khách" → cửa sổ khách mở (1 màn → cửa sổ thường 1024×600).

- [ ] **Step 4: Điều hướng qua `set_customer_order`** — Từ Sales, bấm vào đơn để set phase=order → xác nhận màn khách hiện OrderScreen với items đúng. Bấm Thanh toán → phase=payment → màn khách hiện QR.

- [ ] **Step 5: Quét QR** — Dùng app ngân hàng thật (VCB, MB, MoMo...) quét QR trên màn khách:
  - [ ] Số tiền tự điền đúng (khớp total đơn).
  - [ ] Nội dung CK tự điền đúng dạng `DH<order.code>`.
  - [ ] Số tài khoản nhận đúng.
  - [ ] **Ghi lại kết quả:** Bank đã test: ______, Kết quả: Pass / Fail.

- [ ] **Step 6: Verify branding** — Vào Settings → Cá nhân hóa → tải lên logo, chọn màu thương hiệu #6F4E37, lưu → màn khách idle cập nhật logo + màu → in bill → bill có logo + màu đúng.

- [ ] **Step 7: Verify Thank-you timer** — Sau finalize_order → màn khách hiện ThankYou → đợi 6s → tự về Idle. Xác nhận.

- [ ] **Step 8: Verify 2-monitor** (nếu có màn 2) — cắm HDMI → bấm "Mở màn hình khách" → cửa sổ fullscreen đúng màn phụ.

---

## Definition of Done (khớp spec §10)

- [ ] Cắm màn 2 → "Mở màn hình khách" → cửa sổ khách fullscreen trên màn phụ. 1 màn → cửa sổ thường 1024×600.
- [ ] NV thêm/sửa/xóa món đang active → màn khách hiện items + tổng tiền cập nhật **realtime** (không F5).
- [ ] Bấm sang Payment → màn khách hiện **VietQR** (SVG offline) + tổng tiền. Quét bằng app ngân hàng thật → **số tiền + nội dung tự điền đúng**.
- [ ] `finalize_order` → màn khách hiện Thank-you → tự về Idle sau ~6s.
- [ ] Settings branding → logo/màu/ảnh nền/ảnh KM/info → áp đúng lên **màn khách** (idle header/slideshow) và **hoá đơn in** (logo + brand_color + shop info + footer).
- [ ] Toàn bộ offline — không cần mạng, không phí bản quyền, QR sinh trong Rust.
- [ ] Không có màn 2 → vẫn chạy + test được bình thường.
- [ ] `cargo test` xanh: VietQR CRC16 (`0x29B1`), payload_crc_is_self_consistent, build_qr_svg_returns_valid_svg, branding_settings_round_trip, generate_bill_html tests.
- [ ] Vitest xanh: OrderScreen render, PaymentScreen QR, ThankYouScreen timer 6s.
- [ ] CI xanh trên branch `fix/v1-clickable-workflows` → merge vào `main`.
