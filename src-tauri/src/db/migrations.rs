use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

/// Tập migrations của ứng dụng (thêm M::up mới ở CUỐI danh sách khi tiến hoá schema).
pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("../../migrations/0001_init.sql")),
        M::up(include_str!("../../migrations/0002_menu.sql")),
        M::up(include_str!("../../migrations/0003_tables.sql")),
        M::up(include_str!("../../migrations/0004_orders.sql")),
        M::up(include_str!("../../migrations/0005_payments.sql")),
        M::up(include_str!("../../migrations/0006_shifts.sql")),
        M::up(include_str!("../../migrations/0007_seed_higi_menu.sql")),
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

    #[test]
    fn migration_creates_order_tables() {
        let mut c = rusqlite::Connection::open_in_memory().unwrap();
        run(&mut c).unwrap();

        for table in ["orders", "order_items", "order_item_toppings"] {
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
                "SELECT count(*) FROM sqlite_master WHERE type='index' AND name='uq_orders_open_table'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(index_count, 1, "missing index uq_orders_open_table");
    }

    #[test]
    fn migration_creates_payment_tables() {
        let mut c = rusqlite::Connection::open_in_memory().unwrap();
        run(&mut c).unwrap();

        for table in ["discounts", "order_discounts", "payments"] {
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
    fn migration_creates_shifts_table() {
        let mut c = rusqlite::Connection::open_in_memory().unwrap();
        run(&mut c).unwrap();

        let table_count: i64 = c
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='shifts'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(table_count, 1, "missing table shifts");

        let index_count: i64 = c
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='index' AND name='uq_shifts_single_open'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(index_count, 1, "missing index uq_shifts_single_open");
    }

    #[test]
    fn migration_seeds_menu_from_higi_photo() {
        let mut c = rusqlite::Connection::open_in_memory().unwrap();
        run(&mut c).unwrap();

        let product_count: i64 = c
            .query_row("SELECT count(*) FROM products", [], |row| row.get(0))
            .unwrap();
        assert_eq!(product_count, 46);

        let topping_count: i64 = c
            .query_row("SELECT count(*) FROM toppings", [], |row| row.get(0))
            .unwrap();
        assert_eq!(topping_count, 2);
    }
}
