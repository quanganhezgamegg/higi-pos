CREATE TABLE categories (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE products (
  id          INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name        TEXT NOT NULL,
  base_price  INTEGER NOT NULL,
  description TEXT,
  image_path  TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_products_category ON products(category_id);

CREATE TABLE product_sizes (
  id          INTEGER PRIMARY KEY,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0,
  is_default  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sizes_product ON product_sizes(product_id);

CREATE TABLE toppings (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  price      INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
