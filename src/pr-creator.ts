// pr-creator.ts
import { createGitHubClient, getDefaultBranch, createOrGetBranch } from './services/github.service.js';
import { downloadRepositoryFiles, readLocalFiles } from './services/file.service.js';
import { updatePackageVersion } from './services/npm.service.js';
import { BRANCH_PREFIX, GIT } from './config/constants.js';
import type { PackageUpdateParams } from './types/pr.js';

export async function createPackageUpdatePR({
  owner,
  repo,
  packageName,
  newVersion,
}: PackageUpdateParams): Promise<string> {
  const octokit = createGitHubClient();

  const branch = `${BRANCH_PREFIX}000000`;
  const metadata = {
    title: `Update ${packageName} to ${newVersion}`,
    body: `This PR updates ${packageName} to version ${newVersion}.`,
    commitMessage: `update ${packageName} to ${newVersion}`,
  };

  const defaultBranch = await getDefaultBranch(octokit, { owner, repo });
  const latestCommitSha = await createOrGetBranch(octokit, {
    owner,
    repo,
    branch,
    defaultBranchSha: defaultBranch.sha,
  });

  await downloadRepositoryFiles(octokit, { owner, repo, branch });
  await updatePackageVersion(packageName, newVersion);

  const updatedFiles = await readLocalFiles();

  // Create tree and commit
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: defaultBranch.sha,
    tree: updatedFiles.map(({ path, content }) => ({
      path,
      mode: GIT.FILE_MODE,
      type: GIT.BLOB_TYPE,
      content,
    })),
  });

  const { data: newCommit } = await octokit.git.createCommit({
    owner,
    repo,
    message: metadata.commitMessage,
    tree: newTree.sha,
    parents: [latestCommitSha],
  });

  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha,
    force: GIT.DEFAULT_FORCE,
  });

  // Create or update PR
  const { data: existingPRs } = await octokit.pulls.list({
    owner,
    repo,
    state: "open",
    head: `${owner}:${branch}`,
    base: defaultBranch.name,
  });

  if (existingPRs.length === 0) {
    const { data: { html_url } } = await octokit.pulls.create({
      owner,
      repo,
      title: metadata.title,
      head: branch,
      base: defaultBranch.name,
      body: metadata.body,
    });
    return html_url;
  }

  const existingPR = existingPRs[0];
  await octokit.pulls.update({
    owner,
    repo,
    pull_number: existingPR.number,
    body: `${existingPR.body}\n${metadata.body}`,
  });

  return existingPR.html_url;
}
