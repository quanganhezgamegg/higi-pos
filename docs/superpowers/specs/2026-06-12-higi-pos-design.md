# HiGi POS — Tài liệu thiết kế (Design Spec)

| | |
|---|---|
| **Tên dự án** | HiGi POS |
| **Loại** | Ứng dụng desktop Windows — POS bán hàng tại quầy cho quán cà phê |
| **Ngày** | 2026-06-12 |
| **Trạng thái** | Đã duyệt thiết kế — chờ lập kế hoạch thực thi |
| **Nền tảng** | Tauri + React + TypeScript (chi tiết §3) |

---

## 1. Mục tiêu & bối cảnh

Xây dựng phần mềm bán hàng (POS) cho **một quán cà phê địa phương**, chạy trên **một máy tính Windows tại quầy**, **offline hoàn toàn**, dữ liệu lưu local bằng SQLite. Ưu tiên **giao diện đẹp, hiện đại** và **tối ưu màn hình cảm ứng**. Phần mềm được phát triển cùng AI coding agent (Codex) theo **quy trình production đầy đủ** (git + CI/CD).

Triết lý: làm đúng, gọn, "chuẩn chỉnh" — không over-engineer. YAGNI với các tính năng ngoài phạm vi.

## 2. Phạm vi

### Trong phạm vi v1

- Bán hàng (POS): chọn loại đơn, chọn món, tùy chọn món, giỏ đơn, thanh toán.
- Sơ đồ bàn: khu vực + bàn, trạng thái trống/đang phục vụ, **chuyển bàn / gộp bàn**.
- Quản lý menu: danh mục, món, size, topping, khuyến mãi.
- Tùy chọn món: **size + mức đường/đá + topping** (topping có giá riêng).
- Thanh toán: **tiền mặt + QR/chuyển khoản** (xác nhận thủ công).
- Khuyến mãi / giảm giá: định sẵn + giảm thủ công, mức đơn hoặc mức món.
- Ca làm việc: **mở ca (tiền đầu) / đóng ca (đếm tiền → đối soát chênh lệch)**.
- Báo cáo doanh thu: theo ngày/ca, món bán chạy, cơ cấu phương thức thanh toán.
- Hoá đơn: xem trên màn hình + **xuất PDF** (kiến trúc sẵn sàng nối máy in nhiệt sau).
- Sao lưu dữ liệu: xuất file `.db` ra thư mục chọn.

### Ngoài phạm vi v1 (roadmap)

Tích điểm khách thân thiết · Máy in nhiệt ESC/POS + két tiền tự mở · Nhiều máy/đồng bộ LAN · Đồng bộ/sao lưu cloud · Hoá đơn VAT/thuế điện tử · Quản lý kho & định lượng nguyên liệu · Đăng nhập & phân quyền nhân viên.

### Không làm (đã loại trong brainstorming)

- **Đăng nhập / phân quyền**: v1 không đăng nhập, một người dùng duy nhất, mọi màn hình truy cập tự do.
- **VAT/thuế**: bill chỉ ghi tổng tiền, không tách thuế.
- **Cổng thanh toán điện tử**: QR xác nhận thủ công (xem §7.2).

## 3. Quyết định kỹ thuật (stack)

| Lớp | Công nghệ | Lý do |
|---|---|---|
| Vỏ desktop | **Tauri** (Rust) | App nhẹ (~10MB), khởi động nhanh, build installer Windows gọn, bảo mật tốt |
| Giao diện | **React + TypeScript + Vite** | Hệ sinh thái UI hiện đại, Codex code rất tốt |
| Styling/UI kit | **Tailwind CSS + shadcn/ui** | Giao diện đẹp, hiện đại, dễ tùy biến, hợp cảm ứng |
| Lõi nghiệp vụ + DB | **Rust** (trong `src-tauri`) | Sở hữu SQLite, giao dịch tiền atomic, biên giới có kiểu rõ ràng, dễ test |
| CSDL | **SQLite** (file local) | Offline, không cần server, đủ cho 1 máy |
| Truy cập DB (Rust) | `rusqlite` + `rusqlite_migration` (hoặc `sqlx`) | Nhẹ, đồng bộ, kiểm soát migration tốt |
| State frontend | **Zustand** + **TanStack Query** | State UI gọn; Query quản lý dữ liệu đọc từ Rust + cache/invalidate |
| Routing | **React Router** | Điều hướng giữa các màn hình |

