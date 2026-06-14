use crate::domain::tables::*;
use rusqlite::{params, Connection};

fn row_to_area(row: &rusqlite::Row) -> rusqlite::Result<Area> {
    Ok(Area {
        id: row.get("id")?,
        name: row.get("name")?,
        sort_order: row.get("sort_order")?,
        is_active: row.get::<_, i64>("is_active")? != 0,
    })
}

pub fn create_area(conn: &Connection, name: &str, sort_order: i64) -> rusqlite::Result<Area> {
    let name = name.trim();
    if name.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName("name rỗng".into()));
    }

    conn.execute(
        "INSERT INTO areas(name, sort_order) VALUES (?1, ?2)",
        params![name, sort_order],
    )?;

    let id = conn.last_insert_rowid();
    conn.query_row("SELECT * FROM areas WHERE id=?1", [id], row_to_area)
}

pub fn list_areas(conn: &Connection, include_inactive: bool) -> rusqlite::Result<Vec<Area>> {
    let sql = if include_inactive {
        "SELECT * FROM areas ORDER BY sort_order, id"
    } else {
        "SELECT * FROM areas WHERE is_active=1 ORDER BY sort_order, id"
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], row_to_area)?;
    rows.collect()
}

pub fn update_area(
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
        "UPDATE areas SET name=?2, sort_order=?3, is_active=?4 WHERE id=?1",
        params![id, name, sort_order, is_active as i64],
    )?;
    Ok(())
}

pub fn delete_area(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    let table_count: i64 = conn.query_row(
        "SELECT count(*) FROM tables WHERE area_id=?1",
        [id],
        |row| row.get(0),
    )?;
    if table_count > 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Khu vực còn bàn — hãy xoá bàn trước hoặc vô hiệu hoá khu vực".into(),
        ));
    }

    conn.execute("DELETE FROM areas WHERE id=?1", [id])?;
    Ok(())
}

fn row_to_table(row: &rusqlite::Row) -> rusqlite::Result<Table> {
    Ok(Table {
        id: row.get("id")?,
        area_id: row.get("area_id")?,
        name: row.get("name")?,
        seats: row.get("seats")?,
        sort_order: row.get("sort_order")?,
        is_active: row.get::<_, i64>("is_active")? != 0,
    })
}

fn load_table(conn: &Connection, id: i64) -> rusqlite::Result<Table> {
    conn.query_row("SELECT * FROM tables WHERE id=?1", [id], row_to_table)
}

pub fn create_table(conn: &Connection, input: TableInput) -> rusqlite::Result<Table> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName("name rỗng".into()));
    }

    let area_exists: i64 = conn.query_row(
        "SELECT count(*) FROM areas WHERE id=?1",
        [input.area_id],
        |row| row.get(0),
    )?;
    if area_exists == 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "area_id không tồn tại".into(),
        ));
    }

    conn.execute(
        "INSERT INTO tables(area_id, name, seats, sort_order) VALUES (?1, ?2, ?3, ?4)",
        params![input.area_id, name, input.seats, input.sort_order],
    )?;

    load_table(conn, conn.last_insert_rowid())
}

pub fn list_tables(
    conn: &Connection,
    area_id: Option<i64>,
    include_inactive: bool,
) -> rusqlite::Result<Vec<Table>> {
    let mut sql = String::from("SELECT * FROM tables WHERE 1=1");
    if !include_inactive {
        sql.push_str(" AND is_active=1");
    }
    if area_id.is_some() {
        sql.push_str(" AND area_id=?1");
    }
    sql.push_str(" ORDER BY sort_order, id");

    let mut stmt = conn.prepare(&sql)?;
    if let Some(area_id) = area_id {
        let rows = stmt.query_map([area_id], row_to_table)?;
        rows.collect()
    } else {
        let rows = stmt.query_map([], row_to_table)?;
        rows.collect()
    }
}

pub fn update_table(conn: &Connection, id: i64, input: TableInput) -> rusqlite::Result<Table> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(rusqlite::Error::InvalidParameterName("name rỗng".into()));
    }

    conn.execute(
        "UPDATE tables SET area_id=?2, name=?3, seats=?4, sort_order=?5 WHERE id=?1",
        params![id, input.area_id, name, input.seats, input.sort_order],
    )?;

    load_table(conn, id)
}

