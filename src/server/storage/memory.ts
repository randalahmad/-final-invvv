import { StorageError, type PutOptions, type StorageProvider, type StoredObject } from "./types";

/**
 * In-memory object store for local development and tests only.
 *
 * It is never selected in production (see `index.ts`, which throws when no real
 * provider is configured). It cannot mint signed URLs, so callers fall back to
 * the authorized server-side streaming path.
 */
export class MemoryStorageProvider implements StorageProvider {
  readonly name = "memory";
  readonly supportsSignedUrls = false;
  private objects = new Map<string, { body: Buffer; contentType: string }>();

  async put(key: string, body: Buffer, options: PutOptions): Promise<void> {
    this.objects.set(key, { body: Buffer.from(body), contentType: options.contentType });
  }

  async get(key: string): Promise<StoredObject> {
    const found = this.objects.get(key);
    if (!found) throw new StorageError("NOT_FOUND", "object not found");
    return { body: found.body, contentType: found.contentType, size: found.body.length };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  async getSignedUrl(): Promise<string | null> {
    return null; // unsupported → caller streams through the authorized route
  }

  /** Test helper — not part of the StorageProvider contract. */
  reset(): void {
    this.objects.clear();
  }

  /** Test helper — number of stored objects. */
  size(): number {
    return this.objects.size;
  }
}