**Nguyên tắc biên giới:** React **không bao giờ** chạm SQL trực tiếp. Mọi đọc/ghi qua **Tauri command** có kiểu rõ ràng. Logic tiền bạc (tính tổng, thanh toán, đóng ca) nằm trong Rust, trong transaction.

## 4. Kiến trúc tổng thể

```
┌──────────────────────────────────────────────────────────┐
│ Frontend: React + TS + Tailwind + shadcn/ui                │
│  routes/ (màn hình) · components/ · store/ (zustand)        │
│  lib/api (wrapper invoke) · lib/format (VND, ngày)          │
└───────────────────────────▲────────────────────────────────┘
                            │ Tauri IPC — invoke(command, args): typed
┌───────────────────────────┴────────────────────────────────┐
│ Rust core (src-tauri)                                        │
│  commands/ (sales, menu, tables, shift, reports, settings,   │
│             backup)                                          │
│        │ gọi                                                  │
│  services/ (nghiệp vụ: tính tiền, vòng đời đơn, đối soát ca) │
│        │ gọi                                                  │
│  repo/ (truy vấn SQLite, transaction)                        │
│  db/ (kết nối, migrations)  ·  domain/ (struct + enum)       │
│  printing/ (sinh bill PDF; hook ESC/POS sau)                 │
└───────────────────────────▲────────────────────────────────┘
                            │
                      SQLite (file ở thư mục AppData của app)
```

**Luồng dữ liệu (ví dụ tạo đơn):** UI gom item → gọi `create_order(payload)` → command → `OrderService::create` (validate, tính tiền) → `OrderRepo` ghi `orders` + `order_items` + `order_item_toppings` trong **một transaction** → trả về `Order` đã lưu → UI cập nhật qua TanStack Query.

**Khởi động app:** Rust mở/khởi tạo file SQLite trong thư mục dữ liệu app → chạy migrations → sẵn sàng. Nếu **chưa có ca mở**, UI nhắc "Mở ca" trước khi cho bán.

## 5. Mô hình dữ liệu

> Quy ước: id `INTEGER PRIMARY KEY` (hoặc UUID text), thời gian lưu UTC ISO-8601, tiền lưu **số nguyên VND** (không thập phân). Tên + giá được **snapshot** vào dòng đơn để bill/báo cáo cũ không sai khi menu đổi.

- **`areas`** — khu vực: `id, name, sort_order, is_active`
- **`tables`** — bàn: `id, area_id, name, seats?, sort_order, is_active`
- **`categories`** — danh mục: `id, name, sort_order, is_active`
- **`products`** — món: `id, category_id, name, base_price, description?, image_path?, has_sugar_ice (bool), is_active, sort_order`
- **`product_sizes`** — size theo món: `id, product_id, name (S/M/L…), price_delta, is_default`
- **`toppings`** — topping dùng chung: `id, name, price, is_active, sort_order`
- **`discounts`** — khuyến mãi định sẵn: `id, name, type (PERCENT|AMOUNT), value, scope (ORDER|ITEM), is_active, valid_from?, valid_to?`
- **`shifts`** — ca: `id, opened_at, closed_at?, opening_cash, expected_cash?, closing_cash_counted?, cash_diff?, total_sales?, status (OPEN|CLOSED), note?`
- **`orders`** — đơn: `id, code, order_type (DINE_IN|TAKEAWAY), table_id?, shift_id, status (OPEN|PAID|CANCELLED), subtotal, discount_total, total, note?, created_at, paid_at?`
- **`order_items`** — dòng đơn: `id, order_id, product_id, product_name (snapshot), size_name?, unit_price (snapshot, đã gồm size_delta), quantity, sugar_level?, ice_level?, line_note?, line_discount, line_total`
- **`order_item_toppings`** — topping của dòng: `id, order_item_id, topping_id, topping_name (snapshot), price (snapshot), quantity`
- **`payments`** — thanh toán: `id, order_id, method (CASH|QR), amount, tendered? (tiền khách đưa), change_due?, paid_at, ref_note?`
- **`order_discounts`** — khuyến mãi đã áp cho đơn: `id, order_id, discount_id?, name (snapshot), type, value, amount_applied`
- **`settings`** — cấu hình key-value: tên quán, địa chỉ, SĐT, mức đường (vd 0/30/50/70/100%), mức đá (0/ít/vừa/nhiều), chân bill, đường dẫn backup mặc định…

**Trạng thái bàn** suy ra từ đơn: bàn có đơn `OPEN` gắn vào → "đang phục vụ"; ngược lại → "trống".

