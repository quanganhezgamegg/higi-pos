use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

/// Tập migrations của ứng dụng (thêm M::up mới ở CUỐI danh sách khi tiến hoá schema).
pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(include_str!("../../migrations/0001_init.sql"))])
}

/// Đưa CSDL về schema mới nhất.
pub fn run(conn: &mut Connection) -> Result<(), rusqlite_migration::Error> {
    migrations().to_latest(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_valid() {
        assert!(migrations().validate().is_ok());
    }
}
