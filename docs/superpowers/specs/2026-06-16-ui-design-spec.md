# HiGi POS — UI Design Spec (chuẩn theo Figma Make "Cafe POS System")

| | |
|---|---|
| **Mục đích** | Bản thiết kế chuẩn để Codex code **giao diện app khớp y hệt** thiết kế Figma Make đã duyệt |
| **Ngày** | 2026-06-16 |
| **Nguồn sự thật (reference code)** | `docs/design/src/` — bản Figma Make export (React+Vite+Tailwind+shadcn+lucide+recharts). File tích hợp đầy đủ: **`docs/design/src/app/App.tsx`**; tokens: **`docs/design/src/styles/theme.css`** |
| **Áp dụng cho** | Toàn bộ UI HiGi (đặc biệt M9 màn bán hàng) + các màn M1–M11 |

> **Nguyên tắc:** Codex coi `docs/design/src/app/App.tsx` + `theme.css` là **chuẩn hình ảnh**. Tái tạo layout/component/tokens y hệt, nhưng **adapt vào app thật**: nối lệnh Rust/Tauri có sẵn (không dùng mock state), dùng route HashRouter hiện có, ảnh món lấy từ ảnh upload (M1) thay URL unsplash, và **tuân ràng buộc sản phẩm HiGi** (xem §6).
>
> **🔒 CHỐT PHẠM VI:** Lấy **GIAO DIỆN** (màu/bố cục/component) theo Make, nhưng **CHỨC NĂNG chỉ trong scope HiGi đã chốt (M0–M11)**. **BỎ mọi tính năng Make có mà HiGi chưa chốt** — cụ thể: **VAT/thuế** và **đặt bàn (reservation)**. Không thêm chức năng mới ngoài scope. Stack giữ nguyên (Tauri 2 + React + shadcn + SQLite offline).

## 1. Design tokens (BẮT BUỘC — cập nhật `src/index.css` của app cho khớp)

Lấy nguyên từ `docs/design/src/styles/theme.css` (`:root`). App HiGi hiện đang dùng palette neutral oklch — **thay bằng bộ này**:

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--primary` | `#6F4E37` (nâu cà phê) | nút chính, mục active, tổng tiền, nav active |
| `--primary-foreground` | `#FFFFFF` | chữ trên nền nâu |
| `--secondary` | `#F3EDEA` | nền nhấn nhạt (chip, nút bàn trống) |
| `--secondary-foreground` | `#6F4E37` | |
| `--accent` | `#E8A33D` (hổ phách) | nhấn phụ / cảnh báo nhẹ |
| `--destructive` | `#B22D29` (đỏ) | xoá / sắp hết |
| `--background` | `#FAFAF9` | nền app |
| `--card` / `--popover` | `#FFFFFF` | thẻ, modal |
| `--foreground` | `#1C1917` | chữ chính |
| `--muted` / `--muted-foreground` | `#F5F5F4` / `#78716C` | nền/chữ phụ |
| `--border` | `#E7E5E4` | viền |
| `--radius` | `0.875rem` (≈14px) | bo góc (sm/md/lg/xl theo công thức trong theme.css) |
| chart | `#6F4E37`, `#22A06B`, `#E8A33D`, `#B22D29`, `#A78B6D` | biểu đồ |

**Pill/badge tông** (từ App.tsx): green `bg-[#E9F7F0] text-[#167A50]`, red `bg-[#FCEAEA] text-[#B22D29]`, gold `bg-[#FFF5DF] text-[#9A6115]`, brown `bg-[#F3EDEA] text-primary`.

## 2. Typography
- Font: **"Be Vietnam Pro"**, fallback Inter, system-ui (đã set trong `theme.css` `body`). → app cần **thêm font Be Vietnam Pro** (vd `@fontsource-variable/be-vietnam-pro` hoặc Google Fonts) và đặt làm `--font-sans`.
- Quy mô: h1 = text-2xl, h2 = text-xl, h3 = text-lg, weight medium (500). Tổng tiền dùng `text-3xl font-extrabold`.
- Tiền: `new Intl.NumberFormat("vi-VN").format(n) + " ₫"` → đúng `formatVnd` HiGi đã có.

