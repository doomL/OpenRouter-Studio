import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import * as http from "http";
import * as https from "https";

let cachedClient: S3Client | null = null;

export function isStudioObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.STUDIO_S3_ENDPOINT &&
      process.env.STUDIO_S3_BUCKET &&
      process.env.STUDIO_S3_ACCESS_KEY &&
      process.env.STUDIO_S3_SECRET_KEY
  );
}

export function getStudioS3Client(): S3Client {
  if (cachedClient) return cachedClient;
  const endpoint = process.env.STUDIO_S3_ENDPOINT;
  const region = process.env.STUDIO_S3_REGION || "us-east-1";
  if (!endpoint) throw new Error("STUDIO_S3_ENDPOINT is not set");
  cachedClient = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: process.env.STUDIO_S3_ACCESS_KEY!,
      secretAccessKey: process.env.STUDIO_S3_SECRET_KEY!,
    },
    forcePathStyle: true,
    requestHandler: new NodeHttpHandler({
      httpAgent: new http.Agent({ maxSockets: Infinity }),
      httpsAgent: new https.Agent({ maxSockets: Infinity }),
    }),
  });
  return cachedClient;
}

export function getStudioS3Bucket(): string {
  const b = process.env.STUDIO_S3_BUCKET;
  if (!b) throw new Error("STUDIO_S3_BUCKET is not set");
  return b;
}

export async function studioPutObject(key: string, body: Buffer, contentType: string) {
  const client = getStudioS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getStudioS3Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function studioGetObjectStream(key: string) {
  const client = getStudioS3Client();
  const out = await client.send(
    new GetObjectCommand({
      Bucket: getStudioS3Bucket(),
      Key: key,
    })
  );
  return out;
}

export async function studioDeleteObject(key: string) {
  const client = getStudioS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getStudioS3Bucket(),
      Key: key,
    })
  );
}
