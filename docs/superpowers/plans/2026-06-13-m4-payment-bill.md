# M4 — Thanh toán + Khuyến mãi + Bill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn tất vòng đời đơn hàng — quản lý chiết khấu (preset + thủ công, cấp đơn/cấp dòng), màn hình thanh toán (chọn Cash/QR), `finalize_order` (OPEN → PAID + nhả bàn + ghi `paid_at`), in bill HTML (in-app `window.print`) với móc ESC/POS để M7 mở rộng.

**Architecture:** Migration `0005_payments.sql` → `domain/payments.rs` → `services/payment.rs` (logic tiền tệ + finalize) → `repo/payments.rs` (CRUD + load discounts + payments) → `commands/payments.rs` → `src/lib/api/payments.ts` → `src/routes/Payment.tsx`. Bill HTML render trong React component + `window.print()` — không cần thư viện PDF ngoài, để hook ESC/POS thermal printer ở `printing/bill.rs` (Rust stub trả `String` path) sẽ implement ở M7. Service `services/payment.rs` là nơi DUY NHẤT tính `amount_applied`, `discount_total`, `change_due`, `total` sau discount. `services/order.rs` (M3) cung cấp `compute_subtotal`, `round_vnd`, `compute_total` — M4 tái dùng trực tiếp.

**Tech Stack:** rusqlite + rusqlite_migration (sẵn từ M0), React + shadcn/ui, `window.print()` cho bill (CSS `@media print`), cargo test (TDD money math), Vitest (tùy chọn cho cart display). Không thêm dep PDF.

**Spec:** `docs/superpowers/specs/2026-06-12-higi-pos-design.md` §6 (màn hình thanh toán), §7.2 (payment), §7.3 (money rules).
**Contract (AUTHORITATIVE):** `docs/superpowers/plans/2026-06-13-m2-m7-contract.md` §1 (SQL M4), §3 (command signatures, domain structs `domain/payments.rs`), §4 (money rules — đây là nguồn sự thật).
**M3 plan (M4 mở rộng):** `docs/superpowers/plans/2026-06-13-m3-sales.md` — schema orders/order_items, service/order.rs.
**Mẫu code (đã có):** `src-tauri/src/repo/menu.rs` (transaction, row-mapper, tests), `src-tauri/src/commands/menu.rs` (lock helper, map_err), `src-tauri/src/services/order.rs` (compute_line_total, compute_subtotal, round_vnd, compute_total), `src/lib/format.ts` (formatVnd).

---

## File Structure

| File | Trách nhiệm |
|---|---|
| `src-tauri/migrations/0005_payments.sql` | Tạo bảng `discounts`, `order_discounts`, `payments` |
| `src-tauri/src/domain/payments.rs` | Struct/enum: Discount, DiscountInput, OrderDiscount, ApplyDiscountInput, Payment, PaymentInput, DiscountType, DiscountScope, PaymentMethod |
| `src-tauri/src/services/payment.rs` | Logic: `apply_order_discount`, `compute_order_totals_with_discounts`, `compute_change_due`, `validate_finalize`; unit tests TDD |
| `src-tauri/src/repo/payments.rs` | CRUD discounts; `apply_discount` (ghi order_discounts + recompute); `add_payment`; `finalize_order`; `load_order_discounts`; `load_payments`; unit tests |
| `src-tauri/src/commands/payments.rs` | Tauri commands lock AppDb → gọi repo/service → map_err |
| `src-tauri/src/printing/bill.rs` | `generate_bill_html(conn, order_id) -> rusqlite::Result<String>` — trả HTML string; stub `generate_bill_pdf` trả path placeholder cho ESC/POS M7 |
| `src/lib/api/payments.ts` | invoke wrapper + TS types khớp domain |
| `src/routes/Payment.tsx` | Màn hình thanh toán: tóm tắt đơn, danh sách chiết khấu, nhập tiền mặt/QR, nút Hoàn tất, preview bill |
| `src/routes/payment/DiscountPanel.tsx` | Panel chọn preset discount + nhập thủ công |
| `src/routes/payment/CashInput.tsx` | Bàn phím số tiền mặt → hiện tiền thừa |
| `src/routes/payment/BillPreview.tsx` | Component bill HTML (in-app + `window.print`) |
| Sửa: `src-tauri/src/domain/mod.rs` | Thêm `pub mod payments;` |
| Sửa: `src-tauri/src/domain/orders.rs` | Thay `Vec<OrderDiscount>` placeholder bằng import thật từ `domain::payments` |
| Sửa: `src-tauri/src/services/mod.rs` | Thêm `pub mod payment;` |
| Sửa: `src-tauri/src/repo/mod.rs` | Thêm `pub mod payments;` |
| Sửa: `src-tauri/src/repo/orders.rs` | `load_order` populate `discounts` + `payments` từ repo/payments helpers |
| Sửa: `src-tauri/src/commands/mod.rs` | Thêm `pub mod payments;` |
| Sửa: `src-tauri/src/lib.rs` | Thêm `mod printing;` + đăng ký commands M4 vào `generate_handler!` |
| Sửa: `src-tauri/src/db/migrations.rs` | Append `0005_payments.sql` vào CUỐI vec; thêm schema test |
| Sửa: `src/App.tsx` | Thêm route `/payment/:orderId` |
| Sửa: `src/routes/Sales.tsx` | Nút "Thanh toán" → navigate `/payment/:orderId` |

> **Dependency M3:** `0004_orders.sql` phải có trong vec trước `0005_payments.sql`. M4 plan giả định M3 đã land. Nếu M3 chưa land: append `0003_tables.sql`, `0004_orders.sql` trước `0005_payments.sql` theo thứ tự.

---

## Task 1: Migration 0005 — bảng payments

**Files:** Create `src-tauri/migrations/0005_payments.sql`; Modify `src-tauri/src/db/migrations.rs`.

- [ ] **Step 1: Tạo `src-tauri/migrations/0005_payments.sql`** — copy CHÍNH XÁC từ contract §1 M4:

```sql
CREATE TABLE discounts (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('PERCENT','AMOUNT')),
  value      INTEGER NOT NULL,                      -- PERCENT: 0..100 ; AMOUNT: VND
  scope      TEXT NOT NULL CHECK (scope IN ('ORDER','ITEM')),
  is_active  INTEGER NOT NULL DEFAULT 1,
  valid_from TEXT,
  valid_to   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE order_discounts (
  id             INTEGER PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_id    INTEGER REFERENCES discounts(id),  -- nullable: manual discount or deleted preset
  name           TEXT NOT NULL,                     -- snapshot
  type           TEXT NOT NULL CHECK (type IN ('PERCENT','AMOUNT')),  -- snapshot
  value          INTEGER NOT NULL,                  -- snapshot
  amount_applied INTEGER NOT NULL DEFAULT 0         -- resolved VND amount actually subtracted
);
CREATE INDEX idx_order_discounts_order ON order_discounts(order_id);

CREATE TABLE payments (
  id         INTEGER PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method     TEXT NOT NULL CHECK (method IN ('CASH','QR')),
  amount     INTEGER NOT NULL,                      -- VND received for this payment
  tendered   INTEGER,                               -- CASH only: cash handed over (nullable)
  change_due INTEGER,                               -- CASH only: tendered - total (nullable, >=0)
  paid_at    TEXT NOT NULL,
  ref_note   TEXT
);
CREATE INDEX idx_payments_order ON payments(order_id);
```

- [ ] **Step 2: Đăng ký migration** — trong `src-tauri/src/db/migrations.rs`, append `0005_payments.sql` vào CUỐI vec (giữ nguyên 0001→0004):

```rust
pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("../../migrations/0001_init.sql")),
        M::up(include_str!("../../migrations/0002_menu.sql")),
        M::up(include_str!("../../migrations/0003_tables.sql")),
        M::up(include_str!("../../migrations/0004_orders.sql")),
        M::up(include_str!("../../migrations/0005_payments.sql")),
    ])
}
```

- [ ] **Step 3: Thêm schema test** — vào module `tests` của `migrations.rs` (cạnh các test hiện có):

```rust
#[test]
fn migration_creates_payment_tables() {
    let mut c = rusqlite::Connection::open_in_memory().unwrap();
    run(&mut c).unwrap();
    for t in ["discounts", "order_discounts", "payments"] {
        let n: i64 = c
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
                [t],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 1, "missing table {t}");
    }
    // Kiểm tra index tồn tại
    let idx: i64 = c
        .query_row(
            "SELECT count(*) FROM sqlite_master WHERE type='index' AND name='idx_payments_order'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(idx, 1, "missing index idx_payments_order");
}
```

- [ ] **Step 4: Chạy test** — Run: `cargo test --manifest-path src-tauri/Cargo.toml migration`
Expected: tất cả migration tests pass (bao gồm `migration_creates_payment_tables`).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/migrations/0005_payments.sql src-tauri/src/db/migrations.rs
git commit -m "feat(db): add payments/discounts/order_discounts migration (0005)"
```

---

## Task 2: Domain structs — payments

**Files:** Create `src-tauri/src/domain/payments.rs`; Modify `src-tauri/src/domain/mod.rs`, `src-tauri/src/domain/orders.rs`.

- [ ] **Step 1: Tạo `src-tauri/src/domain/payments.rs`** — copy CHÍNH XÁC từ contract §3:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DiscountType {
    Percent,
    Amount,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DiscountScope {
    Order,
    Item,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PaymentMethod {
    Cash,
    Qr,
}

#[derive(Debug, Clone, Serialize)]
pub struct Discount {
    pub id: i64,
    pub name: String,
    pub r#type: DiscountType,
    pub value: i64,
    pub scope: DiscountScope,
    pub is_active: bool,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DiscountInput {
    pub name: String,
    pub r#type: DiscountType,
    pub value: i64,
    pub scope: DiscountScope,
    pub valid_from: Option<String>,
    pub valid_to: Option<String>,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrderDiscount {
    pub id: i64,
    pub order_id: i64,
    pub discount_id: Option<i64>,
    pub name: String,
    pub r#type: DiscountType,
    pub value: i64,
    pub amount_applied: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ApplyDiscountInput {
    pub discount_id: Option<i64>,     // None = manual discount
    pub name: String,
    pub r#type: DiscountType,
    pub value: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Payment {
    pub id: i64,
    pub order_id: i64,
    pub method: PaymentMethod,
    pub amount: i64,
    pub tendered: Option<i64>,
    pub change_due: Option<i64>,
    pub paid_at: String,
    pub ref_note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PaymentInput {
    pub method: PaymentMethod,
    pub amount: i64,
    pub tendered: Option<i64>,
    pub ref_note: Option<String>,
}
```

