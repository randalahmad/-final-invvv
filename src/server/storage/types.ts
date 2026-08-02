/**
 * Provider-independent object storage contract.
 *
 * Binaries are NEVER stored in PostgreSQL and never on an ephemeral serverless
 * filesystem. Implementations must treat the key as opaque: knowing a key must
 * not grant access — authorization always happens before any read/URL is issued.
 */
export interface PutOptions {
  contentType: string;
  /** Hex SHA-256 of the body; providers may attach it as object metadata. */
  checksum?: string;
  /** Original file name, used for content-disposition on signed URLs. */
  fileName?: string;
}

export interface StoredObject {
  body: Buffer;
  contentType?: string;
  size?: number;
}

export interface SignedUrlOptions {
  expiresInSeconds: number;
  /** Suggested download file name (content-disposition). */
  fileName?: string;
}

export interface StorageProvider {
  /** Stable identifier for diagnostics/audit (never includes credentials). */
  readonly name: string;
  /** True when the provider can mint short-lived pre-signed URLs. */
  readonly supportsSignedUrls: boolean;

  put(key: string, body: Buffer, options: PutOptions): Promise<void>;
  get(key: string): Promise<StoredObject>;
  /** Physical removal — used for compensating cleanup and future retention jobs only. */
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Returns null when the provider cannot sign URLs (caller must stream instead). */
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string | null>;
}

export class StorageError extends Error {
  code: "NOT_FOUND" | "PUT_FAILED" | "GET_FAILED" | "DELETE_FAILED" | "NOT_CONFIGURED";
  constructor(code: StorageError["code"], message?: string) {
    super(message ?? code);
    this.name = "StorageError";
    this.code = code;
  }
}
