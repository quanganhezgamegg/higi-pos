# HiGi POS

Phần mềm bán hàng (POS) cho quán cà phê — Windows desktop, offline, dữ liệu SQLite local.

## Yêu cầu

- Node.js LTS (≥ 20), Rust stable (`rustup`), Microsoft C++ Build Tools (MSVC), WebView2 Runtime.

## Phát triển

```bash
npm install
npx tauri dev      # mở app desktop (dev)
```

## Build installer

```bash
npx tauri build    # tạo .msi/.exe trong src-tauri/target/release/bundle
```

## Test

```bash
npm run test                                     # frontend (Vitest)
cargo test --manifest-path src-tauri/Cargo.toml  # rust
```

Xem `AGENTS.md` để biết kiến trúc & quy ước; `docs/superpowers/` để biết spec & kế hoạch theo milestone.
