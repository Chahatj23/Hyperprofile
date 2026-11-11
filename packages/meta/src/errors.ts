export type ErrorKind = "rate" | "token" | "window" | "transient" | "permission" | "fatal";

/**
 * Meta Graph error. Classify on error CODE / subcode — Meta throttles with HTTP 400, never 429.
 * Ported from reference/ig-autodm.
 */
export class MetaError extends Error {
  constructor(
    public status: number,
    public code?: number,
    public subcode?: number,
    public fbtrace?: string,
    message?: string,
  ) {
    super(message ?? `Meta API error ${status}/${code}/${subcode}`);
    this.name = "MetaError";
  }

  get kind(): ErrorKind {
    if ([4, 17, 32, 613].includes(this.code ?? -1)) return "rate";
    if (this.code === 190 || this.code === 102) return "token";
    if (this.code === 10 && this.subcode === 2534022) return "window";
    if ([1, 2].includes(this.code ?? -1) || this.status >= 500 || this.status === 599) {
      return "transient";
    }
    if (this.code === 10 || (this.code !== undefined && this.code >= 200 && this.code < 300)) {
      return "permission";
    }
    return "fatal";
  }
}

export function classifyMetaError(
  status: number,
  code?: number,
  subcode?: number,
): ErrorKind {
  return new MetaError(status, code, subcode).kind;
}
