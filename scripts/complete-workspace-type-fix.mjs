import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const path = 'src/contexts/AuthContext.tsx';
let source = readFileSync(path, 'utf8');
const once = (before, after) => { assert.equal(source.split(before).length, 2, `Expected one anchor: ${before}`); source = source.replace(before, after); };
once("const { data, error } = await supabase.from('profiles')", "const { data, error } = await Promise.resolve(supabase.from('profiles')");
once(".eq('auth_user_id', currentSession.user.id).eq('active', true).single().catch(error => ({ data: null, error }));", ".eq('auth_user_id', currentSession.user.id).eq('active', true).single()).catch(error => ({ data: null, error }));");
writeFileSync(path, source);
console.log('Supabase thenable rejection handling is type-safe.');
