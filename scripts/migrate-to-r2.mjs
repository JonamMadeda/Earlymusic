import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const required = (name) => {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env: ${name}`);
  return val;
};

const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const R2_ACCOUNT_ID = required('R2ACCOUNTID');
const R2_ACCESS_KEY = required('R2ACCESSKEYID');
const R2_SECRET_KEY = required('R2SECRETACCESSKEY');
const R2_BUCKET = required('R2BUCKETNAME');
const R2_PUBLIC_URL = required('R2PUBLICURL').replace(/\/$/, '');

// Use service role key if available (for write operations), otherwise fall back to anon
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

async function downloadFile(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function uploadToR2(buffer, key, contentType) {
  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'audio/mpeg',
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

async function main() {
  // Fetch songs that still use Supabase Storage (relative path in song_path)
  const { data: songs, error } = await supabase
    .from('songs')
    .select('id, title, song_path')
    .not('song_path', 'like', 'http%');

  if (error) {
    console.error('Failed to fetch songs:', error.message);
    process.exit(1);
  }

  if (!songs || songs.length === 0) {
    console.log('No songs need migration. All songs already use R2 URLs.');
    return;
  }

  console.log(`Found ${songs.length} song(s) to migrate:\n`);

  let migrated = 0;
  let failed = 0;

  for (const song of songs) {
    const { id, title, song_path: relativePath } = song;
    console.log(`[${id}] "${title}" — ${relativePath}`);

    try {
      // Get the public Supabase Storage URL
      const { data: urlData } = supabase.storage.from('songs').getPublicUrl(relativePath);
      const downloadUrl = urlData?.publicUrl;
      if (!downloadUrl) throw new Error('Could not generate public URL');

      // Download the file
      const buffer = await downloadFile(downloadUrl);
      const ext = relativePath.match(/\.[a-z0-9]+$/i)?.[0] || '.mp3';
      const r2Key = `audio/migrated-${id}-${Date.now()}${ext}`;

      // Upload to R2
      const r2Url = await uploadToR2(buffer, r2Key, 'audio/mpeg');
      console.log(`  -> Uploaded to R2: ${r2Url}`);

      // Update the database
      const { error: updateError } = await supabase
        .from('songs')
        .update({ song_path: r2Url })
        .eq('id', id);

      if (updateError) throw new Error(`DB update failed: ${updateError.message}`);
      console.log(`  -> Database updated OK`);
      migrated++;
    } catch (err) {
      console.error(`  -> FAILED: ${err.message}`);
      failed++;
    }
    console.log('');
  }

  console.log('=== Migration complete ===');
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Failed:   ${failed}`);
}

main().catch((err) => {
  console.error('Migration aborted:', err.message);
  process.exit(1);
});
