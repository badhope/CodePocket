import { put, del, list, head, type PutBlobResult } from "@vercel/blob";

export type UploadInput = {
  pathname: string;
  body: string | Buffer | ReadableStream<Uint8Array>;
  contentType?: string;
  cacheControlTtl?: number;
  addRandomSuffix?: boolean;
};

export async function uploadBlob(input: UploadInput): Promise<PutBlobResult> {
  return put(input.pathname, input.body, {
    access: "public",
    contentType: input.contentType,
    cacheControlMaxAge: input.cacheControlTtl ?? 60 * 60 * 24 * 365,
    addRandomSuffix: input.addRandomSuffix ?? false,
  });
}

export async function deleteBlob(url: string): Promise<void> {
  await del(url);
}

export async function blobMetadata(url: string) {
  return head(url);
}

export async function listBlobs(prefix?: string) {
  return list({ prefix });
}
