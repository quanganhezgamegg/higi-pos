# M9b — App Shell (Nav Rail + Header) + Dashboard KPI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Bối cảnh (vì sao có task này):** M9 đã dựng màn `/sales` 3-pane khớp UI Design Spec (commit `545d8f2`, release `v1.1.2`) — tokens nâu cà phê + Be Vietnam Pro + không VAT + lệnh thật + test, CI xanh. **Nhưng** plan M9 không có task cho **§3 (khung layout chung: nav rail trái + header)** và **§4.2 (Trang chủ dạng Dashboard)** trong `docs/superpowers/specs/2026-06-16-ui-design-spec.md`. Hiện `src/App.tsx` dùng `createHashRouter` phẳng, không có layout chung; `src/routes/Home.tsx` vẫn là lưới nút launcher cũ. Task này bù đúng 2 phần đó + sửa 3 chuỗi tiếng Việt thiếu dấu trong `src/routes/sales/ProductGrid.tsx`.

**Goal:** Bọc toàn bộ màn vận hành trong một **App Shell** (nav rail icon dọc bên trái `w-24` + header `h-20`) đúng spec §3, và thay `Home.tsx` bằng **Dashboard KPI** đúng spec §4.2. **Không thêm Rust command / migration mới** — chỉ tái dùng API đã có. Giữ kỷ luật HiGi (integer VND + `formatVnd`, test, lefthook/commitlint, CI xanh).

**Nguồn sự thật hình ảnh:** `docs/design/src/app/App.tsx` (nav rail + header + Dashboard) và `docs/design/src/styles/theme.css`. Đặc tả chữ: `docs/superpowers/specs/2026-06-16-ui-design-spec.md` §3 và §4.2.

---

## Phạm vi

**TRONG scope (đúng 3 việc):**
1. App Shell dùng chung: **Nav rail trái** (§3) + **Header** (§3) → áp cho mọi route vận hành.
2. **Dashboard** thay `Home.tsx` (§4.2): 4 KPI card + biểu đồ doanh thu tuần (recharts) + "Đơn đang xử lý" + aside "Bàn trống" + aside "Sắp hết hàng".
3. Sửa **3 chuỗi thiếu dấu** trong `ProductGrid.tsx`.

**NGOÀI scope (không làm trong task này):**
- Không sửa logic màn `/sales` đã xong (chỉ chỉnh chiều cao để vừa shell — xem Task 1.4).
- Không build M10 (kho) / M11 (khách hàng) — chỉ chừa chỗ trên nav rail (disabled) + placeholder panel "Sắp hết hàng".
- Không thêm VAT/đặt bàn (đã chốt bỏ).
- Không đổi Tauri command / migration / schema.

---

## Phụ thuộc (API đã có — KHÔNG tạo mới)

- `src/lib/api/reports.ts` → `reportSalesSummary(payload)` trả `{ revenue, order_count, avg_order_value, discount_total }` (M6).
- `src/lib/api/orders.ts` → `listOpenOrders()` → `Order[]` (M3) — cho KPI "Đang xử lý" + list "Đơn đang xử lý".
- `src/lib/api/tables.ts` → `listTableStatus()` → `TableStatus[]` (M2) — aside "Bàn trống" (lọc `status === "TRONG"`).
- `src/lib/api/shifts.ts` → `getCurrentShift()` (M5) — header hiển thị trạng thái ca.
- `src/lib/api/branding.ts` / `src/lib/api/settings.ts` (M7/M8) — tên quán/logo cho header nếu đã có; nếu chưa tiện thì hardcode "HiGi POS" + icon `Coffee`.
- `src/lib/format.ts` → `formatVnd`.
- **Định dạng range (BẮT BUỘC đúng, nếu sai backend trả rỗng → KPI = 0):** `Reports.tsx` (M6) dùng `from: "YYYY-MM-DDT00:00:00Z"`, `to: "YYYY-MM-DDT23:59:59Z"`, `shift_id: null` (hậu tố `Z` = UTC — GIỮ NGUYÊN để khớp hành vi backend). Lưu ý: `Reports.tsx` **lấy ngày từ input người dùng, KHÔNG tự sinh** — Dashboard phải tự sinh `YYYY-MM-DD`. Helper gợi ý:
  ```ts
  const ymd = (d: Date) => d.toISOString().slice(0, 10) // "2026-06-17"
  const dayRange = (d: Date) => ({
    from: `${ymd(d)}T00:00:00Z`, to: `${ymd(d)}T23:59:59Z`, shift_id: null,
  })
  ```

