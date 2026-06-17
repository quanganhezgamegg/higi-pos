# AGENTS.md — HiGi POS

Phần mềm POS bán hàng tại quầy cho một quán cà phê. Windows desktop, **offline**, 1 máy, dữ liệu SQLite local. Phát triển cùng Codex theo quy trình production (git + CI/CD).

## Tech stack (đã chốt & đang dùng)

- **Tauri 2** (Rust core) + **React 19** + **TypeScript** + **Vite 8**
- **Tailwind CSS v4** (`@tailwindcss/vite`, CSS-first — KHÔNG có `tailwind.config.js`; theme tokens nằm trong `src/index.css`) + **shadcn/ui** (base radix, preset Nova; component nằm trong `src/components/ui/`)
- **SQLite** qua **rusqlite** (feature `bundled`) + **rusqlite_migration** — Rust quản lý DB
- **React Router** (`react-router-dom`). Zustand + TanStack Query sẽ thêm khi cần (milestone sau).
- Test: **Vitest** + React Testing Library (FE); **`cargo test`** + in-memory SQLite (Rust).
- Chất lượng: ESLint (flat config từ scaffold Vite), Prettier, **lefthook** (pre-commit), **commitlint** (Conventional Commits).

## Kiến trúc (BẮT BUỘC tuân thủ)

- React chỉ làm UI. KHÔNG truy cập SQL trực tiếp.
- Mọi đọc/ghi qua **Tauri command** có kiểu (`src-tauri/src/commands/*`), gọi từ FE qua `src/lib/api/*` (dùng `invoke` từ `@tauri-apps/api/core`).
- Lõi: `commands/` → `repo/` (truy vấn rusqlite). `db/` mở SQLite + chạy migrations lúc `setup()`. DB ở `app_data_dir()/higipos.db` (bật WAL).
- Thêm migration: tạo `src-tauri/migrations/000N_*.sql` rồi thêm `M::up(include_str!(...))` vào CUỐI `migrations()` trong `src-tauri/src/db/migrations.rs`.
- Snapshot tên + giá vào dòng đơn để bill/báo cáo cũ không sai khi menu đổi (áp dụng ở các milestone bán hàng).

## Lệnh thường dùng

- `npm run dev` — Vite dev (:5173). `npx tauri dev` — app desktop (dev).
- `npx tauri build` — đóng gói installer .msi/.exe (vào `src-tauri/target/release/bundle`).
- `npm run test` — Vitest. `npm run lint` / `npm run format` / `npm run format:check`.
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `cargo fmt --manifest-path src-tauri/Cargo.toml`

## Ràng buộc sản phẩm

- Tiếng Việt; tiền VND không thập phân (`35.000 ₫`) — dùng `formatVnd` trong `src/lib/format.ts`.
- Tối ưu cảm ứng (nút to). KHÔNG đăng nhập/phân quyền ở v1. KHÔNG VAT ở v1.
- Thanh toán: tiền mặt + QR/chuyển khoản (xác nhận thủ công qua loa báo tiền). Chưa có máy in → bill PDF/màn hình; hook in nhiệt để sau.
- Chỉ chạy WebView2/Chromium trên Windows → Vite `build.target` = `chrome105`.

## Quy trình

- **GitHub Flow**: nhánh `feat/…|fix/…|chore/…` → PR → CI xanh → merge (squash). `main` luôn chạy được.
- **Conventional Commits** (bắt buộc qua commitlint). Pre-commit (lefthook): eslint --fix + prettier + cargo fmt.
- CI (`.github/workflows/ci.yml`): FE (lint, format:check, test, build) + Rust (fmt --check, clippy -D warnings, test).
- Release: tag `vX.Y.Z` → CD (`.github/workflows/release.yml`, tauri-action) build installer + tạo GitHub Release.

## Tài liệu

- Spec sản phẩm: `docs/superpowers/specs/2026-06-12-higi-pos-design.md`
- **UI Design Spec (chuẩn giao diện — BẮT BUỘC bám):** `docs/superpowers/specs/2026-06-16-ui-design-spec.md` + reference hình ảnh `docs/design/src/app/App.tsx` & `docs/design/src/styles/theme.css` (Figma Make, tông nâu cà phê).
- Hợp đồng migration/command dùng chung: `docs/superpowers/plans/2026-06-13-m2-m7-contract.md`
- Kế hoạch theo milestone (`docs/superpowers/plans/`):
  - M0 nền tảng & CI/CD · M1 menu · M2 bàn · M3 bán hàng lõi · M4 thanh toán/bill/KM · M5 ca & đối soát · M6 báo cáo · M7 cài đặt & backup — **đã xong (≤ v1.0.x)**
  - M8 màn hình khách + branding + VietQR offline — **đã xong**
  - M9 màn bán hàng kiểu POS365 (3-pane) — **đã xong (v1.1.2)**
  - **M9b** app shell (nav rail + header) + Dashboard KPI + fix chuỗi thiếu dấu: `2026-06-17-m9b-appshell-dashboard.md` — **TODO (làm trước)**
  - M10 kho & công thức: `2026-06-15-m10-inventory.md` — **TODO**
  - M11 khách hàng & tích điểm: `2026-06-15-m11-loyalty.md` — **TODO**

## Quy trình làm việc & bàn giao (Claude ↔ Codex)

- Dự án phát triển theo **milestone** (M0 → M11, xem `docs/superpowers/plans/`). Mỗi milestone: brainstorm → spec/plan → thực thi từng task (TDD) → PR → CI xanh → merge.
- Claude lo brainstorm/spec/**plan**; **Codex thực thi code + release**. Codex tiếp nối bằng cách đọc **file này** + `docs/superpowers/{specs,plans}` và tuân kiến trúc/quy trình ở trên.
- **Trạng thái hiện tại (cập nhật 2026-06-17):** đang ở **`v1.1.2`**. Đã xong & release M0–M9 (bán hàng/thanh toán/ca/báo cáo/cài đặt + M8 màn khách & VietQR + M9 sales UI 3-pane tông nâu cà phê, không VAT). Migrations đã có: `0001`–`0007`.
- **Việc tiếp theo cho Codex (theo thứ tự):** ① **M9b** — plan `docs/superpowers/plans/2026-06-17-m9b-appshell-dashboard.md` (app shell nav rail + header + Dashboard KPI + fix 3 chuỗi thiếu dấu; KHÔNG thêm command/migration); ② **M10** kho & công thức; ③ **M11** khách hàng & tích điểm. Sau mỗi milestone: PR → CI xanh → merge → bump version + tag release.
- **Git/credential:** `main` được branch-protected (bắt buộc PR + CI checks `frontend`/`rust`, cấm push thẳng). Để push, credential GitHub lưu **ngoài repo** (Git Credential Manager trên Windows) — KHÔNG bao giờ commit token/PAT vào repo.

## Cập nhật file này mỗi khi có quyết định/quy ước/cấu trúc mới.