## 6. Màn hình & luồng người dùng

Tối ưu cảm ứng: nút ≥ 44px, lưới card lớn, bàn phím số ảo cho nhập tiền, hạn chế modal lồng nhau.

1. **Trang chủ / Bán hàng (POS)** — màn hình mặc định. Trái: tab danh mục + lưới món. Phải: giỏ đơn (item, tùy chọn, số lượng, tổng tạm) + nút Thanh toán. Bấm món → **popup tùy chọn** (size · đường · đá · topping · số lượng · ghi chú) → thêm vào giỏ.
2. **Sơ đồ bàn** — khu vực dạng tab, bàn dạng card có màu trạng thái. Bấm bàn trống → mở đơn mới gắn bàn. Bấm bàn đang phục vụ → mở lại đơn đó. Thao tác **chuyển bàn / gộp bàn**.
3. **Thanh toán** — hiển thị tổng; chọn phương thức: **Tiền mặt** (bàn phím số nhập tiền khách đưa → tự tính tiền thối) hoặc **QR** (hiện mã/thông tin chuyển khoản → đánh dấu "Đã nhận"). Áp khuyến mãi tại đây. Sau khi chốt: đơn → PAID, bàn nhả ra, xuất/hiện bill.
4. **Quản lý menu** — CRUD danh mục, món, size, topping, khuyến mãi; bật/tắt hiển thị; sắp xếp.
5. **Ca làm việc** — Mở ca (nhập tiền đầu). Đóng ca: hệ thống tính tiền dự kiến, nhân viên đếm tiền thực → app tính chênh lệch, ghi nhận, đóng ca.
6. **Báo cáo** — chọn khoảng ngày/ca → doanh thu, số đơn, giá trị TB/đơn, top món bán chạy, cơ cấu CASH vs QR, tổng khuyến mãi.
7. **Cài đặt** — thông tin quán, mức đường/đá, chân bill, **sao lưu DB** (xuất file `.db`).

## 7. Luồng nghiệp vụ chi tiết

### 7.1 Vòng đời đơn
`OPEN` → `PAID` hoặc `CANCELLED`. Đơn DINE_IN gắn `table_id` và giữ bàn "đang phục vụ" tới khi PAID/CANCELLED. Đơn TAKEAWAY không bàn, thường thanh toán ngay. Mọi đơn gắn `shift_id` của ca đang mở.

### 7.2 Thanh toán
- **Tiền mặt:** nhập `tendered` → `change_due = tendered − total`. Ghi `payments(method=CASH)`.
- **QR/chuyển khoản:** khách quét QR/chuyển khoản → **loa đọc tiền** của quán báo đã nhận → thu ngân bấm **"Đã nhận"** → ghi `payments(method=QR)`. Không tích hợp cổng thanh toán/đối soát ngân hàng tự động ở v1.
- Sau thanh toán đủ: đơn → `PAID`, set `paid_at`.

### 7.3 Tính tiền (quy tắc)
- `line_total = (unit_price + Σ topping.price × topping.qty) × quantity − line_discount`
- `subtotal = Σ line_total`
- `discount_total = Σ order-level discounts` (PERCENT tính trên subtotal, AMOUNT trừ thẳng)
- `total = max(0, subtotal − discount_total)`
- Làm tròn theo **VND nguyên** (không thập phân); quy tắc làm tròn cấu hình được (mặc định: tròn đơn vị đồng).

### 7.4 Ca & đối soát
- Mở ca: `opening_cash`, `status=OPEN`.
- Đóng ca: `expected_cash = opening_cash + Σ payments(CASH) trong ca`; nhân viên nhập `closing_cash_counted`; `cash_diff = counted − expected`; lưu `total_sales`, `status=CLOSED`.

### 7.5 Chuyển / gộp bàn
- **Chuyển bàn:** đổi `table_id` của đơn OPEN sang bàn trống.
- **Gộp bàn:** dồn các dòng của nhiều đơn OPEN vào một đơn đích (giữ snapshot), các đơn nguồn → CANCELLED hoặc đánh dấu đã gộp; bàn nguồn nhả ra.

## 8. Báo cáo (v1)
Doanh thu theo ngày & theo ca · số đơn · giá trị trung bình/đơn · top món bán chạy (theo số lượng & doanh thu) · cơ cấu phương thức (CASH vs QR) · tổng khuyến mãi đã áp. Xuất xem trên màn; (xuất CSV/PDF có thể thêm sau).

