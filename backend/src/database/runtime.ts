import { COLLECTIONS, SCHEMA_VERSION } from "./schema.js";

export function getDatabaseStatus(): {
  provider: "local_file" | "cloudbase_pending_adapter";
  status: "local_only" | "not_connected";
  schemaVersion: string;
  collectionCount: number;
  cloudEnvironment: "not_configured" | "configured_not_connected";
} {
  const hasCloudEnvironment = Boolean(process.env.CLOUD_ENV_ID?.trim());

  return {
    provider: hasCloudEnvironment ? "cloudbase_pending_adapter" : "local_file",
    status: hasCloudEnvironment ? "not_connected" : "local_only",
    schemaVersion: SCHEMA_VERSION,
    collectionCount: COLLECTIONS.length,
    cloudEnvironment: hasCloudEnvironment
      ? "configured_not_connected"
      : "not_configured",
  };
}
