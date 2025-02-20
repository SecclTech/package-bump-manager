import { Version } from "../src/version";

describe("Version Constructor", () => {
  it("should correctly parse valid version strings", () => {
    const version = new Version("1.2.3");
    expect(version.major).toBe(1);
    expect(version.minor).toBe(2);
    expect(version.patch).toBe(3);
  });

  it("should throw an error for invalid version format", () => {
    expect(() => new Version("1.2")).toThrow("Invalid version format. Version must be 'major.minor.patch'");
    expect(() => new Version("1.2.3.4")).toThrow("Invalid version format. Version must be 'major.minor.patch'");
  });

  it("should throw an error for non-numeric version parts", () => {
    expect(() => new Version("1.2.x")).toThrow("Invalid value in version: x");
    expect(() => new Version("1.a.3")).toThrow("Invalid value in version: a");
  });
});


describe('greaterThan', () => {
  it('should return true if the current version is greater than the given version (major)', () => {
    const version1 = new Version('2.0.0');
    const version2 = new Version('1.5.3');
    expect(version1.greaterThan(version2)).toBe(true);
  });

  it('should return true if the current version is greater than the given version (minor)', () => {
    const version1 = new Version('2.1.0');
    const version2 = new Version('2.0.5');
    expect(version1.greaterThan(version2)).toBe(true);
  });

  it('should return true if the current version is greater than the given version (patch)', () => {
    const version1 = new Version('2.0.6');
    const version2 = new Version('2.0.5');
    expect(version1.greaterThan(version2)).toBe(true);
  });

  it('should return false if the current version is less than the given version (major)', () => {
    const version1 = new Version('1.0.0');
    const version2 = new Version('2.0.0');
    expect(version1.greaterThan(version2)).toBe(false);
  });

  it('should return false if the current version is less than the given version (minor)', () => {
    const version1 = new Version('2.0.0');
    const version2 = new Version('2.1.0');
    expect(version1.greaterThan(version2)).toBe(false);
  });

  it('should return false if the current version is less than the given version (patch)', () => {
    const version1 = new Version('2.0.5');
    const version2 = new Version('2.0.6');
    expect(version1.greaterThan(version2)).toBe(false);
  });

  it('should return false if the current version is the same as the given version', () => {
    const version1 = new Version('2.0.5');
    const version2 = new Version('2.0.5');
    expect(version1.greaterThan(version2)).toBe(false);
  });

  it('should handle invalid version format correctly', () => {
    expect(() => new Version('1.2')).toThrowError('Invalid version format. Version must be \'major.minor.patch\'');
  });

  it('should throw an error if a part of the version is not a number', () => {
    expect(() => new Version('1.x.0')).toThrowError('Invalid value in version: x');
  });
});

