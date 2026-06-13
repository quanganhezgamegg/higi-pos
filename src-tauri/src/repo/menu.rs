use crate::domain::menu::*;
use rusqlite::{params, Connection};

fn row_to_category(row: &rusqlite::Row) -> rusqlite::Result<Category> {
    Ok(Category {
        id: row.get("id")?,
        name: row.get("name")?,
        sort_order: row.get("sort_order")?,
        is_active: row.get::<_, i64>("is_active")? != 0,
    })
}

pub fn create_category(
    conn: &Connection,
    name: &str,
    sort_order: i64,
) -> rusqlite::Result<Category> {
    let name = name.trim();
    if name.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName("name rỗng".into()));
    }

    conn.execute(
        "INSERT INTO categories(name, sort_order) VALUES (?1, ?2)",
        params![name, sort_order],
    )?;

    let id = conn.last_insert_rowid();
    conn.query_row("SELECT * FROM categories WHERE id=?1", [id], row_to_category)
}

pub fn list_categories(
    conn: &Connection,
    include_inactive: bool,
) -> rusqlite::Result<Vec<Category>> {
    let sql = if include_inactive {
        "SELECT * FROM categories ORDER BY sort_order, id"
    } else {
        "SELECT * FROM categories WHERE is_active=1 ORDER BY sort_order, id"
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], row_to_category)?;
    rows.collect()
}

pub fn update_category(
    conn: &Connection,
    id: i64,
    name: &str,
    sort_order: i64,
    is_active: bool,
) -> rusqlite::Result<()> {
    let name = name.trim();
    if name.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName("name rỗng".into()));
    }

    conn.execute(
        "UPDATE categories SET name=?2, sort_order=?3, is_active=?4 WHERE id=?1",
        params![id, name, sort_order, is_active as i64],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;

    fn conn() -> Connection {
        let mut c = Connection::open_in_memory().unwrap();
        c.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrations::run(&mut c).unwrap();
        c
    }

    #[test]
    fn category_create_list_update() {
        let c = conn();
        let cat = create_category(&c, "Cà phê", 0).unwrap();
        assert_eq!(cat.name, "Cà phê");
        assert!(cat.is_active);

        let all = list_categories(&c, true).unwrap();
        assert_eq!(all.len(), 1);

        update_category(&c, cat.id, "Cafe", 5, false).unwrap();
        let one = list_categories(&c, true).unwrap().pop().unwrap();
        assert_eq!(one.name, "Cafe");
        assert_eq!(one.sort_order, 5);
        assert!(!one.is_active);

        assert_eq!(list_categories(&c, false).unwrap().len(), 0);
    }

    #[test]
    fn category_create_rejects_blank_name() {
        let c = conn();
        assert!(create_category(&c, "  ", 0).is_err());
    }
}
