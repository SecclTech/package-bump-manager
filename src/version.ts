export class Version {
  major: number;
  minor: number;
  patch: number;

  constructor(version: string) {
    version = version.replace("^", "");
    const parts = version.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid version format. Version must be 'major.minor.patch'");
    }
    const [major, minor, patch] = parts.map(part => {
      const parsed = parseInt(part);
      if (isNaN(parsed)) {
        throw new Error(`Invalid value in version: ${part}`);
      }
      return parsed;
    });
    this.major = major;
    this.minor = minor;
    this.patch = patch;
  }

  greaterThan(other: Version): boolean {
    if (this.major > other.major) {
      return true;
    }
    if (this.major === other.major && this.minor > other.minor) {
      return true;
    }
    if (this.major === other.major && this.minor === other.minor && this.patch > other.patch) {
      return true;
    }
    return false;
  }
}
