export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface PutObjectInput {
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
}

export interface StoredObject {
  key: string;
  url: string;
}

export interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<StoredObject>;
  deleteObject(key: string): Promise<void>;
  getPublicUrl(key: string): string;
  headObject(key: string): Promise<{ lastModified: Date } | null>;
  listObjects(
    prefix: string,
    cursor?: string,
  ): Promise<{
    objects: Array<{ key: string; lastModified: Date }>;
    cursor?: string;
  }>;
}
