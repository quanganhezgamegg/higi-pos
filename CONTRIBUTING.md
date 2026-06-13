# Đóng góp

- Mô hình nhánh: **GitHub Flow**. Mỗi việc một nhánh `feat/…`, `fix/…`, `chore/…` → PR vào `main`.
- Commit theo **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `ci:`).
- Trước khi mở PR: `npm run lint`, `npm run format:check`, `npm run test`, và `cargo test` / `cargo clippy -- -D warnings` phải xanh.
- PR chỉ merge khi **CI xanh**. Ưu tiên squash merge.
- Pre-commit hooks (lefthook) tự chạy eslint + prettier + cargo fmt; commit-msg chạy commitlint.
