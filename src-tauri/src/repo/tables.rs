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
}