pub fn set_table_active(conn: &Connection, id: i64, is_active: bool) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE tables SET is_active=?2 WHERE id=?1",
        params![id, is_active as i64],
    )?;
    Ok(())
}

pub fn delete_table(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM tables WHERE id=?1", [id])?;
    Ok(())
}

pub fn list_table_status(conn: &Connection) -> rusqlite::Result<Vec<TableStatus>> {
    let tables = list_tables(conn, None, true)?;
    Ok(tables
        .into_iter()
        .map(|table| TableStatus {
            table,
            status: TableState::Trong,
            open_order_id: None,
        })
        .collect())
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
    fn area_create_list_update() {
        let c = conn();
        let area = create_area(&c, "Tầng 1", 0).unwrap();
        assert_eq!(area.name, "Tầng 1");
        assert!(area.is_active);

        let all = list_areas(&c, true).unwrap();
        assert_eq!(all.len(), 1);

        update_area(&c, area.id, "Sảnh", 5, false).unwrap();
        let one = list_areas(&c, true).unwrap().pop().unwrap();
        assert_eq!(one.name, "Sảnh");
        assert_eq!(one.sort_order, 5);
        assert!(!one.is_active);

        assert_eq!(list_areas(&c, false).unwrap().len(), 0);
    }

    #[test]
    fn area_create_rejects_blank_name() {
        let c = conn();
        assert!(create_area(&c, "  ", 0).is_err());
    }

    fn seed_area(c: &Connection) -> Area {
        create_area(c, "Tầng 1", 0).unwrap()
    }

    #[test]
    fn table_create_list_update() {
        let c = conn();
        let area = seed_area(&c);
        let table = create_table(
            &c,
            TableInput {
                area_id: area.id,
                name: "B01".into(),
                seats: Some(4),
                sort_order: 0,
            },
        )
        .unwrap();
        assert_eq!(table.name, "B01");
        assert_eq!(table.seats, Some(4));
        assert!(table.is_active);

        let all = list_tables(&c, Some(area.id), true).unwrap();
        assert_eq!(all.len(), 1);

        let updated = update_table(
            &c,
            table.id,
            TableInput {
                area_id: area.id,
                name: "B01-VIP".into(),
                seats: Some(6),
                sort_order: 1,
            },
        )
        .unwrap();
        assert_eq!(updated.name, "B01-VIP");
        assert_eq!(updated.seats, Some(6));
    }

    #[test]
    fn table_set_active_and_delete() {
        let c = conn();
        let area = seed_area(&c);
        let table = create_table(
            &c,
            TableInput {
                area_id: area.id,
                name: "B02".into(),
                seats: None,
                sort_order: 0,
            },
        )
        .unwrap();

        set_table_active(&c, table.id, false).unwrap();
        assert_eq!(list_tables(&c, None, false).unwrap().len(), 0);
        assert_eq!(list_tables(&c, None, true).unwrap().len(), 1);

        delete_table(&c, table.id).unwrap();
        assert_eq!(list_tables(&c, None, true).unwrap().len(), 0);
    }

    #[test]
    fn delete_area_blocked_when_has_tables() {
        let c = conn();
        let area = seed_area(&c);
        create_table(
            &c,
            TableInput {
                area_id: area.id,
                name: "B03".into(),
                seats: None,
                sort_order: 0,
            },
        )
        .unwrap();

        assert!(delete_area(&c, area.id).is_err());
    }

    #[test]
    fn table_create_rejects_blank_name() {
        let c = conn();
        let area = seed_area(&c);
        assert!(create_table(
            &c,
            TableInput {
                area_id: area.id,
                name: "  ".into(),
                seats: None,
                sort_order: 0,
            },
        )
        .is_err());
    }

    #[test]
    fn list_table_status_returns_trong_in_m2() {
        let c = conn();
        let area = seed_area(&c);
        create_table(
            &c,
            TableInput {
                area_id: area.id,
                name: "B04".into(),
                seats: None,
                sort_order: 0,
            },
        )
        .unwrap();

        let statuses = list_table_status(&c).unwrap();
        assert_eq!(statuses.len(), 1);
        assert!(matches!(statuses[0].status, TableState::Trong));
        assert!(statuses[0].open_order_id.is_none());
    }
}
