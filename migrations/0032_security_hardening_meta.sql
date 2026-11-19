-- SMTP API keys belong in Worker secrets, not D1.
DELETE FROM system_meta WHERE key = 'integration_smtp2go_api_key';