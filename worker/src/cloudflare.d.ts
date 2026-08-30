/**
 * Just enough of the Workers runtime to typecheck this one file.
 *
 * `@cloudflare/workers-types` is the real answer, but it is a dependency the
 * app itself would carry for code the app never runs. Two members of one
 * interface is a cheaper honest description than a package.
 */

interface R2Object {
  body: ReadableStream;
  httpEtag: string;
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
}
