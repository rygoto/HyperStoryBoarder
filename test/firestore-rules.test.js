import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('所有者向け包括writeでcreate/update検証を迂回しない', async () => {
  const rules = await readFile(
    new URL('../firestore.rules', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(
    rules,
    /allow\s+read\s*,\s*write\s*:\s*if\s+request\.auth/
  );
  assert.match(rules, /allow\s+create\s*:/);
  assert.match(rules, /allow\s+update\s*:/);
  assert.match(rules, /allow\s+delete\s*:/);
});
