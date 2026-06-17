-- Per-IP rate limit buckets
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    bucket_key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    window_start INTEGER NOT NULL
);
