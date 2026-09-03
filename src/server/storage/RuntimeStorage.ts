import type { StoragePort } from "./StoragePort";
import { fileStorage } from "./FileStorage";
import { postgresStorage } from "./PostgresStorage";

/** Author: Karthikeya. The selector makes persistence explicit and testable. */
export const runtimeStorage: StoragePort = process.env.AEGISKEY_STORAGE === "file" || !process.env.DATABASE_URL
  ? fileStorage
  : postgresStorage;
