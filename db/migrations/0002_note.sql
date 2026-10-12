CREATE TABLE note (
  id          TEXT PRIMARY KEY NOT NULL,              -- crypto.randomUUID()
  user_id     TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 200),
  content     TEXT NOT NULL CHECK (json_valid(content) AND length(CAST(content AS BLOB)) <= 102400),  -- TipTap JSON (normalized), ≤ 102 400 UTF-8 bytes (D40)
  share_token TEXT UNIQUE,                            -- NULL = not shared
  created_at  INTEGER NOT NULL,                       -- Unix ms
  updated_at  INTEGER NOT NULL                        -- Unix ms; changes only on save
) STRICT;

CREATE INDEX note_user_updated_idx ON note (user_id, updated_at DESC);
