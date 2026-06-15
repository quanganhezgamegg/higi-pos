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

fn load_sizes(conn: &Connection, product_id: i64) -> rusqlite::Result<Vec<ProductSize>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, price_delta, is_default
         FROM product_sizes
         WHERE product_id=?1
         ORDER BY id",
    )?;
    let rows = stmt.query_map([product_id], |row| {
        Ok(ProductSize {
            id: row.get("id")?,
            name: row.get("name")?,
            price_delta: row.get("price_delta")?,
            is_default: row.get::<_, i64>("is_default")? != 0,
        })
    })?;
    rows.collect()
}

fn load_product(conn: &Connection, id: i64) -> rusqlite::Result<ProductWithSizes> {
    let mut product = conn.query_row(
        "SELECT id, category_id, name, base_price, description, image_path, is_active, sort_order
         FROM products
         WHERE id=?1",
        [id],
        |row| {
            Ok(ProductWithSizes {
                id: row.get("id")?,
                category_id: row.get("category_id")?,
                name: row.get("name")?,
                base_price: row.get("base_price")?,
                description: row.get("description")?,
                image_path: row.get("image_path")?,
                is_active: row.get::<_, i64>("is_active")? != 0,
                sort_order: row.get("sort_order")?,
                sizes: Vec::new(),
            })
        },
    )?;
    product.sizes = load_sizes(conn, id)?;
    Ok(product)
}

fn normalize_default(sizes: &mut [SizeInput]) {
    if sizes.is_empty() {
        return;
    }

    let default_index = sizes.iter().position(|size| size.is_default).unwrap_or(0);
    for (index, size) in sizes.iter_mut().enumerate() {
        size.is_default = index == default_index;
    }
}

fn insert_sizes(
    conn: &Connection,
    product_id: i64,
    mut sizes: Vec<SizeInput>,
) -> rusqlite::Result<()> {
    normalize_default(&mut sizes);

    for size in sizes {
        let name = size.name.trim();
        if name.is_empty() || size.price_delta < 0 {
            return Err(rusqlite::Error::InvalidParameterName(
                "size không hợp lệ".into(),
            ));
        }

        conn.execute(
            "INSERT INTO product_sizes(product_id, name, price_delta, is_default)
             VALUES (?1, ?2, ?3, ?4)",
            params![product_id, name, size.price_delta, size.is_default as i64],
        )?;
    }

    Ok(())
}

fn validate_product(conn: &Connection, input: &ProductInput) -> rusqlite::Result<()> {
    if input.name.trim().is_empty() || input.base_price < 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "name/base_price không hợp lệ".into(),
        ));
    }

    let category_exists: i64 = conn.query_row(
        "SELECT count(*) FROM categories WHERE id=?1",
        [input.category_id],
        |row| row.get(0),
    )?;
    if category_exists == 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "category_id không tồn tại".into(),
        ));
    }

    Ok(())
}

pub fn create_product(
    conn: &Connection,
    input: ProductInput,
) -> rusqlite::Result<ProductWithSizes> {
    validate_product(conn, &input)?;

    let ProductInput {
        name,
        category_id,
        base_price,
        description,
        image_path,
        sort_order,
        sizes,
    } = input;
    let name = name.trim().to_string();

    conn.execute_batch("BEGIN")?;
    let result = (|| {
        conn.execute(
            "INSERT INTO products(category_id, name, base_price, description, image_path, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![category_id, name, base_price, description, image_path, sort_order],
        )?;
        let id = conn.last_insert_rowid();
        insert_sizes(conn, id, sizes)?;
        Ok::<i64, rusqlite::Error>(id)
    })();

    match result {
        Ok(id) => {
            conn.execute_batch("COMMIT")?;
            load_product(conn, id)
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub fn update_product(
    conn: &Connection,
    id: i64,
    input: ProductInput,
) -> rusqlite::Result<ProductWithSizes> {
    validate_product(conn, &input)?;

    let ProductInput {
        name,
        category_id,
        base_price,
        description,
        image_path,
        sort_order,
        sizes,
    } = input;
    let name = name.trim().to_string();

    conn.execute_batch("BEGIN")?;
    let result = (|| {
        conn.execute(
            "UPDATE products
             SET category_id=?2, name=?3, base_price=?4, description=?5, image_path=?6, sort_order=?7
             WHERE id=?1",
            params![id, category_id, name, base_price, description, image_path, sort_order],
        )?;
        conn.execute("DELETE FROM product_sizes WHERE product_id=?1", [id])?;
        insert_sizes(conn, id, sizes)?;
        Ok::<(), rusqlite::Error>(())
    })();

    match result {
        Ok(()) => {
            conn.execute_batch("COMMIT")?;
            load_product(conn, id)
        }
        Err(error) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(error)
        }
    }
}

pub fn set_product_active(conn: &Connection, id: i64, is_active: bool) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE products SET is_active=?2 WHERE id=?1",
        params![id, is_active as i64],
    )?;
    Ok(())
}

