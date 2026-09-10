/*
 * Migration 003
 * Adds authentication-related fields to the users table.
 *
 * password_hash remains nullable during migration so that the
 * pre-existing prototype user can be preserved without assigning
 * a known/default password.
 *
 * New users created through the authentication API will always
 * receive a securely hashed password.
 */

UPDATE users
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL;

ALTER TABLE users
ALTER COLUMN email SET NOT NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
NOT NULL DEFAULT CURRENT_TIMESTAMP;

/*
 * PostgreSQL's existing UNIQUE(email) constraint is case-sensitive.
 * Authentication treats e-mail addresses case-insensitively, so this
 * expression index prevents accounts such as:
 *
 * user@example.com
 * User@example.com
 *
 * being registered separately.
 */
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
ON users (LOWER(email));