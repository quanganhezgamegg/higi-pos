use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

/// Tập migrations của ứng dụng (thêm M::up mới ở CUỐI danh sách khi tiến hoá schema).
pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("../../migrations/0001_init.sql")),
        M::up(include_str!("../../migrations/0002_menu.sql")),
        M::up(include_str!("../../migrations/0003_tables.sql")),
    ])
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

    #[test]
    fn migration_creates_menu_tables() {
        let mut c = rusqlite::Connection::open_in_memory().unwrap();
        run(&mut c).unwrap();

        for table in ["categories", "products", "product_sizes", "toppings"] {
            let count: i64 = c
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
                    [table],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 1, "missing table {table}");
        }
    }

    #[test]
    fn migration_creates_tables_tables() {
        let mut c = rusqlite::Connection::open_in_memory().unwrap();
        run(&mut c).unwrap();

        for table in ["areas", "tables"] {
            let count: i64 = c
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?1",
                    [table],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(count, 1, "missing table {table}");
        }

        let index_count: i64 = c
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='index' AND name='idx_tables_area'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(index_count, 1, "missing index idx_tables_area");
    }
}
