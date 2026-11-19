-- migrate:up

CREATE INDEX idx_device_logs_latest
ON device_logs (device_id, timestamp DESC, created_at DESC);

-- migrate:down

