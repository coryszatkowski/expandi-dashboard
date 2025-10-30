/**
 * Create/Update Admin User (custom)
 *
 * Usage:
 *   DATABASE_URL=postgres://... \
 *   JWT_SECRET=anything \
 *   node backend/create-admin-custom.js --email you@example.com --password yourPassword
 *
 * Notes:
 * - Works with PostgreSQL (DATABASE_URL starts with 'postgres') or SQLite dev.
 * - Upserts the admin by username (email).
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('./src/config/database');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '--email' || a === '-e') && args[i + 1]) {
      result.email = args[++i];
    } else if ((a === '--password' || a === '-p') && args[i + 1]) {
      result.password = args[++i];
    }
  }
  return result;
}

async function main() {
  const { email, password } = parseArgs();
  if (!email || !password) {
    console.error('Usage: node backend/create-admin-custom.js --email you@example.com --password yourPassword');
    process.exit(1);
  }

  const isPostgres = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres');

  try {
    const db = getDatabase();
    console.log(`🔧 Using ${isPostgres ? 'PostgreSQL' : 'SQLite'} database`);

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Ensure table exists (id, username, password_hash, created_at)
    if (isPostgres) {
      await db.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id UUID PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    } else {
      db.prepare(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();
    }

    // Upsert by username
    if (isPostgres) {
      // Ensure gen_random_uuid available; fall back to uuid_generate_v4 if needed
      try { await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto'); } catch (_) {}
      const upsert = `
        INSERT INTO admin_users (id, username, password_hash, created_at)
        VALUES (gen_random_uuid(), $1, $2, NOW())
        ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
      `;
      await db.query(upsert, [email, hash]);
    } else {
      const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(email);
      if (existing) {
        db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, existing.id);
      } else {
        db.prepare('INSERT INTO admin_users (id, username, password_hash) VALUES (?, ?, ?)').run(uuidv4(), email, hash);
      }
    }

    console.log('✅ Admin user created/updated');
    console.log(`   Username: ${email}`);
    console.log('   Password: (hidden)');
  } catch (err) {
    console.error('❌ Failed to create admin:', err.message);
    process.exit(1);
  }
}

main();