## 9. Yêu cầu phi chức năng
- **Offline-first:** không phụ thuộc mạng/internet.
- **Sao lưu:** nút xuất file `.db`; khuyến nghị nhắc backup khi đóng ca (dữ liệu chỉ ở 1 máy → rủi ro mất nếu hỏng ổ).
- **Cảm ứng / UX:** nút lớn, phản hồi nhanh, bàn phím số ảo, ít bước.
- **Ngôn ngữ & tiền tệ:** tiếng Việt; VND không thập phân, định dạng `35.000 ₫`.
- **Hiệu năng:** khởi động nhanh, mượt trên máy cấu hình thấp.
- **An toàn dữ liệu:** ghi tiền trong transaction; snapshot giá/tên trên dòng đơn.
- **Đóng gói:** Tauri build installer `.msi`/`.exe`; lần đầu tự tạo DB + chạy migrations.

## 10. Quy trình kỹ thuật & CI/CD

Mục tiêu: vận hành như **một phòng kỹ thuật đầy đủ** dù là dự án nhỏ.

### 10.1 Source control
- **Git** + remote trên **GitHub** (repo private).
- `.gitignore`: `node_modules/`, `src-tauri/target/`, `dist/`, `*.db`, `*.db-*`, file môi trường, artifact build.
- **EditorConfig** thống nhất whitespace/encoding.

### 10.2 Mô hình nhánh — **GitHub Flow**
- `main` luôn ở trạng thái chạy được (releasable).
- Mỗi việc → nhánh `feat/…`, `fix/…`, `chore/…` → **Pull Request** → CI xanh → merge (squash).
- Release: gắn tag **`vX.Y.Z`** (SemVer) trên `main` → kích hoạt CD build & phát hành.

### 10.3 Quy ước commit & PR
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `ci:`…).
- PR template (mô tả, ảnh chụp UI nếu có, checklist). Yêu cầu **CI xanh** trước khi merge; tự review/Codex review.
- Branch protection trên `main`: cấm push thẳng, bắt buộc PR + CI pass.

### 10.4 Pre-commit hooks (local)
- **Lefthook** (hoặc Husky + lint-staged) chạy trước commit:
  - Frontend: `eslint --fix`, `prettier --write` trên file staged.
  - Rust: `cargo fmt`; (clippy chạy ở CI để không làm chậm commit).

### 10.5 CI — GitHub Actions (chạy trên mỗi PR & push `main`)
Job **frontend**: cài deps → `tsc --noEmit` (typecheck) → `eslint` → `prettier --check` → `vitest run` (unit test) → `vite build`.
Job **rust**: `cargo fmt --check` → `cargo clippy -- -D warnings` → `cargo test`.
Job **build (smoke)**: `tauri build` thử trên `windows-latest` để chắc app đóng gói được (ít nhất trên `main`/PR có thay đổi Rust).

### 10.6 CD — phát hành (chạy khi push tag `v*`)
- Dùng **`tauri-apps/tauri-action`** trên `windows-latest`: build installer `.msi`/`.exe`, tạo **GitHub Release**, đính kèm artifact.
- **Changelog** tự sinh từ Conventional Commits.
- **Code signing** (ký installer để tránh cảnh báo SmartScreen): chừa sẵn chỗ cấu hình; bật khi có chứng chỉ (chưa bắt buộc v1).

### 10.7 Versioning
- **SemVer**; phiên bản đồng bộ giữa `package.json`, `src-tauri/tauri.conf.json`, `Cargo.toml`.

### 10.8 Chiến lược test
- **Rust (trọng tâm):** unit test cho `services` — tính tiền, áp khuyến mãi, đối soát ca, vòng đời đơn (đây là phần dễ sai & quan trọng nhất).
- **Frontend:** Vitest + React Testing Library cho component/logic chính (popup tùy chọn món, giỏ đơn, định dạng VND).
- **E2E (sau v1):** WebDriver/`tauri-driver` cho luồng bán hàng chính.

### 10.9 Chất lượng & tài liệu
- Lint/format bắt buộc xanh ở CI. `README.md` (setup/dev/build), `CONTRIBUTING.md` (quy trình), `AGENTS.md` (xem §12).

## 11. Cấu trúc thư mục dự án

