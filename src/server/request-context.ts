export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

type HeaderReader = Pick<Headers, "get">;

/** Resolve proxy-provided client metadata at the server boundary. */
export function requestMetadataFromHeaders(headers: HeaderReader): RequestMetadata {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress =
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    forwarded ||
    null;

  return {
    ipAddress,
    userAgent: headers.get("user-agent")?.trim() || null,
  };
}
