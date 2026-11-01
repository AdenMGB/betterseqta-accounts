-- D1 (BS_SETTINGS): Cabra students opted into timetable classmates but with no relay share on D1
-- (phonebook only — extension has not successfully published encrypted timetable bundles).
--
-- Run: wrangler d1 execute BS_SETTINGS --remote --command "..."
-- Host is stored lowercase (see normalizeInstanceHost).

SELECT
  m.seqta_student_id,
  m.cloud_user_id,
  u.email,
  u.username,
  u.displayName,
  m.seqta_person_uuid,
  m.opted_in_at,
  m.last_seen_at,
  m.identity_binding_digest
FROM tq_membership AS m
INNER JOIN users AS u ON u.id = m.cloud_user_id
LEFT JOIN tq_relay_share AS r
  ON r.instance_host = m.instance_host
 AND r.seqta_student_id = m.seqta_student_id
WHERE m.instance_host = 'student.cabra.catholic.edu.au'
  AND m.revoked_at IS NULL
  AND r.instance_host IS NULL
ORDER BY m.opted_in_at DESC;

-- Summary counts for the same school:
SELECT
  COUNT(*) AS opted_in_active,
  SUM(CASE WHEN r.instance_host IS NULL THEN 1 ELSE 0 END) AS missing_relay_share,
  SUM(CASE WHEN r.instance_host IS NOT NULL THEN 1 ELSE 0 END) AS has_relay_share
FROM tq_membership AS m
LEFT JOIN tq_relay_share AS r
  ON r.instance_host = m.instance_host
 AND r.seqta_student_id = m.seqta_student_id
WHERE m.instance_host = 'student.cabra.catholic.edu.au'
  AND m.revoked_at IS NULL;

-- Opted in but share row exists with empty bundles (published but no class ciphertext):
SELECT
  m.seqta_student_id,
  u.email,
  u.username,
  r.updated_at,
  r.bundles_json
FROM tq_membership AS m
INNER JOIN users AS u ON u.id = m.cloud_user_id
INNER JOIN tq_relay_share AS r
  ON r.instance_host = m.instance_host
 AND r.seqta_student_id = m.seqta_student_id
WHERE m.instance_host = 'student.cabra.catholic.edu.au'
  AND m.revoked_at IS NULL
  AND (trim(r.bundles_json) = '[]' OR length(trim(r.bundles_json)) < 3)
ORDER BY r.updated_at ASC;
