export const PATHS = ["package.json", "package-lock.json"] as const;
export const LOCAL_PATH = "/tmp/";
export const BRANCH_PREFIX = "SECCL-";
export const GIT = {
  FILE_MODE: "100644" as const,
  BLOB_TYPE: "blob" as const,
  DEFAULT_FORCE: false,
} as const;
