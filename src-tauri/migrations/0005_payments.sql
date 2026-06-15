CREATE TABLE discounts (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('PERCENT','AMOUNT')),
  value      INTEGER NOT NULL,
  scope      TEXT NOT NULL CHECK (scope IN ('ORDER','ITEM')),
  is_active  INTEGER NOT NULL DEFAULT 1,
  valid_from TEXT,
  valid_to   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE order_discounts (
  id             INTEGER PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_id    INTEGER REFERENCES discounts(id),
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('PERCENT','AMOUNT')),
  value          INTEGER NOT NULL,
  amount_applied INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_order_discounts_order ON order_discounts(order_id);

CREATE TABLE payments (
  id         INTEGER PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method     TEXT NOT NULL CHECK (method IN ('CASH','QR')),
  amount     INTEGER NOT NULL,
  tendered   INTEGER,
  change_due INTEGER,
  paid_at    TEXT NOT NULL,
  ref_note   TEXT
);
CREATE INDEX idx_payments_order ON payments(order_id);
