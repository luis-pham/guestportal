import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadR2Config, type R2StorageConfig } from './config.js';
import { DEFAULT_CACHE_CONTROL } from './constraints.js';
import { buildPublicUrl } from './keys.js';

export type PresignPutInput = {
  objectKey: string;
  contentType: string;
  contentLength?: number;
  cacheControl?: string;
  expiresInSeconds?: number;
};

export type PresignPutResult = {
  method: 'PUT';
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
  publicUrl: string;
};

export type ObjectHeadResult = {
  contentType: string | undefined;
  contentLength: number | undefined;
  cacheControl: string | undefined;
  etag: string | undefined;
};

export class R2Storage {
  readonly config: R2StorageConfig;
  private readonly client: S3Client;

  constructor(config: R2StorageConfig = loadR2Config()) {
    this.config = config;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async createPresignedPut(input: PresignPutInput): Promise<PresignPutResult> {
    const cacheControl = input.cacheControl ?? DEFAULT_CACHE_CONTROL;
    const expiresIn = input.expiresInSeconds ?? 900;
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
      CacheControl: cacheControl,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return {
      method: 'PUT',
      uploadUrl,
      requiredHeaders: {
        'Content-Type': input.contentType,
        'Cache-Control': cacheControl,
      },
      expiresAt,
      publicUrl: buildPublicUrl(this.config.publicBaseUrl, input.objectKey),
    };
  }

  /** Ensure browser admin origins can PUT/GET via presigned URLs (REAL_STAGING / local admin). */
  async ensureBrowserCors(origins: string[] = [
    'http://localhost:3101',
    'http://127.0.0.1:3101',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]): Promise<void> {
    await this.client.send(
      new PutBucketCorsCommand({
        Bucket: this.config.bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: origins,
              AllowedMethods: ['GET', 'PUT', 'HEAD'],
              AllowedHeaders: ['*'],
              ExposeHeaders: ['ETag', 'Content-Type', 'Cache-Control', 'Content-Length'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
  }

  async putObject(input: {
    objectKey: string;
    body: Buffer | Uint8Array | string;
    contentType: string;
    cacheControl?: string;
  }): Promise<{ publicUrl: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.objectKey,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl ?? DEFAULT_CACHE_CONTROL,
      }),
    );
    return { publicUrl: buildPublicUrl(this.config.publicBaseUrl, input.objectKey) };
  }

  async headObject(objectKey: string): Promise<ObjectHeadResult | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.config.bucket,
          Key: objectKey,
        }),
      );
      return {
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        cacheControl: result.CacheControl,
        etag: result.ETag,
      };
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode;
      if (name === 'NotFound' || name === 'NoSuchKey' || status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getObjectBytes(objectKey: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.config.bucket,
          Key: objectKey,
        }),
      );
      if (!result.Body) return null;
      const bytes = await result.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode;
      if (name === 'NoSuchKey' || name === 'NotFound' || status === 404) {
        return null;
      }
      throw error;
    }
  }

  async createPresignedGet(objectKey: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
      }),
    );
  }

  publicUrlFor(objectKey: string): string {
    return buildPublicUrl(this.config.publicBaseUrl, objectKey);
  }
}

export function createR2Storage(source?: NodeJS.ProcessEnv): R2Storage {
  return new R2Storage(loadR2Config(source ?? process.env));
}
