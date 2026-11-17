import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const migrationsDir = path.resolve(process.cwd(), 'sql');
const migrationFiles = (await readdir(migrationsDir))
  .filter((name) => /^2026_.*\.sql$/.test(name))
  .sort();

test('versioned SQL migrations have balanced dollar-quoted blocks', async () => {
  assert.ok(migrationFiles.length > 0, 'expected versioned SQL migrations');

  for (const fileName of migrationFiles) {
    const sql = await readFile(path.join(migrationsDir, fileName), 'utf8');
    const delimiters = sql.match(/\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/g) ?? [];
    const counts = new Map<string, number>();

    for (const delimiter of delimiters) {
      counts.set(delimiter, (counts.get(delimiter) ?? 0) + 1);
    }

    for (const [delimiter, count] of counts) {
      assert.equal(
        count % 2,
        0,
        `${fileName} has an unmatched ${delimiter} delimiter`,
      );
    }

    const withoutStringsAndComments = sql
      .replace(/'(?:''|[^'])*'/g, "''")
      .replace(/--[^\n]*/g, '');
    assert.doesNotMatch(
      withoutStringsAndComments,
      /(?<![A-Za-z0-9_$])\$(?![A-Za-z0-9_$])/,
      `${fileName} contains a bare dollar sign instead of a dollar-quote delimiter`,
    );
  }
});

test('POS mapping audit trigger is validly dollar-quoted and attached', async () => {
  const sql = await readFile(
    path.join(migrationsDir, '2026_11_22_pos_catalog_menu_mapping.sql'),
    'utf8',
  );

  assert.match(
    sql,
    /create or replace function public\.log_pos_catalog_menu_link_change\(\)[\s\S]*?set search_path = public\s+as \$\$[\s\S]*?\n\$\$;/i,
  );
  assert.match(
    sql,
    /create trigger pos_catalog_menu_link_audit\s+after insert or update on public\.pos_catalog_menu_links\s+for each row execute function public\.log_pos_catalog_menu_link_change\(\)/i,
  );
  assert.doesNotMatch(
    sql,
    /\b(?:insert\s+into|update|delete\s+from)\s+public\.menu_items\b/i,
    'mapping approval must not mutate the live SooVoice menu',
  );
});
