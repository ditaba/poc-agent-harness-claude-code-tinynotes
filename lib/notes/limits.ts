// No imports: the editor (browser) and validation (server) both use these limits (D18, D40).

export const TITLE_MAX_LENGTH = 200;
export const CONTENT_MAX_BYTES = 102_400;

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