## 3. Khung layout chung (mọi màn)
Theo `App.tsx` (root `flex h-screen`):
- **Nav rail trái** `w-24`, dọc, nền trắng, viền phải: mỗi mục = icon (lucide) + label nhỏ `text-[11px] font-bold`, active = `bg-primary text-white`, hover = `bg-secondary`. Thứ tự: **Trang chủ(Home) · Bán hàng(ShoppingCart) · Bàn(Table2) · Thực đơn(ChefHat) · Kho(Boxes) · Khách hàng(Users) · Báo cáo(ReceiptText) · Cài đặt(Settings)**.
- **Header** `h-20`, nền trắng, viền dưới: trái = ô logo `size-12 rounded-2xl bg-primary text-white` (icon Coffee) + "HiGi POS" `text-2xl font-extrabold` + dòng phụ "Ca sáng · Offline · Quầy chính"; phải = pill xanh "Đã đồng bộ cục bộ" + ngày/giờ.
- **Vùng nội dung**: cuộn, đổi theo route.
- shadcn components: dùng bộ trong `docs/design/src/app/components/ui/` (button, card, dialog, badge, tabs, table, input, switch...) — app HiGi đã có shadcn nên dùng component tương đương.

## 4. Đặc tả từng màn (bám `App.tsx`)

### 4.1 Bán hàng (Sale) — **ưu tiên #1**
- Grid 3 cột: `grid-cols-[220px_1fr_380px]` (≤1000px → 2 cột).
- **Cột trái — danh mục:** nút lớn `min-h-14 rounded-2xl`, active `bg-primary text-white`, còn lại `border bg-white`. (Tất cả, Cà phê, Trà, Trà sữa, Đá xay…).
- **Giữa — lưới món:** ô tìm món (`rounded-2xl border` + icon Search) ở trên; grid `grid-cols-3 gap-4` card món: `rounded-2xl border bg-white shadow-sm`, ảnh `h-32 object-cover`, tên `<b>`, giá `text-xl font-extrabold text-primary`, badge "Ít" (đỏ) nếu sắp hết; **tap card** → nếu `hasOptions` mở **modal tùy chọn**, ngược lại thêm thẳng vào đơn; hover `-translate-y-0.5 shadow-md`.
- **Phải — đơn hàng:** header "Đơn A1" + khách ("Nguyễn Văn An (1.250 điểm)"); list item `rounded-2xl bg-stone-50 p-3` (tên + giá, dòng tùy chọn `text-muted-foreground`, stepper **− [qty] +** với nút `size-11`, nút + = `bg-primary text-white`); footer: **Tạm tính** + **Tổng** `text-3xl font-extrabold` + nút **THANH TOÁN** `min-h-16 rounded-2xl bg-primary text-xl font-extrabold text-white`.
- **Adapt:** nối `create_order`/`add_order_item`/`update_order_item` (M3), khách nối M11; **bỏ "Thuế 8%"** → thay bằng **"Giảm giá"** (xem §6); ảnh từ `read_image_data_url` (M1).

### 4.2 Trang chủ (Dashboard)
- Grid `[1fr_320px]`. Trái: 4 **KPI card** (Doanh thu / Đơn hôm nay / Đang xử lý / TB/đơn — số `text-3xl` + pill); **biểu đồ doanh thu tuần** (recharts AreaChart, gradient `#6F4E37`); list **"Đơn đang xử lý"** (mỗi dòng + pill "Đang pha" gold). Phải (aside): **"Bàn trống"** (grid nút `bg-[#F3EDEA] text-primary`), **"Sắp hết hàng"** (dòng + pill đỏ).
- **Adapt:** số liệu từ report commands (M6), bàn từ M2, sắp hết từ M10.

### 4.3 Bàn (Tables)
- Tabs khu vực (Tầng trệt/Lầu 1/Mang đi). Grid `grid-cols-5` card bàn `min-h-32 rounded-2xl border`, **chỉ 2 trạng thái** (HiGi KHÔNG có đặt bàn): **Trống = trắng**; **Đang dùng = `bg-[#E9F7F0] border-[#22A06B]`** (có đơn OPEN gắn bàn); hiện tên `text-2xl`, trạng thái, tổng tiền `text-primary`. Tap → mở đơn (Bán hàng).
- **Adapt:** nối M2 (areas/tables) + trạng thái từ đơn OPEN (M3). **Bỏ trạng thái "Đặt trước"** (reservation) — không thuộc scope HiGi.

