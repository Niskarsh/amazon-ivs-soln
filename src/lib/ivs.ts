// lib/ivs.ts
import { IvsClient } from "@aws-sdk/client-ivs";

export const ivs = new IvsClient({
  region: process.env.AWS_REGION,
  // In Lambda/Vercel the execution role supplies credentials automatically;
  // for local dev you can rely on ~/.aws/credentials or env vars.
});