- [ ] **Step 2: Khai báo module** — thêm `pub mod payments;` vào `src-tauri/src/domain/mod.rs`.

- [ ] **Step 3: Cập nhật `domain/orders.rs`** — thay hai struct placeholder bằng import thật. Xóa:
```rust
/// Placeholder M3 — bị thay thế bởi kiểu thật ở M4
#[derive(Debug, Clone, Serialize, Default)]
pub struct OrderDiscount {}

#[derive(Debug, Clone, Serialize, Default)]
pub struct Payment {}
```
Thêm ở đầu file (sau `use serde::{Deserialize, Serialize};`):
```rust
pub use crate::domain::payments::{OrderDiscount, Payment};
```
Giữ nguyên các field `pub discounts: Vec<OrderDiscount>` và `pub payments: Vec<Payment>` trong struct `Order` — không thay đổi.

- [ ] **Step 3b: Cập nhật frontend type `src/lib/api/orders.ts`** — thêm import và thay kiểu placeholder:

```ts
// Thêm vào đầu file (sau import invoke):
import type { OrderDiscount, Payment } from "@/lib/api/payments"

// Trong type Order, thay:
//   discounts: unknown[]   →   discounts: OrderDiscount[]
//   payments: unknown[]    →   payments: Payment[]
```

Ví dụ sau khi sửa:
```ts
export type Order = {
  // ... các field khác giữ nguyên ...
  discounts: OrderDiscount[]
  payments: Payment[]
}
```

- [ ] **Step 4: Build** — Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: biên dịch OK, không có lỗi kiểu.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/domain/payments.rs src-tauri/src/domain/mod.rs src-tauri/src/domain/orders.rs
git commit -m "feat(domain): add payment/discount domain structs, replace M3 placeholders"
```

---

## Task 3: Service — money math cho discounts + finalize (TDD)

**Files:** Create `src-tauri/src/services/payment.rs`; Modify `src-tauri/src/services/mod.rs`.

Đây là vùng **rủi ro cao nhất** (contract §5). Toàn bộ logic tính tiền theo contract §4 rules 4–9.

- [ ] **Step 1: Khai báo module** — thêm `pub mod payment;` vào `src-tauri/src/services/mod.rs`.

- [ ] **Step 2: Viết test THẤT BẠI trước** — tạo `src-tauri/src/services/payment.rs` chỉ với phần tests:

```rust
// services/payment.rs
use crate::domain::payments::{ApplyDiscountInput, DiscountType};

/// Input cho một discount row khi tính cumulative clamping.
pub struct DiscountResolution {
    pub discount_type: DiscountType,
    pub value: i64,
}

/// Tính amount_applied cho một discount row (contract §4 rule 4):
/// - PERCENT: amount = round_vnd(subtotal * value / 100)
/// - AMOUNT: amount = value
/// Clamp: amount_applied = min(amount, subtotal - already_applied)
/// Trả về (amount_applied, new_already_applied)
pub fn resolve_discount_amount(
    d: &DiscountResolution,
    subtotal: i64,
    already_applied: i64,
    rounding_unit: i64,
) -> i64 {
    use crate::services::order::round_vnd;
    let raw = match d.discount_type {
        DiscountType::Percent => round_vnd(subtotal * d.value / 100, rounding_unit),
        DiscountType::Amount => d.value,
    };
    let remaining = (subtotal - already_applied).max(0);
    raw.min(remaining)
}

/// Tính discount_total và tổng amount_applied cho danh sách discounts (contract §4 rule 4-5).
/// Trả về Vec<i64> amount_applied tương ứng từng discount + discount_total.
pub fn resolve_all_discounts(
    discounts: &[DiscountResolution],
    subtotal: i64,
    rounding_unit: i64,
) -> (Vec<i64>, i64) {
    let mut already = 0i64;
    let mut amounts = Vec::with_capacity(discounts.len());
    for d in discounts {
        let amt = resolve_discount_amount(d, subtotal, already, rounding_unit);
        already += amt;
        amounts.push(amt);
    }
    (amounts, already)
}

/// Tính change_due cho CASH payment (contract §4 rule 8):
/// change_due = max(0, tendered - total)
/// Trả Err nếu tendered < total (single full payment finalize guard).
pub fn compute_change_due(tendered: i64, total: i64) -> Result<i64, String> {
    if tendered < total {
        return Err(format!(
            "Tiền khách đưa ({tendered}) nhỏ hơn tổng đơn ({total})"
        ));
    }
    Ok((tendered - total).max(0))
}

