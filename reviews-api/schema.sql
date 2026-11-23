CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL UNIQUE,
  reviewer TEXT NOT NULL CHECK (length(reviewer) BETWEEN 1 AND 60),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL CHECK (length(comment) BETWEEN 1 AND 600)
);
