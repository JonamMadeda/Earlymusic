-- Clear the placeholder display names that /api/auth/register used to
-- synthesise from the email's local part (e.g. "jtee8275"). The homepage
-- greeting and the account screen treat a name as present only when the user
-- actually supplied one, so these rows need the placeholder removed.
-- Real names ("Bethwel Kipronoh") are untouched.

UPDATE neon_auth.user
   SET name = '', "updatedAt" = now()
 WHERE btrim(COALESCE(name, '')) <> ''
   AND name NOT LIKE '% %'
   AND lower(btrim(name)) = split_part(lower(email), '@', 1);