/// Validate finalize_order: tổng payments >= total (contract §4 rule 9).
pub fn validate_finalize(payments_total: i64, order_total: i64) -> Result<(), String> {
    if payments_total < order_total {
        return Err(format!(
            "Tổng thanh toán ({payments_total}) chưa đủ tổng đơn ({order_total})"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::payments::DiscountType;

    fn percent(value: i64) -> DiscountResolution {
        DiscountResolution { discount_type: DiscountType::Percent, value }
    }
    fn amount(value: i64) -> DiscountResolution {
        DiscountResolution { discount_type: DiscountType::Amount, value }
    }

    // ---- resolve_discount_amount ----

    #[test]
    fn percent_discount_basic() {
        // subtotal=100000, 10% → amount=10000
        let d = percent(10);
        let amt = resolve_discount_amount(&d, 100_000, 0, 1);
        assert_eq!(amt, 10_000);
    }

    #[test]
    fn percent_discount_rounds_to_vnd() {
        // subtotal=100000, 15% → 15000 (no rounding needed at unit=1)
        let d = percent(15);
        let amt = resolve_discount_amount(&d, 100_000, 0, 1);
        assert_eq!(amt, 15_000);
    }

    #[test]
    fn percent_discount_rounding_unit_500() {
        // subtotal=100000, 15% → raw=15000, rounding_unit=500 → 15000 (exact multiple)
        let d = percent(15);
        let amt = resolve_discount_amount(&d, 100_000, 0, 500);
        assert_eq!(amt, 15_000);
        // subtotal=33000, 10% → raw=3300, rounding_unit=500 → floor → 3000
        let d2 = percent(10);
        let amt2 = resolve_discount_amount(&d2, 33_000, 0, 500);
        assert_eq!(amt2, 3_000);
    }

    #[test]
    fn amount_discount_basic() {
        let d = amount(20_000);
        let amt = resolve_discount_amount(&d, 100_000, 0, 1);
        assert_eq!(amt, 20_000);
    }

    #[test]
    fn discount_clamped_to_remaining_subtotal() {
        // subtotal=50000, already_applied=40000 → remaining=10000
        // AMOUNT 30000 → clamped to 10000
        let d = amount(30_000);
        let amt = resolve_discount_amount(&d, 50_000, 40_000, 1);
        assert_eq!(amt, 10_000);
    }

    #[test]
    fn discount_clamped_when_already_exceeds_subtotal() {
        // Bất thường: already_applied >= subtotal → remaining=0 → amt=0
        let d = percent(10);
        let amt = resolve_discount_amount(&d, 50_000, 50_000, 1);
        assert_eq!(amt, 0);
    }

    #[test]
    fn percent_100_clamps_to_subtotal() {
        // 100% discount → amount = subtotal (không thể vượt)
        let d = percent(100);
        let amt = resolve_discount_amount(&d, 75_000, 0, 1);
        assert_eq!(amt, 75_000);
    }

    // ---- resolve_all_discounts ----

    #[test]
    fn two_discounts_cumulative_clamping() {
        // subtotal=100000
        // disc1: PERCENT 10% → 10000, already=10000
        // disc2: AMOUNT 50000 → 50000 (remaining=90000) → 50000, already=60000
        let (amts, total) = resolve_all_discounts(
            &[percent(10), amount(50_000)],
            100_000,
            1,
        );
        assert_eq!(amts, vec![10_000, 50_000]);
        assert_eq!(total, 60_000);
    }

    #[test]
    fn discounts_cannot_exceed_subtotal() {
        // subtotal=30000; AMOUNT 20000 + AMOUNT 20000 → 20000 + 10000 = 30000 (clamped)
        let (amts, total) = resolve_all_discounts(
            &[amount(20_000), amount(20_000)],
            30_000,
            1,
        );
        assert_eq!(amts[0], 20_000);
        assert_eq!(amts[1], 10_000); // clamped
        assert_eq!(total, 30_000);
    }

    // ---- compute_change_due ----

    #[test]
    fn change_due_exact() {
        assert_eq!(compute_change_due(100_000, 100_000).unwrap(), 0);
    }

    #[test]
    fn change_due_overpaid() {
        assert_eq!(compute_change_due(150_000, 100_000).unwrap(), 50_000);
    }

    #[test]
    fn change_due_underpaid_returns_err() {
        assert!(compute_change_due(80_000, 100_000).is_err());
    }

    // ---- validate_finalize ----

    #[test]
    fn finalize_ok_when_payments_cover_total() {
        assert!(validate_finalize(100_000, 100_000).is_ok());
        assert!(validate_finalize(120_000, 100_000).is_ok()); // overpaid OK
    }

    #[test]
    fn finalize_err_when_underpaid() {
        assert!(validate_finalize(90_000, 100_000).is_err());
    }

    // ---- Integration: full order discount flow ----

    #[test]
    fn full_order_discount_and_total() {
        use crate::services::order::{compute_subtotal, compute_total};
        // Đơn: 2 items, line_totals = [60000, 38000] → subtotal=98000
        let subtotal = compute_subtotal(&[60_000, 38_000]);
        assert_eq!(subtotal, 98_000);

        // Discount: 10% → 9800, sau đó AMOUNT 5000 → 5000
        let (amts, discount_total) = resolve_all_discounts(
            &[percent(10), amount(5_000)],
            subtotal,
            1,
        );
        assert_eq!(amts[0], 9_800);
        assert_eq!(amts[1], 5_000);
        assert_eq!(discount_total, 14_800);

        // total = max(0, 98000 - 14800) = 83200
        let total = compute_total(subtotal, discount_total);
        assert_eq!(total, 83_200);

        // Cash payment: tendered=100000 → change=16800
        let change = compute_change_due(100_000, total).unwrap();
        assert_eq!(change, 16_800);
    }
}
```

- [ ] **Step 3: Chạy → FAIL** — Run: `cargo test --manifest-path src-tauri/Cargo.toml services::payment`
Expected: lỗi biên dịch "cannot find function `resolve_discount_amount`..." — đúng theo TDD.

- [ ] **Step 4: Viết impl** — các hàm `resolve_discount_amount`, `resolve_all_discounts`, `compute_change_due`, `validate_finalize` đã viết inline ở Step 2 (trên `#[cfg(test)]`) là impl hoàn chỉnh. Chỉ cần đảm bảo chúng nằm **trên** `#[cfg(test)]` block trong file.

- [ ] **Step 5: Chạy → PASS** — Run: `cargo test --manifest-path src-tauri/Cargo.toml services::payment`
Expected: tất cả 16 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/services/payment.rs src-tauri/src/services/mod.rs
git commit -m "feat(services): add payment money math with full unit tests (discounts, change_due, finalize guard)"
```

---

## Task 4: Repo — payments CRUD (TDD)

**Files:** Create `src-tauri/src/repo/payments.rs`; Modify `src-tauri/src/repo/mod.rs`, `src-tauri/src/repo/orders.rs`.

- [ ] **Step 1: Khai báo module** — thêm `pub mod payments;` vào `src-tauri/src/repo/mod.rs`.

- [ ] **Step 2: Viết test THẤT BẠI trước** — tạo `src-tauri/src/repo/payments.rs` chỉ với phần tests:

```rust
use crate::domain::orders::{CreateOrderInput, OrderType, OrderItemInput};
use crate::domain::payments::*;
use rusqlite::Connection;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;
    use crate::repo::orders;

    fn conn() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        c.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrations::run(&mut c).unwrap();
        // Seed minimal data
        c.execute("INSERT INTO areas(id, name, sort_order) VALUES (1,'Sảnh',0)", []).unwrap();
        c.execute("INSERT INTO tables(id, area_id, name, sort_order) VALUES (1,1,'Bàn 1',0)", []).unwrap();
        c
    }

    fn open_order_with_item(c: &Connection, unit_price: i64, qty: i64) -> crate::domain::orders::Order {
        let order = orders::create_order(
            c,
            CreateOrderInput { order_type: OrderType::Takeaway, table_id: None, note: None },
        ).unwrap();
        let item = OrderItemInput {
            product_id: None, product_name: "Cà phê".into(), size_name: None,
            unit_price, quantity: qty, sugar_level: None, ice_level: None,
            line_note: None, line_discount: 0, toppings: vec![],
        };
        orders::add_order_item(c, order.id, item).unwrap()
    }

    // ---- Discount CRUD ----

    #[test]
    fn create_list_discount() {
        let c = conn();
        let input = DiscountInput {
            name: "Khuyến mãi 10%".into(),
            r#type: DiscountType::Percent,
            value: 10,
            scope: DiscountScope::Order,
            valid_from: None,
            valid_to: None,
            sort_order: 0,
        };
        let d = create_discount(&c, input).unwrap();
        assert_eq!(d.name, "Khuyến mãi 10%");
        assert_eq!(d.value, 10);
        assert!(d.is_active);

        let list = list_discounts(&c, false).unwrap();
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn set_discount_active() {
        let c = conn();
        let d = create_discount(&c, DiscountInput {
            name: "D".into(), r#type: DiscountType::Amount, value: 5000,
            scope: DiscountScope::Order, valid_from: None, valid_to: None, sort_order: 0,
        }).unwrap();
        set_discount_active(&c, d.id, false).unwrap();
        let list = list_discounts(&c, false).unwrap(); // include_inactive=false
        assert_eq!(list.len(), 0);
        let all = list_discounts(&c, true).unwrap();
        assert_eq!(all.len(), 1);
        assert!(!all[0].is_active);
    }

    // ---- apply_discount ----

    #[test]
    fn apply_percent_discount_updates_order() {
        let c = conn();
        // Đơn có 1 item 100000 × 1 → subtotal=100000
        let order = open_order_with_item(&c, 100_000, 1);
        assert_eq!(order.subtotal, 100_000);
        assert_eq!(order.total, 100_000);

        let input = ApplyDiscountInput {
            discount_id: None,
            name: "Giảm 10%".into(),
            r#type: DiscountType::Percent,
            value: 10,
        };
        let updated = apply_discount(&c, order.id, input).unwrap();
        // discount_total = 10000; total = 90000
        assert_eq!(updated.discount_total, 10_000);
        assert_eq!(updated.total, 90_000);
        assert_eq!(updated.discounts.len(), 1);
        assert_eq!(updated.discounts[0].amount_applied, 10_000);
    }

    #[test]
    fn apply_amount_discount_updates_order() {
        let c = conn();
        let order = open_order_with_item(&c, 80_000, 1);
        let input = ApplyDiscountInput {
            discount_id: None, name: "Giảm 20k".into(),
            r#type: DiscountType::Amount, value: 20_000,
        };
        let updated = apply_discount(&c, order.id, input).unwrap();
        assert_eq!(updated.discount_total, 20_000);
        assert_eq!(updated.total, 60_000);
    }

    #[test]
    fn discount_clamped_cannot_make_negative_total() {
        let c = conn();
        let order = open_order_with_item(&c, 30_000, 1);
        // Áp dụng AMOUNT 50000 vào đơn 30000 → clamped → discount_total=30000, total=0
        let input = ApplyDiscountInput {
            discount_id: None, name: "Quá tay".into(),
            r#type: DiscountType::Amount, value: 50_000,
        };
        let updated = apply_discount(&c, order.id, input).unwrap();
        assert_eq!(updated.discount_total, 30_000);
        assert_eq!(updated.total, 0);
    }

    #[test]
    fn remove_order_discount_recomputes() {
        let c = conn();
        let order = open_order_with_item(&c, 100_000, 1);
        let input = ApplyDiscountInput {
            discount_id: None, name: "Giảm 20%".into(),
            r#type: DiscountType::Percent, value: 20,
        };
        let with_discount = apply_discount(&c, order.id, input).unwrap();
        let od_id = with_discount.discounts[0].id;
        let reverted = remove_order_discount(&c, od_id).unwrap();
        assert_eq!(reverted.discount_total, 0);
        assert_eq!(reverted.total, 100_000);
        assert_eq!(reverted.discounts.len(), 0);
    }

    // ---- add_payment ----

    #[test]
    fn add_cash_payment_computes_change() {
        let c = conn();
        // order total = 100_000 (unit_price=100_000, qty=1)
        let order = open_order_with_item(&c, 100_000, 1);
        let input = PaymentInput {
            method: PaymentMethod::Cash,
            amount: 100_000,
            tendered: Some(120_000),  // tendered 120000, order total 100000 → change = 20000
            ref_note: None,
        };
        let updated = add_payment(&c, order.id, input).unwrap();
        assert_eq!(updated.payments.len(), 1);
        let p = &updated.payments[0];
        assert_eq!(p.change_due, Some(20_000));   // max(0, 120000 − 100000)
        assert_eq!(p.tendered, Some(120_000));
    }

    #[test]
    fn add_qr_payment_no_change() {
        let c = conn();
        let order = open_order_with_item(&c, 70_000, 1);
        let input = PaymentInput {
            method: PaymentMethod::Qr,
            amount: 70_000,
            tendered: None,
            ref_note: Some("QR_REF_001".into()),
        };
        let updated = add_payment(&c, order.id, input).unwrap();
        let p = &updated.payments[0];
        assert_eq!(p.method, PaymentMethod::Qr);
        assert!(p.change_due.is_none());
        assert!(p.tendered.is_none());
    }

    // ---- finalize_order ----

    #[test]
    fn finalize_order_transitions_to_paid() {
        let c = conn();
        let order = open_order_with_item(&c, 50_000, 1);
        add_payment(&c, order.id, PaymentInput {
            method: PaymentMethod::Cash, amount: 50_000,
            tendered: Some(50_000), ref_note: None,
        }).unwrap();
        let paid = finalize_order(&c, order.id).unwrap();
        assert_eq!(paid.status.to_string_literal(), "PAID");
        assert!(paid.paid_at.is_some());
    }

    #[test]
    fn finalize_fails_if_underpaid() {
        let c = conn();
        let order = open_order_with_item(&c, 100_000, 1);
        add_payment(&c, order.id, PaymentInput {
            method: PaymentMethod::Cash, amount: 80_000,
            tendered: Some(80_000), ref_note: None,
        }).unwrap();
        assert!(finalize_order(&c, order.id).is_err());
    }

    #[test]
    fn finalize_dine_in_releases_table() {
        let c = conn();
        // Tạo đơn DINE_IN bàn 1
        let order = orders::create_order(&c, CreateOrderInput {
            order_type: OrderType::DineIn, table_id: Some(1), note: None,
        }).unwrap();
        let item = OrderItemInput {
            product_id: None, product_name: "Trà".into(), size_name: None,
            unit_price: 25_000, quantity: 1, sugar_level: None, ice_level: None,
            line_note: None, line_discount: 0, toppings: vec![],
        };
        orders::add_order_item(&c, order.id, item).unwrap();
        add_payment(&c, order.id, PaymentInput {
            method: PaymentMethod::Qr, amount: 25_000,
            tendered: None, ref_note: None,
        }).unwrap();
        finalize_order(&c, order.id).unwrap();
        // Bàn 1 phải trống → tạo được đơn mới
        assert!(orders::create_order(&c, CreateOrderInput {
            order_type: OrderType::DineIn, table_id: Some(1), note: None,
        }).is_ok());
    }
}
```

- [ ] **Step 3: Chạy → FAIL** — Run: `cargo test --manifest-path src-tauri/Cargo.toml repo::payments`
Expected: lỗi biên dịch "cannot find function `create_discount`..." — đúng theo TDD.

- [ ] **Step 4: Viết impl** — thêm vào ĐẦU `repo/payments.rs` (trên `#[cfg(test)]`):

```rust
use crate::domain::orders::{Order, OrderStatus};
use crate::domain::payments::*;
use crate::services::payment as svc_pay;
use crate::services::order as svc_ord;
use rusqlite::{params, Connection};

// --------------- Row mappers ---------------

fn row_to_discount(row: &rusqlite::Row) -> rusqlite::Result<Discount> {
    let type_str: String = row.get("type")?;
    let scope_str: String = row.get("scope")?;
    Ok(Discount {
        id: row.get("id")?,
        name: row.get("name")?,
        r#type: match type_str.as_str() {
            "PERCENT" => DiscountType::Percent,
            _ => DiscountType::Amount,
        },
        value: row.get("value")?,
        scope: match scope_str.as_str() {
            "ORDER" => DiscountScope::Order,
            _ => DiscountScope::Item,
        },
        is_active: row.get::<_, i64>("is_active")? != 0,
        valid_from: row.get("valid_from")?,
        valid_to: row.get("valid_to")?,
        sort_order: row.get("sort_order")?,
    })
}

fn row_to_order_discount(row: &rusqlite::Row) -> rusqlite::Result<OrderDiscount> {
    let type_str: String = row.get("type")?;
    Ok(OrderDiscount {
        id: row.get("id")?,
        order_id: row.get("order_id")?,
        discount_id: row.get("discount_id")?,
        name: row.get("name")?,
        r#type: match type_str.as_str() {
            "PERCENT" => DiscountType::Percent,
            _ => DiscountType::Amount,
        },
        value: row.get("value")?,
        amount_applied: row.get("amount_applied")?,
    })
}

fn row_to_payment(row: &rusqlite::Row) -> rusqlite::Result<Payment> {
    let method_str: String = row.get("method")?;
    Ok(Payment {
        id: row.get("id")?,
        order_id: row.get("order_id")?,
        method: match method_str.as_str() {
            "QR" => PaymentMethod::Qr,
            _ => PaymentMethod::Cash,
        },
        amount: row.get("amount")?,
        tendered: row.get("tendered")?,
        change_due: row.get("change_due")?,
        paid_at: row.get("paid_at")?,
        ref_note: row.get("ref_note")?,
    })
}

// --------------- Public helpers (used by repo/orders load_order) ---------------

pub fn load_order_discounts(conn: &Connection, order_id: i64) -> rusqlite::Result<Vec<OrderDiscount>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM order_discounts WHERE order_id=?1 ORDER BY id",
    )?;
    stmt.query_map([order_id], row_to_order_discount)?.collect()
}

pub fn load_payments(conn: &Connection, order_id: i64) -> rusqlite::Result<Vec<Payment>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM payments WHERE order_id=?1 ORDER BY id",
    )?;
    stmt.query_map([order_id], row_to_payment)?.collect()
}

// --------------- Discount CRUD ---------------

pub fn create_discount(conn: &Connection, input: DiscountInput) -> rusqlite::Result<Discount> {
    let name = input.name.trim();
    if name.is_empty() || input.value < 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Tên/giá trị chiết khấu không hợp lệ".into(),
        ));
    }
    if matches!(input.r#type, DiscountType::Percent) && input.value > 100 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Chiết khấu phần trăm không được vượt 100".into(),
        ));
    }
    let type_str = match input.r#type { DiscountType::Percent => "PERCENT", DiscountType::Amount => "AMOUNT" };
    let scope_str = match input.scope { DiscountScope::Order => "ORDER", DiscountScope::Item => "ITEM" };
    conn.execute(
        "INSERT INTO discounts(name, type, value, scope, valid_from, valid_to, sort_order)
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![name, type_str, input.value, scope_str, input.valid_from, input.valid_to, input.sort_order],
    )?;
    let id = conn.last_insert_rowid();
    conn.query_row("SELECT * FROM discounts WHERE id=?1", [id], row_to_discount)
}

pub fn list_discounts(conn: &Connection, include_inactive: bool) -> rusqlite::Result<Vec<Discount>> {
    let sql = if include_inactive {
        "SELECT * FROM discounts ORDER BY sort_order, id"
    } else {
        "SELECT * FROM discounts WHERE is_active=1 ORDER BY sort_order, id"
    };
    let mut stmt = conn.prepare(sql)?;
    stmt.query_map([], row_to_discount)?.collect()
}

pub fn update_discount(conn: &Connection, id: i64, input: DiscountInput) -> rusqlite::Result<Discount> {
    let name = input.name.trim();
    if name.is_empty() || input.value < 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Tên/giá trị chiết khấu không hợp lệ".into(),
        ));
    }
    if matches!(input.r#type, DiscountType::Percent) && input.value > 100 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Chiết khấu phần trăm không được vượt 100".into(),
        ));
    }
    let type_str = match input.r#type { DiscountType::Percent => "PERCENT", DiscountType::Amount => "AMOUNT" };
    let scope_str = match input.scope { DiscountScope::Order => "ORDER", DiscountScope::Item => "ITEM" };
    conn.execute(
        "UPDATE discounts SET name=?2, type=?3, value=?4, scope=?5,
         valid_from=?6, valid_to=?7, sort_order=?8 WHERE id=?1",
        params![id, name, type_str, input.value, scope_str, input.valid_from, input.valid_to, input.sort_order],
    )?;
    conn.query_row("SELECT * FROM discounts WHERE id=?1", [id], row_to_discount)
}

pub fn set_discount_active(conn: &Connection, id: i64, is_active: bool) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE discounts SET is_active=?2 WHERE id=?1",
        params![id, is_active as i64],
    )?;
    Ok(())
}

// --------------- Discount application ---------------

/// Tái tính discount_total và total từ tất cả order_discounts hiện tại của đơn.
/// Ghi lại amount_applied cho từng row (theo thứ tự id asc) + cập nhật orders.discount_total/total.
fn recompute_discounts_and_total(conn: &Connection, order_id: i64) -> rusqlite::Result<()> {
    // Lấy subtotal hiện tại của đơn
    let subtotal: i64 = conn.query_row(
        "SELECT subtotal FROM orders WHERE id=?1", [order_id], |r| r.get(0),
    )?;
    // Lấy rounding_unit từ settings (default 1)
    let rounding_unit: i64 = conn
        .query_row(
            "SELECT value FROM settings WHERE key='rounding_unit'",
            [],
            |r| r.get::<_, String>(0),
        )
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1);
    // Lấy tất cả order_discounts theo thứ tự id
    let od_rows: Vec<(i64, String, i64)> = {
        let mut stmt = conn.prepare(
            "SELECT id, type, value FROM order_discounts WHERE order_id=?1 ORDER BY id",
        )?;
        stmt.query_map([order_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
            .collect::<rusqlite::Result<_>>()?
    };
    // Tính cumulative amounts
    let mut already = 0i64;
    for (od_id, type_str, value) in &od_rows {
        let d = svc_pay::DiscountResolution {
            discount_type: if type_str == "PERCENT" { DiscountType::Percent } else { DiscountType::Amount },
            value: *value,
        };
        let amt = svc_pay::resolve_discount_amount(&d, subtotal, already, rounding_unit);
        already += amt;
        conn.execute(
            "UPDATE order_discounts SET amount_applied=?2 WHERE id=?1",
            params![od_id, amt],
        )?;
    }
    let discount_total = already;
    let total = svc_ord::compute_total(subtotal, discount_total);
    conn.execute(
        "UPDATE orders SET discount_total=?2, total=?3 WHERE id=?1",
        params![order_id, discount_total, total],
    )?;
    Ok(())
}

pub fn apply_discount(conn: &Connection, order_id: i64, input: ApplyDiscountInput) -> rusqlite::Result<Order> {
    // Validate đơn OPEN
    let status: String = conn.query_row(
        "SELECT status FROM orders WHERE id=?1", [order_id], |r| r.get(0),
    )?;
    if status != "OPEN" {
        return Err(rusqlite::Error::InvalidParameterName(
            "Chỉ áp dụng chiết khấu cho đơn OPEN".into(),
        ));
    }
    if input.value < 0 {
        return Err(rusqlite::Error::InvalidParameterName("Giá trị chiết khấu không âm".into()));
    }
    if matches!(input.r#type, DiscountType::Percent) && input.value > 100 {
        return Err(rusqlite::Error::InvalidParameterName("Phần trăm không vượt 100".into()));
    }
    let type_str = match input.r#type { DiscountType::Percent => "PERCENT", DiscountType::Amount => "AMOUNT" };

    conn.execute_batch("BEGIN")?;
    let result = (|| {
        conn.execute(
            "INSERT INTO order_discounts(order_id, discount_id, name, type, value, amount_applied)
             VALUES (?1,?2,?3,?4,?5,0)",
            params![order_id, input.discount_id, input.name.trim(), type_str, input.value],
        )?;
        recompute_discounts_and_total(conn, order_id)?;
        Ok::<(), rusqlite::Error>(())
    })();
    match result {
        Ok(()) => { conn.execute_batch("COMMIT")?; crate::repo::orders::load_order(conn, order_id) }
        Err(e) => { let _ = conn.execute_batch("ROLLBACK"); Err(e) }
    }
}

pub fn remove_order_discount(conn: &Connection, order_discount_id: i64) -> rusqlite::Result<Order> {
    let order_id: i64 = conn.query_row(
        "SELECT order_id FROM order_discounts WHERE id=?1",
        [order_discount_id],
        |r| r.get(0),
    )?;
    conn.execute_batch("BEGIN")?;
    let result = (|| {
        conn.execute("DELETE FROM order_discounts WHERE id=?1", [order_discount_id])?;
        recompute_discounts_and_total(conn, order_id)?;
        Ok::<(), rusqlite::Error>(())
    })();
    match result {
        Ok(()) => { conn.execute_batch("COMMIT")?; crate::repo::orders::load_order(conn, order_id) }
        Err(e) => { let _ = conn.execute_batch("ROLLBACK"); Err(e) }
    }
}

// --------------- Payments ---------------

pub fn add_payment(conn: &Connection, order_id: i64, input: PaymentInput) -> rusqlite::Result<Order> {
    // Validate đơn OPEN
    let status: String = conn.query_row(
        "SELECT status FROM orders WHERE id=?1", [order_id], |r| r.get(0),
    )?;
    if status != "OPEN" {
        return Err(rusqlite::Error::InvalidParameterName(
            "Chỉ thêm thanh toán cho đơn OPEN".into(),
        ));
    }
    if input.amount <= 0 {
        return Err(rusqlite::Error::InvalidParameterName("Số tiền thanh toán phải > 0".into()));
    }
    // Tính change_due cho CASH: change = max(0, tendered - order_total) (contract §4 rule 8)
    let (change_due, tendered) = if matches!(input.method, PaymentMethod::Cash) {
        let order_total: i64 = conn.query_row("SELECT total FROM orders WHERE id=?1", [order_id], |r| r.get(0))?;
        let change_due = input.tendered.map(|t| (t - order_total).max(0));
        (change_due, input.tendered)
    } else {
        (None, None)
    };
    let method_str = match input.method { PaymentMethod::Cash => "CASH", PaymentMethod::Qr => "QR" };
    let paid_at = crate::services::order::now_utc();

    conn.execute(
        "INSERT INTO payments(order_id, method, amount, tendered, change_due, paid_at, ref_note)
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![order_id, method_str, input.amount, tendered, change_due, paid_at, input.ref_note],
    )?;
    crate::repo::orders::load_order(conn, order_id)
}

/// Hoàn tất đơn: xác nhận sum(payments.amount) >= orders.total; cập nhật status=PAID, paid_at.
/// Bàn tự động "nhả" vì không còn OPEN order (status suy ra từ orders).
pub fn finalize_order(conn: &Connection, order_id: i64) -> rusqlite::Result<Order> {
    // Load header
    let (status, total): (String, i64) = conn.query_row(
        "SELECT status, total FROM orders WHERE id=?1",
        [order_id],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )?;
    if status != "OPEN" {
        return Err(rusqlite::Error::InvalidParameterName(
            "Chỉ finalize đơn OPEN".into(),
        ));
    }
    // Sum payments
    let payments_sum: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE order_id=?1",
        [order_id],
        |r| r.get(0),
    )?;
    svc_pay::validate_finalize(payments_sum, total)
        .map_err(|e| rusqlite::Error::InvalidParameterName(e))?;

    let paid_at = crate::services::order::now_utc();
    conn.execute(
        "UPDATE orders SET status='PAID', paid_at=?2 WHERE id=?1",
        params![order_id, paid_at],
    )?;
    crate::repo::orders::load_order(conn, order_id)
}
```

> **Lưu ý `to_string_literal`:** Test dùng `paid.status.to_string_literal()` — thêm impl vào `domain/orders.rs`:
> ```rust
> impl OrderStatus {
>     pub fn to_string_literal(&self) -> &'static str {
>         match self {
>             OrderStatus::Open => "OPEN",
>             OrderStatus::Paid => "PAID",
>             OrderStatus::Cancelled => "CANCELLED",
>         }
>     }
> }
> ```
> Hoặc đổi test dùng `assert_eq!(paid.status, OrderStatus::Paid)` (không cần `to_string_literal`).

- [ ] **Step 5: Cập nhật `repo/orders.rs` — populate discounts + payments trong `load_order`** — sửa hàm `load_order`:

```rust
pub fn load_order(conn: &Connection, id: i64) -> rusqlite::Result<Order> {
    let mut order = conn.query_row(
        "SELECT * FROM orders WHERE id=?1",
        [id],
        row_to_order_header,
    )?;
    order.items = load_order_items(conn, id)?;
    // M4: populate discounts and payments (requires payments tables to exist)
    order.discounts = crate::repo::payments::load_order_discounts(conn, id)
        .unwrap_or_default();
    order.payments = crate::repo::payments::load_payments(conn, id)
        .unwrap_or_default();
    Ok(order)
}
```

> Dùng `.unwrap_or_default()` để `load_order` vẫn hoạt động đúng trong tests M3 chạy với DB không có migration 0005. Khi M4 fully integrated, sẽ luôn có bảng.

- [ ] **Step 6: Chạy → PASS** — Run: `cargo test --manifest-path src-tauri/Cargo.toml repo::payments`
Expected: tất cả tests pass.

- [ ] **Step 7: Chạy toàn bộ repo tests** — Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: tất cả tests (kể cả M1/M2/M3) vẫn pass.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/repo/payments.rs src-tauri/src/repo/mod.rs src-tauri/src/repo/orders.rs src-tauri/src/domain/orders.rs
git commit -m "feat(repo): add payments/discounts CRUD and finalize_order with TDD"
```

---

## Task 5: Printing stub — bill HTML

**Files:** Create `src-tauri/src/printing/mod.rs`, `src-tauri/src/printing/bill.rs`; Modify `src-tauri/src/lib.rs`.

Chiến lược bill: `generate_bill_html` render HTML string trong Rust (lấy dữ liệu từ `load_order`) → command trả String → FE nhét vào `<iframe srcdoc>` / ẩn div → `window.print()`. Không cần thư viện PDF. Stub `generate_bill_pdf` cho ESC/POS thermal printer ở M7: chỉ trả `Ok(String)` với path placeholder.

- [ ] **Step 1: Tạo `src-tauri/src/printing/mod.rs`**

```rust
pub mod bill;
```

- [ ] **Step 2: Tạo `src-tauri/src/printing/bill.rs`**

```rust
use crate::repo::orders::load_order;
use rusqlite::Connection;

/// Render bill dưới dạng HTML string.
/// FE nhúng vào `<div dangerouslySetInnerHTML>` / `<iframe srcdoc>` + CSS `@media print` → `window.print()`.
/// M7 có thể mở rộng thêm khung ESC/POS thermal bằng cách thêm hàm `generate_esc_pos_bytes`.
pub fn generate_bill_html(conn: &Connection, order_id: i64) -> rusqlite::Result<String> {
    let order = load_order(conn, order_id)?;

    // Thông tin cửa hàng từ settings (fallback về chuỗi mặc định)
    let shop_name = get_setting(conn, "shop_name").unwrap_or_else(|| "HiGi Coffee".into());
    let shop_address = get_setting(conn, "shop_address").unwrap_or_default();
    let shop_phone = get_setting(conn, "shop_phone").unwrap_or_default();
    let bill_footer = get_setting(conn, "bill_footer").unwrap_or_else(|| "Cảm ơn quý khách!".into());

    let mut rows = String::new();
    for item in &order.items {
        let size = item.size_name.as_deref().unwrap_or("");
        let size_label = if size.is_empty() { String::new() } else { format!(" ({size})") };
        rows.push_str(&format!(
            "<tr><td>{}{}</td><td class=\"qty\">{}</td><td class=\"price\">{}</td></tr>\n",
            html_escape(&item.product_name),
            size_label,
            item.quantity,
            format_vnd(item.line_total),
        ));
        // Toppings sub-rows
        for t in &item.toppings {
            rows.push_str(&format!(
                "<tr class=\"topping\"><td>  + {} ×{}</td><td></td><td class=\"price\">{}</td></tr>\n",
                html_escape(&t.topping_name),
                t.quantity,
                format_vnd(t.price * t.quantity),
            ));
        }
    }

    // Discount rows
    let mut discount_rows = String::new();
    for d in &order.discounts {
        discount_rows.push_str(&format!(
            "<tr class=\"discount\"><td colspan=\"2\">Giảm: {}</td><td class=\"price\">-{}</td></tr>\n",
            html_escape(&d.name),
            format_vnd(d.amount_applied),
        ));
    }

    // Payment rows
    let mut payment_rows = String::new();
    for p in &order.payments {
        let method_label = match p.method {
            crate::domain::payments::PaymentMethod::Cash => "Tiền mặt",
            crate::domain::payments::PaymentMethod::Qr => "QR/Chuyển khoản",
        };
        payment_rows.push_str(&format!(
            "<tr><td colspan=\"2\">{}</td><td class=\"price\">{}</td></tr>\n",
            method_label,
            format_vnd(p.amount),
        ));
        if let (Some(tendered), Some(change)) = (p.tendered, p.change_due) {
            payment_rows.push_str(&format!(
                "<tr class=\"change\"><td colspan=\"2\">Tiền khách đưa</td><td class=\"price\">{}</td></tr>\n",
                format_vnd(tendered),
            ));
            payment_rows.push_str(&format!(
                "<tr class=\"change\"><td colspan=\"2\">Tiền thừa</td><td class=\"price\">{}</td></tr>\n",
                format_vnd(change),
            ));
        }
    }

    let order_type_label = match order.order_type {
        crate::domain::orders::OrderType::DineIn => "Tại bàn",
        crate::domain::orders::OrderType::Takeaway => "Mang đi",
    };

    let html = format!(
        r#"<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Bill #{code}</title>
<style>
  body {{ font-family: monospace; font-size: 12px; width: 72mm; margin: 0 auto; padding: 8px; }}
  h1 {{ text-align: center; font-size: 14px; margin: 0 0 4px; }}
  .info {{ text-align: center; font-size: 11px; margin-bottom: 8px; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th, td {{ padding: 2px 0; vertical-align: top; }}
  .qty {{ text-align: center; width: 24px; }}
  .price {{ text-align: right; width: 72px; }}
  .topping {{ color: #555; }}
  .discount {{ color: #c00; }}
  .change {{ color: #090; }}
  .sep {{ border-top: 1px dashed #000; margin: 4px 0; }}
  .total {{ font-weight: bold; font-size: 14px; }}
  .footer {{ text-align: center; margin-top: 8px; font-size: 11px; }}
  @media print {{
    body {{ width: 100%; }}
    @page {{ margin: 0; size: 80mm auto; }}
  }}
</style>
</head>
<body>
<h1>{shop_name}</h1>
<div class="info">{shop_address}<br>{shop_phone}</div>
<div class="sep"></div>
<div>Đơn: <b>{code}</b> — {order_type_label}</div>
<div>Ngày: {created_at}</div>
<div class="sep"></div>
<table>
<tr><th>Món</th><th class="qty">SL</th><th class="price">Thành tiền</th></tr>
{rows}
</table>
<div class="sep"></div>
<table>
<tr><td colspan="2">Tạm tính</td><td class="price">{subtotal}</td></tr>
{discount_rows}
<tr class="total"><td colspan="2">Tổng cộng</td><td class="price">{total}</td></tr>
</table>
<div class="sep"></div>
<table>
{payment_rows}
</table>
<div class="sep"></div>
<div class="footer">{bill_footer}</div>
</body>
</html>"#,
        code = html_escape(&order.code),
        shop_name = html_escape(&shop_name),
        shop_address = html_escape(&shop_address),
        shop_phone = html_escape(&shop_phone),
        order_type_label = order_type_label,
        created_at = &order.created_at,
        rows = rows,
        subtotal = format_vnd(order.subtotal),
        discount_rows = discount_rows,
        total = format_vnd(order.total),
        payment_rows = payment_rows,
        bill_footer = html_escape(&bill_footer),
    );
    Ok(html)
}

/// Stub cho ESC/POS thermal printer — M7 sẽ implement.
/// Hiện tại trả HTML path placeholder để interface ổn định.
/// M7: thay bằng thư viện ESC/POS bytes + ghi file .bin hoặc gửi thẳng qua serial/USB.
pub fn generate_bill_pdf(_conn: &Connection, _order_id: i64) -> rusqlite::Result<String> {
    Ok("THERMAL_PRINTER_STUB_M7".to_string())
}

// --------------- Helpers ---------------

fn get_setting(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM settings WHERE key=?1",
        [key],
        |r| r.get(0),
    )
    .ok()
}

fn format_vnd(amount: i64) -> String {
    // Định dạng thủ công, không cần dep js/intl: phân cách nghìn bằng "."
    let s = amount.to_string();
    let mut result = String::new();
    for (i, c) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.push('.');
        }
        result.push(c);
    }
    let formatted: String = result.chars().rev().collect();
    format!("{formatted} ₫")
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
```

- [ ] **Step 3: Khai báo module** — thêm `mod printing;` vào `src-tauri/src/lib.rs` (cạnh `mod domain; mod repo; mod services; mod commands; mod db;`).

- [ ] **Step 4: Build** — Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: OK, không lỗi.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/printing/ src-tauri/src/lib.rs
git commit -m "feat(printing): add bill HTML generator and ESC/POS stub for M7"
```

---

## Task 6: Tauri commands — payments

**Files:** Create `src-tauri/src/commands/payments.rs`; Modify `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`.

- [ ] **Step 1: Tạo `src-tauri/src/commands/payments.rs`** — theo mẫu `commands/menu.rs`:

```rust
use tauri::State;

use crate::db::AppDb;
use crate::domain::orders::Order;
use crate::domain::payments::{
    ApplyDiscountInput, Discount, DiscountInput, Payment, PaymentInput,
};
use crate::repo::payments;
use crate::printing::bill;

fn lock<'a>(
    db: &'a State<'_, AppDb>,
) -> Result<std::sync::MutexGuard<'a, rusqlite::Connection>, String> {
    db.0.lock().map_err(|e| e.to_string())
}

// --------------- Discount CRUD ---------------

#[tauri::command]
pub fn list_discounts(db: State<AppDb>, include_inactive: bool) -> Result<Vec<Discount>, String> {
    let conn = lock(&db)?;
    payments::list_discounts(&conn, include_inactive).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_discount(db: State<AppDb>, payload: DiscountInput) -> Result<Discount, String> {
    let conn = lock(&db)?;
    payments::create_discount(&conn, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_discount(db: State<AppDb>, id: i64, payload: DiscountInput) -> Result<Discount, String> {
    let conn = lock(&db)?;
    payments::update_discount(&conn, id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_discount_active(db: State<AppDb>, id: i64, is_active: bool) -> Result<(), String> {
    let conn = lock(&db)?;
    payments::set_discount_active(&conn, id, is_active).map_err(|e| e.to_string())
}

// --------------- Discount application ---------------

#[tauri::command]
pub fn apply_discount(
    db: State<AppDb>,
    order_id: i64,
    payload: ApplyDiscountInput,
) -> Result<Order, String> {
    let conn = lock(&db)?;
    payments::apply_discount(&conn, order_id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_order_discount(db: State<AppDb>, order_discount_id: i64) -> Result<Order, String> {
    let conn = lock(&db)?;
    payments::remove_order_discount(&conn, order_discount_id).map_err(|e| e.to_string())
}

// --------------- Payments ---------------

#[tauri::command]
pub fn add_payment(
    db: State<AppDb>,
    order_id: i64,
    payload: PaymentInput,
) -> Result<Order, String> {
    let conn = lock(&db)?;
    payments::add_payment(&conn, order_id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn finalize_order(db: State<AppDb>, order_id: i64) -> Result<Order, String> {
    let conn = lock(&db)?;
    payments::finalize_order(&conn, order_id).map_err(|e| e.to_string())
}

// --------------- Bill ---------------

#[tauri::command]
pub fn generate_bill_html(db: State<AppDb>, order_id: i64) -> Result<String, String> {
    let conn = lock(&db)?;
    bill::generate_bill_html(&conn, order_id).map_err(|e| e.to_string())
}

/// Stub — M7 sẽ implement ESC/POS.
#[tauri::command]
pub fn generate_bill_pdf(db: State<AppDb>, order_id: i64) -> Result<String, String> {
    let conn = lock(&db)?;
    bill::generate_bill_pdf(&conn, order_id).map_err(|e| e.to_string())
}
```

- [ ] **Step 2: Khai báo** — thêm `pub mod payments;` vào `src-tauri/src/commands/mod.rs`.

- [ ] **Step 3: Đăng ký vào `invoke_handler`** — trong `src-tauri/src/lib.rs`, thêm vào `generate_handler![...]`:

```rust
commands::payments::list_discounts,
commands::payments::create_discount,
commands::payments::update_discount,
commands::payments::set_discount_active,
commands::payments::apply_discount,
commands::payments::remove_order_discount,
commands::payments::add_payment,
commands::payments::finalize_order,
commands::payments::generate_bill_html,
commands::payments::generate_bill_pdf,
```

- [ ] **Step 4: Build + clippy** — Run: `cargo build --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
Expected: OK, clippy sạch.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/payments.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(commands): expose payment/discount/finalize/bill commands"
```

---

## Task 7: Frontend API wrapper + types

**Files:** Create `src/lib/api/payments.ts`.

- [ ] **Step 1: Tạo `src/lib/api/payments.ts`**

```ts
import { invoke } from "@tauri-apps/api/core"
import type { Order } from "@/lib/api/orders"

// ---- Types (mirror domain/payments.rs, field names snake_case) ----

export type DiscountType = "PERCENT" | "AMOUNT"
export type DiscountScope = "ORDER" | "ITEM"
export type PaymentMethod = "CASH" | "QR"

export type Discount = {
  id: number
  name: string
  type: DiscountType
  value: number
  scope: DiscountScope
  is_active: boolean
  valid_from: string | null
  valid_to: string | null
  sort_order: number
}

export type DiscountInput = {
  name: string
  type: DiscountType
  value: number
  scope: DiscountScope
  valid_from: string | null
  valid_to: string | null
  sort_order: number
}

export type OrderDiscount = {
  id: number
  order_id: number
  discount_id: number | null
  name: string
  type: DiscountType
  value: number
  amount_applied: number
}

export type ApplyDiscountInput = {
  discount_id: number | null
  name: string
  type: DiscountType
  value: number
}

export type Payment = {
  id: number
  order_id: number
  method: PaymentMethod
  amount: number
  tendered: number | null
  change_due: number | null
  paid_at: string
  ref_note: string | null
}

export type PaymentInput = {
  method: PaymentMethod
  amount: number
  tendered: number | null
  ref_note: string | null
}

// ---- API wrappers ----

export const listDiscounts = (includeInactive = false) =>
  invoke<Discount[]>("list_discounts", { includeInactive })

export const createDiscount = (payload: DiscountInput) =>
  invoke<Discount>("create_discount", { payload })

export const updateDiscount = (id: number, payload: DiscountInput) =>
  invoke<Discount>("update_discount", { id, payload })

export const setDiscountActive = (id: number, isActive: boolean) =>
  invoke<void>("set_discount_active", { id, isActive })

export const applyDiscount = (orderId: number, payload: ApplyDiscountInput) =>
  invoke<Order>("apply_discount", { orderId, payload })

export const removeOrderDiscount = (orderDiscountId: number) =>
  invoke<Order>("remove_order_discount", { orderDiscountId })

export const addPayment = (orderId: number, payload: PaymentInput) =>
  invoke<Order>("add_payment", { orderId, payload })

export const finalizeOrder = (orderId: number) =>
  invoke<Order>("finalize_order", { orderId })

export const generateBillHtml = (orderId: number) =>
  invoke<string>("generate_bill_html", { orderId })

export const generateBillPdf = (orderId: number) =>
  invoke<string>("generate_bill_pdf", { orderId })
```

- [ ] **Step 2: Cập nhật `src/lib/api/orders.ts`** — thêm các kiểu `OrderDiscount` và `Payment` vào type `Order` (thay thế `discounts: unknown[]`, `payments: unknown[]` hoặc thêm mới nếu chưa có):

```ts
// Thêm import ở đầu file
import type { OrderDiscount, Payment } from "@/lib/api/payments"

// Trong type Order, cập nhật:
// discounts: OrderDiscount[]
// payments: Payment[]
```

- [ ] **Step 3: Build typecheck** — Run: `npm run build`
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/payments.ts src/lib/api/orders.ts
git commit -m "feat(api): add payments/discounts API wrapper and update Order type"
```

---

## Task 8: Màn hình Payment — DiscountPanel + CashInput

**Files:** Create `src/routes/payment/DiscountPanel.tsx`, `src/routes/payment/CashInput.tsx`.

- [ ] **Step 1: Tạo `src/routes/payment/DiscountPanel.tsx`** — panel chiết khấu: tabs "Preset" (danh sách từ `listDiscounts`) và "Thủ công" (nhập tên + loại + giá trị); nút "Áp dụng"; danh sách applied discounts của đơn với nút xóa.

```tsx
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatVnd } from "@/lib/format"
import {
  listDiscounts, applyDiscount, removeOrderDiscount,
  type Discount, type ApplyDiscountInput, type OrderDiscount,
} from "@/lib/api/payments"

type Props = {
  orderId: number
  appliedDiscounts: OrderDiscount[]
  subtotal: number
  onUpdate: () => void  // callback to refresh order
}

export default function DiscountPanel({ orderId, appliedDiscounts, subtotal, onUpdate }: Props) {
  const [presets, setPresets] = useState<Discount[]>([])
  const [manualName, setManualName] = useState("")
  const [manualType, setManualType] = useState<"PERCENT" | "AMOUNT">("PERCENT")
  const [manualValue, setManualValue] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"preset" | "manual">("preset")

  useEffect(() => {
    listDiscounts(false).then(setPresets).catch((e) => setError(String(e)))
  }, [])

  async function applyPreset(d: Discount) {
    setError(null)
    try {
      await applyDiscount(orderId, {
        discount_id: d.id, name: d.name, type: d.type, value: d.value,
      })
      onUpdate()
    } catch (e) { setError(String(e)) }
  }

  async function applyManual() {
    setError(null)
    if (!manualName.trim()) return
    const payload: ApplyDiscountInput = {
      discount_id: null, name: manualName.trim(), type: manualType, value: manualValue,
    }
    try { await applyDiscount(orderId, payload); setManualName(""); setManualValue(0); onUpdate() }
    catch (e) { setError(String(e)) }
  }

  async function removeDiscount(odId: number) {
    setError(null)
    try { await removeOrderDiscount(odId); onUpdate() } catch (e) { setError(String(e)) }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 border-b pb-2">
        <Button variant={tab === "preset" ? "default" : "outline"} size="sm" onClick={() => setTab("preset")}>Có sẵn</Button>
        <Button variant={tab === "manual" ? "default" : "outline"} size="sm" onClick={() => setTab("manual")}>Thủ công</Button>
      </div>

      {tab === "preset" && (
        <ul className="flex flex-col gap-1">
          {presets.length === 0 && <li className="text-sm text-muted-foreground">Chưa có chiết khấu preset</li>}
          {presets.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded border px-3 py-2">
              <span className="text-sm">{d.name} — {d.type === "PERCENT" ? `${d.value}%` : formatVnd(d.value)}</span>
              <Button size="sm" variant="ghost" onClick={() => applyPreset(d)}>Áp dụng</Button>
            </li>
          ))}
        </ul>
      )}

      {tab === "manual" && (
        <div className="flex flex-col gap-2">
          <Input placeholder="Tên chiết khấu" value={manualName} onChange={(e) => setManualName(e.target.value)} />
          <div className="flex gap-2">
            <select className="rounded-md border px-2 py-1 text-sm" value={manualType}
              onChange={(e) => setManualType(e.target.value as "PERCENT" | "AMOUNT")}>
              <option value="PERCENT">%</option>
              <option value="AMOUNT">VND</option>
            </select>
            <Input type="number" placeholder={manualType === "PERCENT" ? "0–100" : "Số tiền"} value={manualValue}
              onChange={(e) => setManualValue(Number(e.target.value))} />
          </div>
          <Button onClick={applyManual}>Áp dụng thủ công</Button>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {appliedDiscounts.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Đã áp dụng</p>
          {appliedDiscounts.map((od) => (
            <div key={od.id} className="flex items-center justify-between text-sm">
              <span>{od.name}: −{formatVnd(od.amount_applied)}</span>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeDiscount(od.id)}>Bỏ</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Tạo `src/routes/payment/CashInput.tsx`** — bàn phím số tiền mặt: hiển thị tổng đơn, nhập tiền khách đưa (numpad + input), tính và hiển thị tiền thừa real-time.

```tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatVnd } from "@/lib/format"

type Props = {
  total: number
  onConfirm: (tendered: number) => void  // callback khi nhấn Xác nhận
}

const PAD_KEYS = ["7","8","9","4","5","6","1","2","3","","0","⌫"]

export default function CashInput({ total, onConfirm }: Props) {
  const [raw, setRaw] = useState("")  // chuỗi digits

  const tendered = parseInt(raw || "0", 10) * 1000  // đơn vị nghìn đồng để dễ nhập
  const change = Math.max(0, tendered - total)
  const insufficient = tendered > 0 && tendered < total

  function handlePad(key: string) {
    if (key === "⌫") { setRaw((p) => p.slice(0, -1)); return }
    if (key === "") return
    setRaw((p) => (p + key).slice(0, 7))  // tối đa 9.999.000₫
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Tổng cộng</p>
        <p className="text-2xl font-bold">{formatVnd(total)}</p>
      </div>

      <div className="text-center">
        <Input
          type="number"
          className="text-center text-lg font-semibold"
          placeholder="Tiền khách đưa (VND)"
          value={tendered || ""}
          onChange={(e) => setRaw(String(Math.floor(Number(e.target.value) / 1000)))}
        />
        <p className="mt-1 text-xs text-muted-foreground">Nhập trực tiếp hoặc dùng bàn phím bên dưới (×1000₫)</p>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {PAD_KEYS.map((k, i) => (
          <Button key={i} variant="outline"
            className="h-12 text-lg"
            onClick={() => handlePad(k)}
            disabled={k === ""}
          >
            {k}
          </Button>
        ))}
      </div>

      {tendered > 0 && (
        <div className={`rounded p-2 text-center text-sm ${insufficient ? "bg-destructive/10 text-destructive" : "bg-green-50 text-green-700"}`}>
          {insufficient
            ? `Thiếu ${formatVnd(total - tendered)}`
            : `Tiền thừa: ${formatVnd(change)}`}
        </div>
      )}

      <Button
        className="h-14 text-lg"
        disabled={insufficient || tendered === 0}
        onClick={() => onConfirm(tendered)}
      >
        Xác nhận tiền mặt
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Build** — Run: `npm run build` → OK.

- [ ] **Step 4: Commit**

```bash
git add src/routes/payment/DiscountPanel.tsx src/routes/payment/CashInput.tsx
git commit -m "feat(payment): add DiscountPanel and CashInput components"
```

---

## Task 9: BillPreview component

**Files:** Create `src/routes/payment/BillPreview.tsx`.

- [ ] **Step 1: Tạo `src/routes/payment/BillPreview.tsx`** — nhận HTML string, hiển thị trong iframe, nút In (`window.print()`). CSS `@media print` ẩn mọi thứ trừ iframe.

```tsx
import { Button } from "@/components/ui/button"

type Props = {
  htmlContent: string
  onClose: () => void
}

export default function BillPreview({ htmlContent, onClose }: Props) {
  function handlePrint() {
    // Mở cửa sổ in từ iframe srcdoc
    const win = window.open("", "_blank", "width=400,height=600")
    if (win) {
      win.document.write(htmlContent)
      win.document.close()
      win.focus()
      win.print()
      win.close()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Xem trước bill</h3>
        <div className="flex gap-2">
          <Button onClick={handlePrint}>In bill</Button>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </div>
      </div>
      <iframe
        srcDoc={htmlContent}
        title="Bill"
        className="h-[60vh] w-full rounded border bg-white"
        sandbox="allow-same-origin"
      />
    </div>
  )
}
```

- [ ] **Step 2: Build** — Run: `npm run build` → OK.

- [ ] **Step 3: Commit**

```bash
git add src/routes/payment/BillPreview.tsx
git commit -m "feat(payment): add BillPreview component with window.print"
```

---

## Task 10: Màn hình Payment chính

**Files:** Create `src/routes/Payment.tsx`; Modify `src/App.tsx`, `src/routes/Sales.tsx` (thêm nút Thanh toán).

- [ ] **Step 1: Tạo `src/routes/Payment.tsx`** — màn hình chính thanh toán. Layout: trái = tóm tắt đơn + DiscountPanel; phải = chọn phương thức (Cash → CashInput / QR → nút "Đã nhận") + nút Hoàn tất + BillPreview.

```tsx
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { formatVnd } from "@/lib/format"
import { getOrder } from "@/lib/api/orders"
import {
  addPayment, finalizeOrder, generateBillHtml,
  type Payment,
} from "@/lib/api/payments"
import DiscountPanel from "@/routes/payment/DiscountPanel"
import CashInput from "@/routes/payment/CashInput"
import BillPreview from "@/routes/payment/BillPreview"
import type { Order } from "@/lib/api/orders"

type PayMethod = "CASH" | "QR" | null

export default function Payment() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const id = Number(orderId)

  const [order, setOrder] = useState<Order | null>(null)
  const [method, setMethod] = useState<PayMethod>(null)
  const [billHtml, setBillHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function refresh() {
    try { setOrder(await getOrder(id)) } catch (e) { setError(String(e)) }
  }

  useEffect(() => { refresh() }, [id])

  async function handleCashConfirm(tendered: number) {
    if (!order) return
    setError(null)
    setLoading(true)
    try {
      await addPayment(id, { method: "CASH", amount: order.total, tendered, ref_note: null })
      await refresh()
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  async function handleQrConfirm() {
    if (!order) return
    setError(null)
    setLoading(true)
    try {
      await addPayment(id, { method: "QR", amount: order.total, tendered: null, ref_note: null })
      await refresh()
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  async function handleFinalize() {
    if (!order) return
    setError(null)
    setLoading(true)
    try {
      await finalizeOrder(id)
      const html = await generateBillHtml(id)
      setBillHtml(html)
      await refresh()
    } catch (e) { setError(String(e)) }
    finally { setLoading(false) }
  }

  if (!order) return <div className="p-6">Đang tải...</div>

  const isPaid = order.status === "PAID"
  const paymentsTotal = order.payments.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, order.total - paymentsTotal)

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <h1 className="text-xl font-bold">Thanh toán — Đơn {order.code}</h1>
        <Button variant="outline" onClick={() => navigate(-1)}>Quay lại</Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — Order summary + discounts */}
        <div className="flex w-1/2 flex-col gap-4 overflow-y-auto border-r p-4">
          {/* Items */}
          <div>
            <h2 className="mb-2 font-semibold">Chi tiết đơn</h2>
            <ul className="divide-y rounded-md border text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between px-3 py-2">
                  <div>
                    <span>{item.product_name}</span>
                    {item.size_name && <span className="ml-1 text-muted-foreground">({item.size_name})</span>}
                    <span className="ml-2 text-muted-foreground">×{item.quantity}</span>
                  </div>
                  <span>{formatVnd(item.line_total)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Discount panel — chỉ hiện khi đơn chưa PAID */}
          {!isPaid && (
            <div>
              <h2 className="mb-2 font-semibold">Chiết khấu</h2>
              <DiscountPanel
                orderId={id}
                appliedDiscounts={order.discounts}
                subtotal={order.subtotal}
                onUpdate={refresh}
              />
            </div>
          )}

          {/* Summary */}
          <div className="rounded-md border p-3 text-sm">
            <div className="flex justify-between"><span>Tạm tính</span><span>{formatVnd(order.subtotal)}</span></div>
            {order.discount_total > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Giảm giá</span><span>−{formatVnd(order.discount_total)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>Tổng cộng</span><span>{formatVnd(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Right — Payment method + finalize */}
        <div className="flex w-1/2 flex-col gap-4 overflow-y-auto p-4">
          {isPaid ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-md bg-green-50 p-4 text-center text-green-700">
                <p className="text-lg font-bold">Đã thanh toán</p>
                <p className="text-sm">Đơn hoàn tất lúc {order.paid_at}</p>
              </div>
              {billHtml && (
                <BillPreview htmlContent={billHtml} onClose={() => setBillHtml(null)} />
              )}
              {!billHtml && (
                <Button variant="outline" onClick={async () => setBillHtml(await generateBillHtml(id))}>
                  Xem / In bill
                </Button>
              )}
              <Button onClick={() => navigate("/sales")}>Về bán hàng</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Chọn phương thức */}
              <div>
                <h2 className="mb-2 font-semibold">Phương thức thanh toán</h2>
                <div className="flex gap-3">
                  <Button
                    variant={method === "CASH" ? "default" : "outline"}
                    className="h-16 flex-1 text-lg"
                    onClick={() => setMethod("CASH")}
                  >
                    Tiền mặt
                  </Button>
                  <Button
                    variant={method === "QR" ? "default" : "outline"}
                    className="h-16 flex-1 text-lg"
                    onClick={() => setMethod("QR")}
                  >
                    QR / Chuyển khoản
                  </Button>
                </div>
              </div>

              {/* Input theo phương thức */}
              {method === "CASH" && remaining > 0 && (
                <CashInput total={remaining} onConfirm={handleCashConfirm} />
              )}

              {method === "QR" && remaining > 0 && (
                <div className="flex flex-col gap-3 rounded-md border p-4 text-center">
                  <p className="text-muted-foreground text-sm">Yêu cầu khách quét mã QR chuyển khoản</p>
                  <p className="text-2xl font-bold">{formatVnd(remaining)}</p>
                  <Button className="h-14 text-lg" onClick={handleQrConfirm} disabled={loading}>
                    Đã nhận tiền
                  </Button>
                </div>
              )}

              {/* Payments received */}
              {order.payments.length > 0 && (
                <div className="rounded-md border p-3 text-sm">
                  <p className="mb-1 font-medium">Đã nhận</p>
                  {order.payments.map((p) => (
                    <div key={p.id} className="flex justify-between">
                      <span>{p.method === "CASH" ? "Tiền mặt" : "QR"}</span>
                      <span>{formatVnd(p.amount)}</span>
                    </div>
                  ))}
                  {remaining > 0 && (
                    <div className="mt-1 flex justify-between font-semibold text-amber-700">
                      <span>Còn thiếu</span><span>{formatVnd(remaining)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Finalize button */}
              {paymentsTotal >= order.total && (
                <Button
                  className="h-14 text-lg"
                  onClick={handleFinalize}
                  disabled={loading}
                >
                  Hoàn tất đơn hàng
                </Button>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Thêm route** — trong `src/App.tsx`, thêm:
```tsx
{ path: "/payment/:orderId", element: <Payment /> }
```
(import `Payment from "@/routes/Payment"`).

- [ ] **Step 3: Thêm nút Thanh toán trong `src/routes/Sales.tsx`** — trong CartPanel hoặc khu vực tóm tắt đơn, thêm nút:
```tsx
import { useNavigate } from "react-router-dom"
// ...
const navigate = useNavigate()
// Trong JSX, khi có currentOrderId:
<Button onClick={() => navigate(`/payment/${currentOrderId}`)}>
  Thanh toán
</Button>
```

- [ ] **Step 4: Build** — Run: `npm run build` → OK.

- [ ] **Step 5: Commit**

```bash
git add src/routes/Payment.tsx src/routes/payment/ src/App.tsx src/routes/Sales.tsx
git commit -m "feat(payment): add Payment screen with cash/QR flow, discounts, finalize, bill preview"
```

---

## Task 11: Quản lý chiết khấu (settings screen hook)

**Files:** Create `src/routes/payment/DiscountManagement.tsx` (standalone hoặc embedded trong Settings M7). Đây là màn hình CRUD preset discounts — tối giản, để thêm vào Settings ở M7.

- [ ] **Step 1: Tạo `src/routes/payment/DiscountManagement.tsx`** — list preset discounts, thêm/sửa qua Dialog, bật/tắt. Theo khuôn `CategoryTab.tsx` (M1):

```tsx
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Dialog, DialogContent, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { formatVnd } from "@/lib/format"
import {
  listDiscounts, createDiscount, updateDiscount, setDiscountActive,
  type Discount, type DiscountInput,
} from "@/lib/api/payments"

const emptyInput = (): DiscountInput => ({
  name: "", type: "PERCENT", value: 0, scope: "ORDER",
  valid_from: null, valid_to: null, sort_order: 0,
})

export default function DiscountManagement() {
  const [items, setItems] = useState<Discount[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Discount | null>(null)
  const [form, setForm] = useState<DiscountInput>(emptyInput())
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    try { setItems(await listDiscounts(true)) } catch (e) { setError(String(e)) }
  }
  useEffect(() => { refresh() }, [])

  function openNew() { setEditing(null); setForm(emptyInput()); setOpen(true) }
  function openEdit(d: Discount) {
    setEditing(d)
    setForm({ name: d.name, type: d.type, value: d.value, scope: d.scope,
               valid_from: d.valid_from, valid_to: d.valid_to, sort_order: d.sort_order })
    setOpen(true)
  }

  async function onSave() {
    setError(null)
    try {
      if (editing) await updateDiscount(editing.id, form)
      else await createDiscount(form)
      setOpen(false); await refresh()
    } catch (e) { setError(String(e)) }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}>Thêm chiết khấu</Button></DialogTrigger>
          <DialogContent>
            <DialogTitle>{editing ? "Sửa chiết khấu" : "Thêm chiết khấu"}</DialogTitle>
            <div className="flex flex-col gap-3">
              <Input placeholder="Tên" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <div className="flex gap-2">
                <select className="rounded-md border px-2 py-1 text-sm" value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "PERCENT" | "AMOUNT" }))}>
                  <option value="PERCENT">Phần trăm (%)</option>
                  <option value="AMOUNT">Số tiền (VND)</option>
                </select>
                <Input type="number" placeholder={form.type === "PERCENT" ? "0–100" : "Số tiền"} value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))} />
              </div>
              <select className="rounded-md border px-2 py-1 text-sm" value={form.scope}
                onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value as "ORDER" | "ITEM" }))}>
                <option value="ORDER">Áp dụng toàn đơn</option>
                <option value="ITEM">Áp dụng từng dòng</option>
              </select>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Huỷ</Button>
                <Button onClick={onSave}>Lưu</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="divide-y rounded-md border">
        {items.map((d) => (
          <li key={d.id} className="flex items-center justify-between p-3">
            <div>
              <span className={d.is_active ? "font-medium" : "font-medium text-muted-foreground line-through"}>
                {d.name}
              </span>
              <span className="ml-2 text-sm text-muted-foreground">
                {d.type === "PERCENT" ? `${d.value}%` : formatVnd(d.value)} — {d.scope === "ORDER" ? "Đơn" : "Dòng"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={d.is_active} onCheckedChange={(v) => setDiscountActive(d.id, v).then(refresh)} />
              <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>Sửa</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Build** — Run: `npm run build` → OK.

- [ ] **Step 3: Commit**

```bash
git add src/routes/payment/DiscountManagement.tsx
git commit -m "feat(payment): add DiscountManagement CRUD screen (preset discounts)"
```

---

## Task 12: Kiểm chứng end-to-end + cổng chất lượng

**Files:** none (verification).

- [ ] **Step 1: Chạy toàn bộ quality gate** —

```bash
npm run lint
npx prettier --check .
npm run test
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
```

Tất cả phải xanh. Sửa nếu có (prettier/eslint trên file mới; nếu `cargo clippy` báo lỗi dead_code cho `generate_bill_pdf`, thêm `#[allow(dead_code)]`).

- [ ] **Step 2: Kiểm chứng app thật** — Run: `npx tauri dev`. Luồng kiểm tra:
  1. Tạo đơn TAKEAWAY qua `/sales`, thêm 2 món → tổng > 0.
  2. Nhấn "Thanh toán" → vào `/payment/:id`.
  3. Áp dụng chiết khấu % + thủ công → xem total cập nhật.
  4. Chọn "Tiền mặt" → nhập số tiền lớn hơn total → thấy tiền thừa → "Xác nhận tiền mặt".
  5. Nhấn "Hoàn tất đơn hàng" → trạng thái "Đã thanh toán".
  6. Nhấn "Xem / In bill" → xem HTML bill, nhấn "In bill" → hộp thoại in mở.
  7. Tạo đơn DINE_IN bàn 1 → thanh toán QR → "Đã nhận tiền" → Hoàn tất → bàn 1 trống lại (có thể tạo đơn mới).
  8. Đóng app → mở lại → orders PAID vẫn có trong DB.

- [ ] **Step 3: Commit (nếu có sửa ở Step 1)** —

```bash
git add -A
git commit -m "chore(payment): fix lint/format and finalize M4 quality gates"
```

---

## Definition of Done (M4)

- [ ] Migration `0005_payments.sql` chạy sạch trên DB mới và DB M3 cũ; 3 bảng tồn tại (`discounts`, `order_discounts`, `payments`).
- [ ] `services/payment.rs`: tất cả 16 tests pass — percent/amount discount, cumulative clamping, change_due, finalize guard, full integration flow.
- [ ] `repo/payments.rs`: tất cả repo tests pass — create/list discount, apply/remove discount (recompute), add CASH/QR payment, finalize PAID + nhả bàn, fail khi underpaid.
- [ ] `load_order` trong `repo/orders.rs` populate `discounts` và `payments` đúng — M3 tests vẫn pass.
- [ ] Màn hình `/payment/:orderId`: discount preset + thủ công hoạt động, Cash numpad tính tiền thừa đúng, QR "Đã nhận" đúng, Hoàn tất đơn đổi status → PAID, bill HTML hiện đúng, In mở hộp thoại in.
- [ ] Bill HTML: hiển thị tên cửa hàng (từ settings), danh sách món, tổng, chiết khấu, tiền thừa (nếu Cash), footer.
- [ ] `generate_bill_pdf` trả stub string — không crash, không block M7.
- [ ] Toàn bộ CI gate xanh: `npm run lint`, `prettier --check`, `npm run test`, `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`, `npm run build`.
- [ ] PR M4 → CI xanh trên GitHub → merge (GitHub Flow).
