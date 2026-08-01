import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { UPLOAD_URL_TTL_SECONDS } from './media-limits';

/**
 * The only thing in the API that talks to object storage. Image bytes reach the
 * bucket from the browser and leave it to the browser; this service signs, reads
 * for the derivative worker, and deletes. MinIO locally and Cloudflare R2 in
 * production are the same S3 API, so nothing here branches on which.
 */
@Injectable()
export class MediaStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: AppConfig) {
    const storage = config.objectStorage;
    this.bucket = storage.bucket;
    this.publicBaseUrl = storage.publicBaseUrl.replace(/\/$/, '');
    this.client = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      forcePathStyle: storage.forcePathStyle,
      credentials: {
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      },
    });
  }

  /**
   * The signature covers the content type, so a URL issued for a JPEG cannot be
   * used to upload something else.
   */
  presignUpload(key: string, contentType: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) {
      throw new Error(`Object ${key} came back with no body.`);
    }
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    );
  }

  /** Where a browser reads the object from: a public bucket URL, not a signed one. */
  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
