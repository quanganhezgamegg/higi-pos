CREATE TABLE areas (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE tables (
  id         INTEGER PRIMARY KEY,
  area_id    INTEGER NOT NULL REFERENCES areas(id),
  name       TEXT NOT NULL,
  seats      INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_tables_area ON tables(area_id);