**Phụ thuộc chưa có (xử lý mềm):**
- "Sắp hết hàng" cần **M10 (kho)** → CHƯA có API. Render panel với **empty-state** "Chưa bật quản lý kho (M10)" + để `// TODO(M10): nối low-stock` . Giữ khung panel cho đúng visual.
- Nav item "Kho" (M10) và "Khách hàng" (M11) → **disabled** (không có route đích).

---

## Thư viện cần thêm

- [ ] `recharts` (cho AreaChart Dashboard) — cài bản **hỗ trợ React 19** (recharts ≥2.15; 3.x càng tốt). App đang dùng React 19.2 → nếu `npm i recharts` báo peerDeps kẹt, chọn version tương thích React 19, KHÔNG dùng `--force` bừa. (Spec §5 đã yêu cầu; `lucide-react` đã có sẵn.)

---

## Kiến trúc

**File mới:**
- `src/components/layout/AppLayout.tsx` — shell: `<div class="flex h-screen">` = `<NavRail/>` + `<div class="flex flex-1 flex-col min-w-0"><AppHeader/><main class="flex-1 min-h-0 overflow-y-auto"><Outlet/></main></div>`.
- `src/components/layout/NavRail.tsx` — thanh icon dọc trái.
- `src/components/layout/AppHeader.tsx` — header chung.
- (Dashboard có thể tách `src/routes/home/` nếu Home.tsx phình to — tùy Codex; không bắt buộc.)

**Refactor router (`src/App.tsx`):** chuyển sang nested route — layout bọc các route vận hành, **trừ** `/customer` (cửa sổ khách M8, full-screen, KHÔNG có shell):

```tsx
const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/sales", element: <Sales /> },
      { path: "/payment/:orderId", element: <Payment /> },
      { path: "/shift", element: <ShiftScreen /> },
      { path: "/reports", element: <Reports /> },
      { path: "/menu", element: <Menu /> },
      { path: "/tables", element: <Tables /> },
      { path: "/settings", element: <Settings /> },
    ],
  },
  { path: "/customer", element: <CustomerDisplay /> }, // full-screen, không shell
])
```

**Stack thực tế (đừng theo nhầm M9 plan ghi "React 18 / Tailwind v3"):** React **19.2**, Tailwind CSS **v4**, react-router-dom **v7**, shadcn/ui, lucide-react, recharts, Vitest + RTL. (App code dùng `new Date()` cho đồng hồ live là OK — đây là code app, không phải workflow script.)

---

## Task 1 — App Shell (Nav rail + Header)

### 1.1 NavRail (`src/components/layout/NavRail.tsx`)
- [ ] Cột dọc `w-24`, nền trắng `bg-card`, `border-r`, cao `h-full`, các mục xếp dọc, cuộn nếu tràn.
- [ ] Mỗi mục = nút điều hướng `flex flex-col items-center gap-1 rounded-2xl py-3`, icon `size-6` + label `text-[11px] font-bold`.
- [ ] Trạng thái **active** (route hiện tại khớp): `bg-primary text-primary-foreground`. **Hover** (mục thường): `bg-secondary`. Dùng `NavLink`/`useLocation` để xác định active.
- [ ] Danh sách mục (icon lucide → route), theo thứ tự spec §3, chèn "Ca" (HiGi-specific, đã có và bắt buộc trước khi bán) trước "Cài đặt":

  | Label | Icon (lucide) | Đích |
  |---|---|---|
  | Trang chủ | `Home` | `/` |
  | Bán hàng | `ShoppingCart` | `/sales` |
  | Bàn | `Table2` | `/tables` |
  | Thực đơn | `ChefHat` | `/menu` |
  | Kho | `Boxes` | **disabled** (M10 chưa có) |
  | Khách hàng | `Users` | **disabled** (M11 chưa có) |
  | Báo cáo | `ReceiptText` | `/reports` |
  | Ca | `Timer` | `/shift` |
  | Cài đặt | `Settings` | `/settings` |