pub fn delete_product(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM products WHERE id=?1", [id])?;
    Ok(())
}

pub fn list_products(
    conn: &Connection,
    category_id: Option<i64>,
    include_inactive: bool,
) -> rusqlite::Result<Vec<ProductWithSizes>> {
    let mut sql = String::from("SELECT id FROM products WHERE 1=1");
    if !include_inactive {
        sql.push_str(" AND is_active=1");
    }
    if category_id.is_some() {
        sql.push_str(" AND category_id=?1");
    }
    sql.push_str(" ORDER BY sort_order, id");

    let mut stmt = conn.prepare(&sql)?;
    let ids: Vec<i64> = if let Some(category_id) = category_id {
        let rows = stmt.query_map([category_id], |row| row.get(0))?;
        rows.collect::<rusqlite::Result<_>>()?
    } else {
        let rows = stmt.query_map([], |row| row.get(0))?;
        rows.collect::<rusqlite::Result<_>>()?
    };

    ids.into_iter().map(|id| load_product(conn, id)).collect()
}

pub fn delete_category(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    let product_count: i64 = conn.query_row(
        "SELECT count(*) FROM products WHERE category_id=?1",
        [id],
        |row| row.get(0),
    )?;
    if product_count > 0 {
        return Err(rusqlite::Error::InvalidParameterName(
            "Danh mục còn món — hãy vô hiệu hoá thay vì xoá".into(),
        ));
    }

    conn.execute("DELETE FROM categories WHERE id=?1", [id])?;
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
        c.execute("DELETE FROM product_sizes", []).unwrap();
        c.execute("DELETE FROM products", []).unwrap();
        c.execute("DELETE FROM toppings", []).unwrap();
        c.execute("DELETE FROM categories", []).unwrap();
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

    fn sample_input(category_id: i64) -> ProductInput {
        ProductInput {
            name: "Cà phê sữa".into(),
            category_id,
            base_price: 25000,
            description: Some("Đậm đà".into()),
            image_path: None,
            sort_order: 0,
            sizes: vec![
                SizeInput {
                    name: "S".into(),
                    price_delta: 0,
                    is_default: false,
                },
                SizeInput {
                    name: "L".into(),
                    price_delta: 6000,
                    is_default: false,
                },
            ],
        }
    }

    #[test]
    fn product_create_with_sizes_sets_one_default() {
        let c = conn();
        let category = create_category(&c, "Cà phê", 0).unwrap();
        let product = create_product(&c, sample_input(category.id)).unwrap();

        assert_eq!(product.sizes.len(), 2);
        assert_eq!(
            product.sizes.iter().filter(|size| size.is_default).count(),
            1
        );
        assert!(product.sizes[0].is_default);
    }

    #[test]
    fn product_update_replaces_sizes() {
        let c = conn();
        let category = create_category(&c, "Cà phê", 0).unwrap();
        let product = create_product(&c, sample_input(category.id)).unwrap();
        let mut input = sample_input(category.id);
        input.name = "Bạc xỉu".into();
        input.sizes = vec![SizeInput {
            name: "M".into(),
            price_delta: 3000,
            is_default: true,
        }];

        let updated = update_product(&c, product.id, input).unwrap();

        assert_eq!(updated.name, "Bạc xỉu");
        assert_eq!(updated.sizes.len(), 1);
        assert!(updated.sizes[0].is_default);
    }

    #[test]
    fn delete_product_cascades_sizes() {
        let c = conn();
        let category = create_category(&c, "Cà phê", 0).unwrap();
        let product = create_product(&c, sample_input(category.id)).unwrap();

        delete_product(&c, product.id).unwrap();

        let count: i64 = c
            .query_row(
                "SELECT count(*) FROM product_sizes WHERE product_id=?1",
                [product.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn delete_category_blocked_when_has_products() {
        let c = conn();
        let category = create_category(&c, "Cà phê", 0).unwrap();
        create_product(&c, sample_input(category.id)).unwrap();

        assert!(delete_category(&c, category.id).is_err());
    }
}
