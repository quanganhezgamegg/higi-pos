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
    conn.query_row(
        "SELECT * FROM categories WHERE id=?1",
        [id],
        row_to_category,
    )
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

fn row_to_topping(row: &rusqlite::Row) -> rusqlite::Result<Topping> {
    Ok(Topping {
        id: row.get("id")?,
        name: row.get("name")?,
        price: row.get("price")?,
        is_active: row.get::<_, i64>("is_active")? != 0,
        sort_order: row.get("sort_order")?,
    })
}

pub fn create_topping(
    conn: &Connection,
    name: &str,
    price: i64,
    sort_order: i64,
) -> rusqlite::Result<Topping> {
    let name = name.trim();
    if name.is_empty() || price < 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "name/price không hợp lệ".into(),
        ));
    }

    conn.execute(
        "INSERT INTO toppings(name, price, sort_order) VALUES (?1, ?2, ?3)",
        params![name, price, sort_order],
    )?;

    conn.query_row(
        "SELECT * FROM toppings WHERE id=?1",
        [conn.last_insert_rowid()],
        row_to_topping,
    )
}

pub fn list_toppings(conn: &Connection, include_inactive: bool) -> rusqlite::Result<Vec<Topping>> {
    let sql = if include_inactive {
        "SELECT * FROM toppings ORDER BY sort_order, id"
    } else {
        "SELECT * FROM toppings WHERE is_active=1 ORDER BY sort_order, id"
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], row_to_topping)?;
    rows.collect()
}

pub fn update_topping(
    conn: &Connection,
    id: i64,
    name: &str,
    price: i64,
    sort_order: i64,
    is_active: bool,
) -> rusqlite::Result<()> {
    let name = name.trim();
    if name.is_empty() || price < 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "name/price không hợp lệ".into(),
        ));
    }

    conn.execute(
        "UPDATE toppings SET name=?2, price=?3, sort_order=?4, is_active=?5 WHERE id=?1",
        params![id, name, price, sort_order, is_active as i64],
    )?;
    Ok(())
}

pub fn delete_topping(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM toppings WHERE id=?1", [id])?;
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

    #[test]
    fn topping_crud() {
        let c = conn();
        let topping = create_topping(&c, "Trân châu", 5000, 0).unwrap();
        assert_eq!(topping.price, 5000);

        update_topping(&c, topping.id, "Trân châu đen", 6000, 1, true).unwrap();
        let got = list_toppings(&c, true).unwrap().pop().unwrap();
        assert_eq!(got.name, "Trân châu đen");
        assert_eq!(got.price, 6000);

        delete_topping(&c, topping.id).unwrap();
        assert_eq!(list_toppings(&c, true).unwrap().len(), 0);
    }
}