- [ ] Mục **disabled** (Kho, Khách hàng): không `NavLink`, render `button disabled` mờ (`opacity-40 cursor-not-allowed`), `title="Sắp có"`. KHÔNG điều hướng.

### 1.2 AppHeader (`src/components/layout/AppHeader.tsx`)
- [ ] `h-20`, `bg-card`, `border-b`, `flex items-center justify-between px-6`.
- [ ] **Trái:** ô logo `size-12 rounded-2xl bg-primary text-primary-foreground` (icon `Coffee` `size-6`) + cụm chữ: "HiGi POS" `text-2xl font-extrabold` (dùng tên quán từ branding/settings nếu có sẵn, else hardcode) + dòng phụ `text-xs text-muted-foreground` dạng `"{trạng thái ca} · Offline · Quầy chính"` — trong đó `{trạng thái ca}` lấy từ `getCurrentShift()`: có ca mở → "Đang mở ca", null → "Chưa mở ca".
- [ ] **Phải:** pill xanh "Đã đồng bộ cục bộ" (`bg-[#E9F7F0] text-[#167A50] rounded-full px-3 py-1 text-xs font-bold`, kèm chấm tròn xanh) + ngày/giờ live (`text-sm`, cập nhật mỗi phút bằng `setInterval` + `new Date().toLocaleString("vi-VN", …)`).

### 1.3 AppLayout (`src/components/layout/AppLayout.tsx`) + refactor router
- [ ] Tạo `AppLayout` như mục Kiến trúc; vùng `<main>` là **khung cuộn duy nhất** (`flex-1 min-h-0 overflow-y-auto`).
- [ ] Sửa `src/App.tsx` sang nested route (xem block ở trên). Giữ `/customer` đứng riêng ngoài layout.

### 1.4 Hòa giải chiều cao (QUAN TRỌNG — tránh vỡ layout)
Các route con hiện dùng `h-screen`/`min-h-screen` (vd `Sales.tsx` root `h-screen`, `Home.tsx` `min-h-screen`). Khi bị bọc trong shell sẽ tràn quá 800px.
- [ ] Đổi root các route con từ `h-screen`/`min-h-screen` → `h-full` (hoặc bỏ ràng buộc chiều cao, để `<main>` của shell lo phần cuộn). Rà soát tất cả route trong nhánh layout: `Home`, `Sales`, `Payment`, `Shift`, `Reports`, `Menu`, `Tables`, `Settings`.
- [ ] **`Sales.tsx`:** giữ `TopBar` nội bộ (chứa order-type/bàn/tìm món — chức năng riêng của màn bán), chỉ đổi root `h-screen` → `h-full min-h-0`. Có thể bỏ link "Trang chủ" trong `TopBar` vì nav rail đã lo điều hướng (tùy chọn, không bắt buộc).
- [ ] **`/customer` KHÔNG đổi** (vẫn full-screen độc lập).

---

## Task 2 — Dashboard (thay `src/routes/Home.tsx`) — spec §4.2

Layout tổng: `grid grid-cols-[1fr_320px] gap-6 p-6` (≤1100px → 1 cột). Trái = KPI + chart + đơn đang xử lý; phải (aside) = bàn trống + sắp hết hàng.

### 2.1 Tải dữ liệu
- [ ] `useEffect` load song song (`Promise.all`): `reportSalesSummary(today)`, `listOpenOrders()`, `listTableStatus()`, `getCurrentShift()`.
- [ ] `today` range = `dayRange(new Date())` (helper ở mục Phụ thuộc) → `reportSalesSummary(today)`.
- [ ] Biểu đồ tuần: gọi `reportSalesSummary(dayRange(d))` cho **7 ngày gần nhất** (vòng `for` lùi 6→0 ngày từ hôm nay) bằng `Promise.all`, map ra `[{ day: "T2", revenue }, …]` (nhãn thứ VN từ `d.getDay()`). (Chấp nhận 7 lệnh — offline, rẻ; KHÔNG thêm command mới.)
- [ ] Có state `loading` + `error` + empty-state cho mỗi khối.

### 2.2 KPI cards (4 thẻ, `grid-cols-2 lg:grid-cols-4 gap-4`)
- [ ] Card `rounded-2xl border bg-card p-5`: nhãn `text-sm text-muted-foreground`, số `text-3xl font-extrabold`, pill phụ tùy thẻ.
  - **Doanh thu hôm nay** = `summary.revenue` (qua `formatVnd`).
  - **Đơn hôm nay** = `summary.order_count`.
  - **Đang xử lý** = `openOrders.length` (pill gold `bg-[#FFF5DF] text-[#9A6115]`).
  - **TB/đơn** = `summary.avg_order_value` (qua `formatVnd`).

