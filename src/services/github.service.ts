import { Octokit } from '@octokit/rest'
import { throttling } from '@octokit/plugin-throttling'
import { retry } from '@octokit/plugin-retry'
import { createAppAuth } from '@octokit/auth-app'
import { ConfigurationError } from '../utils/error.js'
import { CreateBranchParams, RepoParams } from '../types/github.js'

const OctokitWithPlugins = Octokit.plugin(throttling, retry)
const RATE_LIMIT_RETRY_COUNT = 2 as const
const SECONDARY_RATE_LIMIT_RETRY_COUNT = 1 as const

export function createGitHubClient (): Octokit {
  const requiredVars = ['APP_ID', 'APP_PRIVATE_KEY', 'APP_INSTALLATION_ID']
  const missingVars = requiredVars.filter(varName => !process.env[varName])

  if (missingVars.length > 0) {
    throw new ConfigurationError('Missing GitHub configuration variables', missingVars)
  }
  return new OctokitWithPlugins({
    authStrategy: createAppAuth, auth: {
      appId: process.env.APP_ID,
      privateKey: process.env.APP_PRIVATE_KEY,
      installationId: process.env.APP_INSTALLATION_ID,
    }, throttle: {
      enabled: true,
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`)

        if (retryCount <= RATE_LIMIT_RETRY_COUNT) {
          const waitTime = retryAfter * (2 ** retryCount) + Math.random() * 1000
          console.warn(`Rate limit hit, retrying in ${waitTime}ms`)
          return new Promise(resolve => setTimeout(resolve, waitTime))
        }

        octokit.log.warn(`Rate limit reached, stopping retries`)
        return false
      },
      onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
        octokit.log.warn(`Secondary rate limit hit for request ${options.method} ${options.url}`)

        if (retryCount <= SECONDARY_RATE_LIMIT_RETRY_COUNT) {
          const waitTime = retryAfter * (2 ** retryCount) + Math.random() * 1000
          console.warn(`Rate limit hit, retrying in ${waitTime}ms`)
          return new Promise(resolve => setTimeout(resolve, waitTime))
        }

        octokit.log.warn(`Abuse detection triggered, stopping retries`)
        return false
      },
    }
  })
}

export async function createBranch(
  octokit: Octokit,
  { repositoryId, branch, defaultBranchSha }: CreateBranchParams
): Promise<string> {
  const mutation = `
    mutation CreateRef($input: CreateRefInput!) {
      createRef(input: $input) {
        ref {
          name
        }
      }
    }
  `;

  await octokit.graphql(mutation, {
    input: {
      repositoryId,
      name: `refs/heads/${branch}`,
      oid: defaultBranchSha,
    },
  });

  return defaultBranchSha;
}
