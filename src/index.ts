import { SQSEvent, SQSRecord, Context } from 'aws-lambda'
import { bumpParents, findParents, getPackages } from './package_updater.js'
import { loadSecrets } from '@seccl/aws-utils'
import secrets from '../secrets-config.json' with { type: 'json' }
import { Job } from './types/job.js'

const ERROR_MESSAGES = {
  MISSING_TABLE: 'Internal server error: Missing DYNAMODB_TABLE environment variable',
  MISSING_GIT_OWNER: 'Internal server error: Missing GIT_OWNER environment variable',
  MISSING_REQUEST_TYPE: 'Invalid payload: Request does not have a request_type',
  INVALID_REQUEST_TYPE: 'Invalid request_type',
  INVALID_MESSAGE_BODY: 'Invalid SQS message body format'
} as const

/**
 * Validates the required environment variables and ensures they are set.
 * Throws an error if any required environment variable is missing.
 *
 * @return {Object} An object containing the validated environment variables.
 * @return {string} return.DYNAMODB_TABLE The name of the DynamoDB table.
 * @return {string} return.GIT_OWNER The Git owner value.
 */
function validateEnvironment(): { DYNAMODB_TABLE: string, GIT_OWNER: string } {
  const { DYNAMODB_TABLE, GIT_OWNER } = process.env

  if (!DYNAMODB_TABLE) {
    throw new Error(ERROR_MESSAGES.MISSING_TABLE)
  }

  if (!GIT_OWNER) {
    throw new Error(ERROR_MESSAGES.MISSING_GIT_OWNER)
  }

  return { DYNAMODB_TABLE, GIT_OWNER }
}


/**
 * Processes a job based on the provided request type. Handles different actions
 * such as storing a dependency or bumping parent versions, depending on the input job.
 *
 * @param {Job[]} jobs - The job object containing the request type and associated data.
 * @param {string} tableName - The name of the table used for storing data.
 * @param {string} gitOwner - The Git owner name associated with the operation.
 */
async function processJob(jobs: Job[], tableName: string, gitOwner: string) {
  // Fetch all packages from DynamoDB
  const packages = await getPackages(tableName);
  console.log("All packages:", packages);

  for (const job of jobs) {
    // Find all parent packages for the updated package
    const parents = findParents(packages, job);
    console.log(`${job.updated_package_name} parents:`, parents);

    // Increment the version of parent packages by creating PR's
    bumpParents(job, parents, gitOwner);
  }
}

/**
 * Parses the provided message body string into an object.
 *
 * @param {string} body - The message body string to be parsed.
 * @return {Record<string, any> | null} The parsed object if the body is valid JSON, otherwise null.
 */
function parseMessageBody(body: string): Record<string, any> | null {
  try {
    return JSON.parse(body)
  } catch (error) {
    console.error('Error parsing message body:', error)
    return null
  }
}

/**
 * Asynchronous handler function for processing AWS SQS events with partial batch failure handling.
 *
 * This function processes a batch of messages from an SQS event. Each message is validated,
 * parsed, and processed individually. Failures are tracked and returned so that AWS SQS can
 * retry only the failed messages. It also ensures that any fatal errors during execution lead
 * to marking all messages as failed for retrying.
 *
 * The handler:
 * - Loads secrets from a local JSON configuration file.
 * - Validates essential environment variables shared across messages.
 * - Parses and processes each message payload.
 * - Tracks message IDs of failed messages for retrying by SQS.
 *
 * @param {SQSEvent} event - The AWS SQS event containing the batch of messages to process.
 * @param {Context} _context - The Lambda execution context (unused in this implementation).
 * @returns {Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }>} An object containing the message IDs of failed items for partial batch failure reporting.
 * @throws {Error} If there are issues with loading secrets, validating environment variables, or other unexpected errors during processing.
 */
export const handler = async (event: SQSEvent, _context: Context): Promise<{
  batchItemFailures: Array<{ itemIdentifier: string }>
}> => {
  await loadSecrets(secrets)

  const failedMessageIds: string[] = []

  try {
    const { DYNAMODB_TABLE, GIT_OWNER } = validateEnvironment()
    console.log('DYNAMODB_TABLE:', DYNAMODB_TABLE, 'GIT_OWNER:', GIT_OWNER)

    const processPromises = event.Records.map(async (record: SQSRecord) => {
      const messageId = record.messageId

      try {
        const jobPayload = parseMessageBody(record.body)
        if (!jobPayload) {
          console.error(`Message ${messageId}: ${ERROR_MESSAGES.INVALID_MESSAGE_BODY}`)
          failedMessageIds.push(messageId)
          return
        }

        const { success } = await processJob(jobPayload, DYNAMODB_TABLE, GIT_OWNER)

        if (!success) {
          failedMessageIds.push(messageId)
        }
      } catch (recordError) {
        console.error(`Error processing message ${messageId}:`, recordError)
        failedMessageIds.push(messageId)
      }
    })

    await Promise.all(processPromises)

  } catch (error) {
    console.error('Fatal error processing batch:', error)
    failedMessageIds.push(...event.Records.map(record => record.messageId))
  }

  return {
    batchItemFailures: failedMessageIds.map(itemIdentifier => ({ itemIdentifier }))
  }
}

