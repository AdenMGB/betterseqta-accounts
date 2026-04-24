import type { Env } from "./env";

export type RequestContext = {
  env: Env;
  request: Request;
  url: URL;
  jwtSecret: Uint8Array;
};
