declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
    [key: string]: unknown;
  };
}

declare interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

declare interface D1Database {
  prepare(query: string): unknown;
  dump(): Promise<ArrayBuffer>;
  batch(statements: unknown[]): Promise<unknown[]>;
  exec(query: string): Promise<unknown>;
}
