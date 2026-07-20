import { S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.R2ACCOUNTID;
const accessKeyId = process.env.R2ACCESSKEYID;
const secretAccessKey = process.env.R2SECRETACCESSKEY;

if (!accountId || !accessKeyId || !secretAccessKey) {
  throw new Error("Cloudflare R2 environment variables are not configured.");
}

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});
