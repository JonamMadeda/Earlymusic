import { S3Client } from "@aws-sdk/client-s3";

let cachedClient: S3Client | null = null;

export const getR2Client = () => {
  if (cachedClient) return cachedClient;

  const accountId = process.env.R2ACCOUNTID;
  const accessKeyId = process.env.R2ACCESSKEYID;
  const secretAccessKey = process.env.R2SECRETACCESSKEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Cloudflare R2 environment variables are not configured.");
  }

  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedClient;
};

export const r2Client = getR2Client;