### 2.3 Biểu đồ doanh thu tuần (recharts)
- [ ] `AreaChart` trong `ResponsiveContainer` (cao ~220px), 1 series `revenue`, gradient nâu `#6F4E37` (fill mờ → trong), `XAxis dataKey="day"`, `YAxis` ẩn hoặc format gọn (k/tr), `Tooltip` format `formatVnd`, lưới mảnh. Bọc trong card `rounded-2xl border bg-card p-5` + tiêu đề "Doanh thu 7 ngày".

### 2.4 List "Đơn đang xử lý"
- [ ] Card `rounded-2xl border bg-card`: mỗi dòng map từ `Order`: `code` (mã đơn) + nhãn loại (`order_type === "DINE_IN"` → tên bàn tra từ `listTableStatus()` theo `table_id`; `"TAKEAWAY"` → "Mang đi") + số món = `items.length` + tổng `total` (`formatVnd`, `text-primary font-bold`) + pill "Đang pha" gold. Empty-state: "Chưa có đơn đang xử lý".
- [ ] Click dòng → điều hướng mở đơn (`/sales?...` hoặc `/payment/:orderId` tùy luồng hiện có — tái dùng cách `Sales`/`Tables` đang điều hướng).

### 2.5 Aside phải
- [ ] **Bàn trống:** card; grid nút `bg-[#F3EDEA] text-primary rounded-2xl` các bàn `status === "TRONG"`; click → `/sales?tableId=<id>` (đúng query mà `Sales.tsx` đã đọc). Empty-state: "Hết bàn trống".
- [ ] **Sắp hết hàng:** card với **empty-state** "Chưa bật quản lý kho (M10)" + `// TODO(M10): nối API low-stock`. Giữ khung + tiêu đề để khớp visual.

---

## Task 3 — Sửa chuỗi thiếu dấu (`src/routes/sales/ProductGrid.tsx`)
- [ ] `"Khong co mon nao"` → `"Không có món nào"`.
- [ ] `"Chon size"` → `"Chọn size"`.
- [ ] `"Co topping"` → `"Có topping"`.
- [ ] Quét lại cả file (và `src/routes/sales/*`) xem còn chuỗi UI nào thiếu dấu không, sửa luôn.

---

## Tiêu chí nghiệm thu (Acceptance)
- [ ] Mọi màn vận hành (`/`, `/sales`, `/tables`, `/menu`, `/reports`, `/shift`, `/settings`, `/payment/:id`) có nav rail trái + header; mục active sáng nền nâu đúng route.
- [ ] `/customer` (màn khách M8) **không** có nav rail/header (vẫn full-screen).
- [ ] Trang `/` là Dashboard: 4 KPI số thật từ command, chart 7 ngày render, list đơn đang xử lý + bàn trống nối dữ liệu thật; "Sắp hết hàng" hiện empty-state M10.
- [ ] Không vỡ layout ở 1280×800 (không double-scroll, không tràn): shell cuộn ở `<main>`, các route con `h-full`.
- [ ] Tokens vẫn nâu cà phê + font Be Vietnam Pro; **không** xuất hiện dòng VAT/Thuế ở bất kỳ đâu.
- [ ] 3 chuỗi tiếng Việt đã có dấu.
- [ ] `npm run lint`, `npm run test`, `npm run build` PASS. (Thêm test nhẹ cho NavRail active-state nếu khả thi.)

## Kỷ luật giao hàng
- [ ] Branch theo GitHub Flow (vd `feat/m9b-appshell-dashboard`), Conventional Commits (header ≤100, body line ≤100), lefthook pre-commit, PR vào `main`, chờ CI (`frontend` + `rust`) xanh trước merge.
- [ ] Sau merge: bump version + release theo CD như các milestone trước (vd `v1.2.0`).
- [ ] Bám sát `docs/design/src/app/App.tsx` cho từng class/cấu trúc; tuân ràng buộc §6 spec (no VAT, lệnh thật, ảnh upload, HashRouter).