```
HiGi-POS/
├─ AGENTS.md                  # context cho Codex (xem §12)
├─ README.md
├─ CONTRIBUTING.md
├─ .editorconfig
├─ .gitignore
├─ lefthook.yml               # pre-commit hooks
├─ .github/
│  ├─ workflows/{ci.yml, release.yml}
│  └─ pull_request_template.md
├─ docs/superpowers/specs/    # spec thiết kế (file này)
├─ package.json  vite.config.ts  tsconfig.json  tailwind.config.js
├─ index.html
├─ src/                       # React frontend
│  ├─ main.tsx  App.tsx
│  ├─ routes/                 # Sales, Tables, Menu, Shift, Reports, Settings
│  ├─ components/             # shadcn/ui + component dùng chung
│  ├─ lib/                    # api (invoke wrapper), format (VND/ngày), utils
│  ├─ store/                  # zustand (giỏ đơn, ca hiện tại…)
│  └─ styles/
└─ src-tauri/                 # Rust core
   ├─ src/
   │  ├─ main.rs  lib.rs
   │  ├─ db/                  # kết nối, migrations
   │  ├─ domain/              # struct + enum
   │  ├─ repo/                # truy vấn + transaction
   │  ├─ services/            # nghiệp vụ (tính tiền, đơn, ca)
   │  ├─ commands/            # tauri commands
   │  └─ printing/            # bill PDF (hook ESC/POS sau)
   ├─ migrations/
   ├─ Cargo.toml
   └─ tauri.conf.json
```

## 12. Bộ nhớ cho Codex — `AGENTS.md`

Tạo **`AGENTS.md`** ở gốc repo (định dạng Codex đọc tự nhiên), là **bộ nhớ sống** của dự án, gồm: mục tiêu app · stack & lý do · lệnh thường dùng (`pnpm dev`/`tauri dev`/`tauri build`/`cargo test`/`vitest`) · quy ước code (Rust + React/TS) · tóm tắt kiến trúc & mô hình dữ liệu · phạm vi & ràng buộc (offline, VND, tiếng Việt, không đăng nhập, không VAT) · quy trình git/CI-CD. Spec chi tiết tham chiếu tới file này. Cập nhật `AGENTS.md` mỗi khi có quyết định/quy ước mới.

## 13. Quyết định đã chốt (decision log)

| Hạng mục | Quyết định |
|---|---|
| Mục đích | POS bán hàng tại quầy |
| Quy mô | 1 máy, offline hoàn toàn, SQLite local |
| Stack | Tauri + React + TS + Tailwind + shadcn/ui; Rust làm lõi (Tauri commands) |
| Đơn | Tại bàn + mang đi, có sơ đồ bàn (chuyển/gộp) |
| Tùy chọn món | size + đường/đá + topping (topping có giá) |
| Thanh toán | Tiền mặt + QR/chuyển khoản, xác nhận thủ công (loa báo tiền) |
| Module v1 | Mở/đóng ca + đối soát, báo cáo doanh thu, khuyến mãi |
| Phần cứng | Tối ưu cảm ứng; chưa có máy in → xuất PDF, hook in nhiệt sau |
| Đăng nhập | Không (1 người dùng, không phân quyền) |
| VAT | Không tách thuế ở v1 |
| Git/CI | GitHub + GitHub Actions; **GitHub Flow**; release theo tag SemVer |

## 14. Rủi ro & lưu ý
- **Mất dữ liệu** (chỉ 1 máy, không cloud): bắt buộc có backup + nhắc backup khi đóng ca; roadmap thêm backup tự động.
- **Toolchain Rust** cần cài để build (một lần): tài liệu hoá trong README; CI dùng runner có sẵn.
- **Không ký installer** lúc đầu → Windows SmartScreen có thể cảnh báo: chấp nhận ở v1, chừa sẵn cấu hình ký.
- **Xác nhận QR thủ công** phụ thuộc loa báo tiền: chấp nhận theo thực tế vận hành quán.

## 15. Tiêu chí hoàn thành v1 (acceptance)
1. Cài đặt được trên máy Windows sạch từ installer; lần đầu tự tạo DB.
2. Mở ca → bán đơn tại bàn & mang đi với đầy đủ size/đường/đá/topping → thanh toán tiền mặt (tính tiền thối đúng) & QR → xuất bill PDF.
3. Chuyển/gộp bàn hoạt động; trạng thái bàn phản ánh đúng.
4. Áp khuyến mãi (đơn & món) tính tổng đúng.
5. Đóng ca → đối soát tiền ra chênh lệch đúng.
6. Báo cáo doanh thu/ca/món bán chạy đúng số liệu.
7. Sao lưu DB ra file thành công.
8. CI xanh (lint/format/typecheck/test Rust + frontend); tag `v*` build ra installer qua CD.
