import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { GitHubApiError, ConfigurationError } from '../utils/error.js';
import type { RepoParams, BranchInfo, GitHubError } from '../types/github.js';

export function createGitHubClient(): Octokit {
  const requiredVars = ['APP_ID', 'APP_PRIVATE_KEY', 'APP_INSTALLATION_ID'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new ConfigurationError(
      'Missing GitHub configuration variables',
      missingVars
    );
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.APP_ID,
      privateKey: process.env.APP_PRIVATE_KEY,
      installationId: process.env.APP_INSTALLATION_ID,
    },
  });

}

export async function getDefaultBranch(
  octokit: Octokit,
  { owner, repo }: RepoParams
): Promise<BranchInfo> {
  try {
    const { data: repoData } = await octokit.repos.get({ owner, repo });

    if (!repoData.default_branch) {
      throw new GitHubApiError(
        500,
        'Default branch not found',
        { owner, repo }
      );
    }

    const { data: branchData } = await octokit.repos.getBranch({
      owner,
      repo,
      branch: repoData.default_branch,
    });

    if (!branchData.commit?.sha) {
      throw new GitHubApiError(
        500,
        'Branch SHA not found',
        { owner, repo, branch: repoData.default_branch }
      );
    }

    return {
      name: repoData.default_branch,
      sha: branchData.commit.sha,
    };
  } catch (error) {
    if (error instanceof GitHubApiError) {
      throw error;
    }
    throw new GitHubApiError(
      500,
      `Failed to get default branch: ${error instanceof Error ? error.message : String(error)}`,
      { owner, repo }
    );
  }
}


export async function createOrGetBranch(
  octokit: Octokit,
  { owner, repo, branch, defaultBranchSha }: RepoParams & { branch: string; defaultBranchSha: string }
): Promise<string> {
  try {
    const { data } = await octokit.repos.getBranch({ owner, repo, branch });
    return data.commit.sha;
  } catch (error) {
    const { status } = error as GitHubError;
    if (status === 404) {
      await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: defaultBranchSha,
      });
      return defaultBranchSha;
    }
    throw error;
  }
}
