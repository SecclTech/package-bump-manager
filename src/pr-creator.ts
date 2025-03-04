// pr-creator.ts
import { createGitHubClient, createBranch } from './services/github.service.js'
import { downloadRepositoryFiles, readLocalFiles } from './services/file.service.js'
import { updatePackageVersion } from './services/npm.service.js'
import { BRANCH_PREFIX, GIT } from './config/constants.js'
import type { PackageUpdateParams } from './types/pr.js'

interface GithubGraphQLResponse {
  repository: {
    id: string;
    defaultBranchRef: {
      name: string;
      target: {
        oid: string;
      }
    };
    pullRequests: {
      edges: {
        node: {
          title: string;
          number: number;
          body: string;
          url: string;
        };
      }[];
    };
    ref?: {
      target: {
        oid: string;
      }
    };
  };
}

interface FileAdditionInput {
  path: string;
  contents: string;
}

// Variables for the mutation
interface CreateCommitOnBranchVariables {
  repositoryId: string;
  branchName: string;
  latestCommitSha: string;
  commitMessage: string;
  fileAdditions: FileAdditionInput[];
  [key: string]: unknown;
}

// Expected response from the mutation
interface CreateCommitOnBranchResponse {
  createCommitOnBranch: {
    commit: {
      oid: string;
      url: string;
    };
  };
}

export async function createPackageUpdatePR ({
  owner,
  repo,
  packageName,
  newVersion,
}: PackageUpdateParams): Promise<string> {
  const octokit = createGitHubClient()

  const branch = `${BRANCH_PREFIX}000000`
  const metadata = {
    title: `Update ${packageName} to ${newVersion}`,
    body: `This PR updates ${packageName} to version ${newVersion}.`,
    commitMessage: `update ${packageName} to ${newVersion}`,
  }

  const query = `
    query ($owner: String!, $repo: String!, $branch: String!) {
      repository(owner: $owner, name: $repo) {
        id,
        defaultBranchRef { name target { oid } }
        pullRequests(states: OPEN, first: 5, headRefName: $branch) {
          edges { node { title number body } }
        }
        ref(qualifiedName: $branch) {
          target { oid }
        }
      }
    }
  `;

  const response = await octokit.graphql<GithubGraphQLResponse>(query, { owner, repo, branch })
  const {
    repository: {
      id: repositoryId,
      defaultBranchRef: {
        name: defaultBranchName,
        target: { oid: defaultBranchSha },
      },
      ref,
      pullRequests: { edges },
    },
  } = response;

  const existingBranchSha = ref?.target.oid;
  const existingPRs = edges.map(({ node }) => node);

  const latestCommitSha =
    existingBranchSha ??
    (await createBranch(octokit, { owner, repo, branch, defaultBranchSha }));

  await downloadRepositoryFiles(octokit, { owner, repo, branch })
  await updatePackageVersion(packageName, newVersion)

  const updatedFiles: FileAdditionInput[] = await readLocalFiles()

  const mutation = `
    mutation CreateCommitOnBranch(
      $repositoryId: ID!,
      $branchName: String!,
      $latestCommitSha: GitObjectID!,
      $commitMessage: String!,
      $fileAdditions: [FileAdditionInput!]!,
    } {
      createCommitOnBranch(input: {
        branch: { repositoryId: $repositoryId, branchName: $branchName },
        expectedHeadOid: $expectedHeadOid,
        message: { headline: $commitMessage },
        fileChanges: { additions: $fileAdditions },
      }) {
        commit { oid, url }
      }
    }
  `;

  const variables: CreateCommitOnBranchVariables = {
    repositoryId,
    branchName: branch,
    latestCommitSha,
    commitMessage: metadata.commitMessage,
    fileAdditions: updatedFiles
  }

  await octokit.graphql<CreateCommitOnBranchResponse>(
    mutation,
    variables
  )

  if (existingPRs.length === 0) {
    const { data: { html_url } } = await octokit.pulls.create({
      owner,
      repo,
      title: metadata.title,
      head: branch,
      base: defaultBranchName,
      body: metadata.body,
    })
    return html_url
  }

  const existingPR = existingPRs[0]
  await octokit.pulls.update({
    owner,
    repo,
    pull_number: existingPR.number,
    body: `${existingPR.body}\n${metadata.body}`,
  })

  return existingPR.url
}