### 4.4 Modal Tùy chọn món
- Overlay `bg-black/30`, card `w-[560px]`. Các nhóm: **Size** (M / L +5.000₫), **Đường** (0/50/100%), **Đá** (Ít/Bình thường), **Topping** (Không / Trân châu +5.000₫) — nút `min-h-12 rounded-xl border`, chọn = `bg-primary text-white`; textarea ghi chú; nút "Thêm vào đơn" nâu.
- **Adapt:** mức đường/đá/topping lấy từ M1/M7; nối add_order_item.

### 4.5 Modal Thanh toán (Checkout)
- Card `w-[860px] grid-cols-2`. **Trái:** tiêu đề "Thanh toán" + tabs **Tiền mặt / VietQR**; tiền mặt → input "Khách đưa" + "Tiền thối" `text-[#22A06B]`; VietQR → ô QR; nút **"Hoàn tất"** `bg-[#22A06B]`. **Phải (nền `#F3EDEA`):** preview **"Màn hình khách"** (icon Coffee + "Đang chờ thanh toán" + tổng `text-4xl text-primary` + "Cảm ơn quý khách đã ghé HiGi!") + tạm tính/tổng.
- **Adapt:** nối `add_payment`/`finalize_order` (M4) + VietQR offline (M8); **bỏ Thuế** (§6); "Màn hình khách" ở đây là *preview* — bản thật là cửa sổ 2 của M8.

### 4.6 Thực đơn / Kho / Khách hàng / Báo cáo / Cài đặt
- Trong Make là `Generic` (card + 3 thẻ con) + **Báo cáo** có BarChart (món bán chạy, `radius-[12,12,0,0]`, xen kẽ `#6F4E37`/`#A78B6D`).
- **Adapt:** giữ **design language** (card bo `rounded-2xl`, pill badge, chart recharts) nhưng dựng nội dung thật theo plan đã có: **Thực đơn = M1, Kho = M10, Khách = M11, Báo cáo = M6, Cài đặt = M7**.

## 5. Thư viện cần thêm vào app HiGi
- `lucide-react` (icon — kiểm tra đã có chưa), **`recharts`** (biểu đồ Dashboard/Báo cáo), font **Be Vietnam Pro**. shadcn: app đã có; bổ sung component nào Make dùng mà app thiếu (tabs/table/dialog… đa số đã có).

## 6. Khác biệt phải xử lý (QUYẾT ĐỊNH)
1. **Thuế 8% (VAT) — ĐÃ CHỐT: BỎ HẲN.** HiGi không VAT. Trong giỏ đơn/checkout: chỉ **Tạm tính → Giảm giá → Tổng** (đúng M4), không có dòng "Thuế".
2. **Mock state → lệnh thật:** mọi dữ liệu trong App.tsx là mock; app thật phải nối Tauri commands (M1–M11) + SQLite.
3. **Ảnh unsplash → ảnh upload:** card món dùng `image_path` upload (M1), placeholder nếu chưa có.
4. **Màn hình khách:** App.tsx chỉ có preview trong checkout; bản thật là **cửa sổ thứ 2 (M8)** — giữ M8, dùng đúng visual này cho nội dung.
5. **Routing:** app dùng HashRouter (`#/...`); nav rail map sang các route hiện có, không dùng state `screen` như Make.

## 7. Việc cho Codex
- Cập nhật `src/index.css` tokens theo §1; thêm font + recharts.
- Dựng/cải tạo nav rail + header chung (§3).
- Làm **M9 (Bán hàng)** khớp §4.1 trước; rồi Dashboard/Bàn/modals; các màn M1/M6/M10/M11/M7 giữ design language §4.6.
- Bám sát `docs/design/src/app/App.tsx` cho từng class/cấu trúc; xử lý §6.
- Giữ kỷ luật HiGi: React gọi command, integer VND + `formatVnd`, test, lefthook/commitlint, CI xanh.
