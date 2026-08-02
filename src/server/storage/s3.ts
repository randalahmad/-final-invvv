import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";

import { StorageError, type PutOptions, type SignedUrlOptions, type StorageProvider, type StoredObject } from "./types";

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
}

/**
 * S3-compatible provider. Works unchanged against AWS S3, Cloudflare R2 and
 * MinIO (set `endpoint` + `forcePathStyle` for R2/MinIO). Credentials come from
 * the environment and are never logged or returned to the client.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  readonly supportsSignedUrls = true;
  private client: S3Client;
  private bucket: string;

  constructor(config: S3Config) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      forcePathStyle: config.forcePathStyle,
      ...(config.accessKeyId && config.secretAccessKey
        ? { credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey } }
        : {}), // otherwise fall back to the ambient provider chain (IAM role, etc.)
    });
  }

  async put(key: string, body: Buffer, options: PutOptions): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: options.contentType,
          ...(options.checksum ? { Metadata: { "sha256-hex": options.checksum } } : {}),
        }),
      );
    } catch (e) {
      throw new StorageError("PUT_FAILED", (e as Error).message);
    }
  }

  async get(key: string): Promise<StoredObject> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) throw new StorageError("GET_FAILED", "empty body");
      return { body: Buffer.from(bytes), contentType: res.ContentType, size: res.ContentLength };
    } catch (e) {
      if (e instanceof StorageError) throw e;
      const name = (e as { name?: string }).name;
      if (name === "NoSuchKey" || name === "NotFound") throw new StorageError("NOT_FOUND", "object not found");
      throw new StorageError("GET_FAILED", (e as Error).message);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (e) {
      throw new StorageError("DELETE_FAILED", (e as Error).message);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string, options: SignedUrlOptions): Promise<string | null> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(options.fileName
        ? { ResponseContentDisposition: `attachment; filename="${encodeURIComponent(options.fileName)}"` }
        : {}),
    });
    return presign(this.client, command, { expiresIn: options.expiresInSeconds });
  }
}

export function createS3Storage(config: S3Config): StorageProvider {
  return new S3StorageProvider(config);
}
