// pr-creator.ts
import { createBranch, createGitHubClient } from './services/github.service.js'
import {
  downloadRepositoryFiles,
  readLocalFiles
} from './services/file.service.js'
import { updatePackageVersion } from './services/npm.service.js'
import { BRANCH_PREFIX } from './config/constants.js'
import {
  CreateCommitOnBranchResponse,
  CreateCommitOnBranchVariables,
  FileAdditionInput, RepositoryQueryResponse
} from './types/github.js'
import type { PackageUpdateParams } from './types/pr.js'

export async function createPackageUpdatePR ({
  owner, repo, packageName, newVersion,
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
  `

  const response = await octokit.graphql<RepositoryQueryResponse>(query, {
    owner, repo, branch
  })
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
  } = response

  const existingBranchSha = ref?.target.oid
  const existingPRs = edges.map(({ node }) => node)

  const latestCommitSha = existingBranchSha ?? (await createBranch(octokit, {
    owner, repositoryId, branch, defaultBranchSha
  }))

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
  `

  const variables: CreateCommitOnBranchVariables = {
    repositoryId,
    branchName: branch,
    latestCommitSha,
    commitMessage: metadata.commitMessage,
    fileAdditions: updatedFiles
  }

  await octokit.graphql<CreateCommitOnBranchResponse>(mutation, variables)

  if (existingPRs.length === 0) {
    const { data: { html_url } } = await octokit.pulls.create({
      owner,
      repo: repo!,
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
    repo: repo!,
    pull_number: existingPR.number,
    body: `${existingPR.body}\n${metadata.body}`,
  })

  return existingPR.url
}
