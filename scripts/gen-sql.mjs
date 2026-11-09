// Membuat file SQL statis dari pembuat skrip yang sama dengan aplikasi.
// Pakai:  npm run sql                       -> supabase/setup.sql (awalan "mo_")
//         npm run sql -- --prefix=sd2_      -> awalan lain
//         npm run sql -- --prefix= --out=x.sql
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildSupabaseSql } from '../src/lib/sqlScript.ts';

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const out = arg('out', 'supabase/setup.sql');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buildSupabaseSql({ tablePrefix: arg('prefix', 'mo_'), projectName: arg('name', 'Meja Operator') }));
console.log('Ditulis:', out);
