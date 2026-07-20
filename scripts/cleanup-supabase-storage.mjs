import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required for storage admin operations.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function listAllFiles(prefix = '', token = null) {
  const { data, error } = await supabase.storage.from('songs').list(prefix, {
    limit: 200,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw new Error(`List failed: ${error.message}`);
  return data || [];
}

async function deleteFiles(paths) {
  const { data, error } = await supabase.storage.from('songs').remove(paths);
  if (error) throw new Error(`Delete failed: ${error.message}`);
  return data;
}

async function main() {
  console.log('Listing files in Supabase Storage bucket "songs"...\n');

  const files = await listAllFiles();
  
  if (files.length === 0) {
    console.log('Bucket is already empty. Nothing to clean up.');
    return;
  }

  console.log(`Found ${files.length} file(s):`);
  for (const f of files) {
    console.log(`  ${f.name}`);
  }
  console.log('');

  const confirm = process.argv.includes('--confirm');
  if (!confirm) {
    console.log('Dry run — no files deleted.');
    console.log('Re-run with --confirm to actually delete these files.');
    return;
  }

  const paths = files.map(f => f.name);
  const totalSize = files.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);

  console.log(`Deleting ${paths.length} file(s) (${(totalSize / 1024 / 1024).toFixed(1)} MB)...`);
  const result = await deleteFiles(paths);
  console.log(`Deleted ${result?.length || 0} file(s) successfully.`);
}

main().catch((err) => {
  console.error('Cleanup failed:', err.message);
  process.exit(1);
});
