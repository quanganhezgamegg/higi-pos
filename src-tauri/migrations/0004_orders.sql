CREATE TABLE orders (
  id             INTEGER PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  order_type     TEXT NOT NULL CHECK (order_type IN ('DINE_IN','TAKEAWAY')),
  table_id       INTEGER REFERENCES tables(id),
  shift_id       INTEGER,
  status         TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PAID','CANCELLED')),
  subtotal       INTEGER NOT NULL DEFAULT 0,
  discount_total INTEGER NOT NULL DEFAULT 0,
  total          INTEGER NOT NULL DEFAULT 0,
  note           TEXT,
  created_at     TEXT NOT NULL,
  paid_at        TEXT
);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_shift ON orders(shift_id);
CREATE UNIQUE INDEX uq_orders_open_table
  ON orders(table_id) WHERE status = 'OPEN' AND table_id IS NOT NULL;

CREATE TABLE order_items (
  id            INTEGER PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    INTEGER REFERENCES products(id),
  product_name  TEXT NOT NULL,
  size_name     TEXT,
  unit_price    INTEGER NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  sugar_level   TEXT,
  ice_level     TEXT,
  line_note     TEXT,
  line_discount INTEGER NOT NULL DEFAULT 0,
  line_total    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_items_order ON order_items(order_id);

CREATE TABLE order_item_toppings (
  id            INTEGER PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  topping_id    INTEGER REFERENCES toppings(id),
  topping_name  TEXT NOT NULL,
  price         INTEGER NOT NULL DEFAULT 0,
  quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
);
CREATE INDEX idx_item_toppings_item ON order_item_toppings(order_item_id);
