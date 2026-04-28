/** Same-origin URL that returns blob bytes for the signed-in user. */
export function studioBlobFetchUrl(blobId: string): string {
  return `/api/studio/blobs/${encodeURIComponent(blobId)}`;
}

export function pickInlineOrBlobUrl(
  inline: string | undefined,
  blobId: string | undefined
): string | undefined {
  if (typeof inline === "string" && inline.length > 0) return inline;
  if (typeof blobId === "string" && blobId.length > 0) return studioBlobFetchUrl(blobId);
  return undefined;
}
