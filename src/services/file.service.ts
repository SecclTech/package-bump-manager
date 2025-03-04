import { readFile, writeFile } from 'fs/promises'
import { Octokit } from '@octokit/rest'
import { LOCAL_PATH, PATHS } from '../config/constants.js'
import { FileSystemError, GitHubApiError } from '../utils/error.js'
import type { RepoParams } from '../types/github.js'

export async function downloadRepositoryFiles(
  octokit: Octokit,
  { owner, repo, branch }: RepoParams & { branch: string }
): Promise<void> {
  try {
    const responses = await Promise.all(
      PATHS.map(path =>
        octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: branch,
        })
      )
    );

    await Promise.all(
      responses.map(async ({ data }) => {
        if (!("content" in data)) {
          throw new GitHubApiError(
            500,
            'Invalid content response from GitHub',
            { owner, repo, branch }
          );
        }

        const filePath = getLocalPath(data.name);
        const content = Buffer.from(data.content, "base64");

        try {
          await writeFile(filePath, content);
        } catch (error) {
          throw new FileSystemError(
            `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
            filePath,
            'write'
          );
        }
      })
    );
  } catch (error) {
    if (error instanceof FileSystemError || error instanceof GitHubApiError) {
      throw error;
    }
    throw new GitHubApiError(
      500,
      `Failed to download repository files: ${error instanceof Error ? error.message : String(error)}`,
      { owner, repo, branch }
    );
  }
}


export async function readLocalFiles(): Promise<Array<{ path: string; contents: string }>> {
  try {
    return await Promise.all(
      PATHS.map(async (path) => {
        const localPath = getLocalPath(path);
        try {
          const content = await readFile(localPath);
          return {
            path,
            contents: content.toString("base64"),
          };
        } catch (error) {
          throw new FileSystemError(
            `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
            localPath,
            'read'
          );
        }
      })
    );
  } catch (error) {
    if (error instanceof FileSystemError) {
      throw error;
    }
    throw new FileSystemError(
      `Failed to read local files: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}


function getLocalPath(fileName: string): string {
  return `${LOCAL_PATH}${fileName}`;
}
