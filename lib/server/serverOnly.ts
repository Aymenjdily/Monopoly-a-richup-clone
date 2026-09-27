/**
 * Functional equivalent of the `server-only` package. The real package breaks
 * Pages Router dev chunks (they classify it as a client package), so we implement
 * the same contract locally: importing this module marks the importing module as
 * server-exclusive and throws if it ever ends up in a browser bundle.
 */
 
declare const window: unknown | undefined;

if (typeof window !== "undefined") {
  throw new Error(
    "This module is for server use only (imported into a client bundle)."
  );
}

export {};
