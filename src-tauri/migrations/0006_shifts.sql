CREATE TABLE shifts (
  id                   INTEGER PRIMARY KEY,
  opened_at            TEXT NOT NULL,
  closed_at            TEXT,
  opening_cash         INTEGER NOT NULL DEFAULT 0,
  expected_cash        INTEGER,
  closing_cash_counted INTEGER,
  cash_diff            INTEGER,
  total_sales          INTEGER,
  status               TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  note                 TEXT
);
CREATE UNIQUE INDEX uq_shifts_single_open ON shifts(status) WHERE status = 'OPEN';
