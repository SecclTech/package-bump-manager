export class GitHubApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GitHubApiError';
  }
}

export class FileSystemError extends Error {
  constructor(
    message: string,
    public path?: string,
    public operation?: string
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}

export class ConfigurationError extends Error {
  constructor(
    message: string,
    public missingKeys?: string[]
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function isGitHubError(error: unknown): error is { status: number } {
  return error != null &&
    typeof error === 'object' &&
    'status' in error;
}
