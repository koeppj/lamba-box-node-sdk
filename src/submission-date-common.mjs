import { getClient, jsonResponse } from './box-client.mjs';

/**
 * This module centralizes the Box metadata logic used by the submission-date
 * Lambda handlers.
 *
 * The handlers themselves stay intentionally thin:
 * - resolve the incoming Box file ID
 * - build a Box client
 * - call one of the helpers in this file
 * - convert success or failure into an API Gateway style response
 *
 * Box stores the submission date in the built-in metadata template
 * `global.properties` under the key `submissionDate`.
 */
export const PROPERTIES_SCOPE = 'global';
export const PROPERTIES_TEMPLATE_KEY = 'properties';
export const SUBMISSION_DATE_KEY = 'submissionDate';

/**
 * Box SDK errors usually include the HTTP status code at
 * `error.responseInfo.statusCode`. We also check `error.statusCode` so that our
 * own locally-created errors can use the same code path.
 *
 * @param {unknown} error
 * @returns {number | undefined}
 */
function getBoxStatusCode(error) {
  return error?.responseInfo?.statusCode ?? error?.statusCode;
}

/**
 * Creates a normal Error object and attaches an HTTP status code to it.
 *
 * We use this for application-level failures, for example when the metadata
 * template exists but the `submissionDate` field is missing. That lets the
 * Lambda response wrapper handle Box API errors and our own validation errors
 * in a consistent way.
 *
 * @param {number} statusCode
 * @param {string} message
 * @returns {Error & { statusCode: number }}
 */
function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Builds an empty response body for status codes such as `204 No Content`.
 *
 * API Gateway responses still need the top-level shape `{ statusCode, headers,
 * body }`, even when the body itself is empty.
 *
 * @param {number} statusCode
 * @returns {{ statusCode: number, headers: Record<string, string>, body: string }}
 */
export function emptyResponse(statusCode) {
  return {
    statusCode,
    headers: {},
    body: ''
  };
}

/**
 * Finds the Box file ID for the current request.
 *
 * Lookup order:
 * 1. `event.fileId` for direct invocation or tests
 * 2. API Gateway path parameter
 * 3. query string parameter
 * 4. `BOX_TEST_FILE_ID` for local development
 *
 * Returning an empty string instead of throwing keeps this helper focused on
 * lookup only. The handler wrapper decides whether the missing value should
 * become a `400 Bad Request`.
 *
 * @param {object} [event={}]
 * @returns {string}
 */
export function resolveFileId(event = {}) {
  return (
    event.fileId ||
    event?.pathParameters?.fileId ||
    event?.queryStringParameters?.fileId ||
    process.env.BOX_TEST_FILE_ID ||
    ''
  );
}

/**
 * Reads `submissionDate` from a metadata object.
 *
 * The helper treats `undefined`, `null`, and an empty string as "missing".
 * That keeps the rest of the code from having to repeat the same checks.
 *
 * @param {Record<string, unknown> | undefined | null} metadata
 * @returns {unknown}
 */
export function getSubmissionDateValue(metadata) {
  const value = metadata?.[SUBMISSION_DATE_KEY];
  return value === undefined || value === null || value === '' ? undefined : value;
}

/**
 * Fetches the full `global.properties` metadata template for a file.
 *
 * This does not verify that `submissionDate` exists. It only loads the Box
 * metadata template instance.
 *
 * @param {import('box-node-sdk').BoxClient} client
 * @param {string} fileId
 * @returns {Promise<unknown>}
 */
export async function getPropertiesTemplate(client, fileId) {
  return client.fileMetadata.getFileMetadataById(
    fileId,
    PROPERTIES_SCOPE,
    PROPERTIES_TEMPLATE_KEY
  );
}

/**
 * Returns the file's `global.properties` metadata, but only if it contains a
 * usable `submissionDate` value.
 *
 * Two different situations map to `404` in the public API:
 * - Box returns `404` because the metadata template does not exist
 * - the template exists, but `submissionDate` is not set
 *
 * The first case is raised by the Box SDK itself. The second case is converted
 * into a local error by `createHttpError()`.
 *
 * @param {import('box-node-sdk').BoxClient} client
 * @param {string} fileId
 * @returns {Promise<unknown>}
 */
export async function getSubmissionDateMetadata(client, fileId) {
  const metadata = await getPropertiesTemplate(client, fileId);
  if (!getSubmissionDateValue(metadata)) {
    throw createHttpError(404, 'Submission date not found on file metadata');
  }

  return metadata;
}

/**
 * Creates or updates `submissionDate` on `global.properties`.
 *
 * Flow:
 * 1. Try to read the existing metadata template.
 * 2. If the template exists:
 *    - use `add` when `submissionDate` is missing
 *    - use `replace` when `submissionDate` already has a value
 * 3. If Box says the template does not exist (`404`), create it from scratch.
 *
 * The current time is passed in as an argument mainly to make tests
 * deterministic. In production the default is `new Date()`.
 *
 * @param {import('box-node-sdk').BoxClient} client
 * @param {string} fileId
 * @param {Date} [now=new Date()]
 * @returns {Promise<{ statusCode: number, body: unknown }>}
 */
export async function setSubmissionDateMetadata(client, fileId, now = new Date()) {
  const submissionDate = now.toISOString();

  try {
    const metadata = await getPropertiesTemplate(client, fileId);
    // JSON Patch needs different operations depending on whether the field
    // already exists on the metadata template.
    const op = getSubmissionDateValue(metadata) ? 'replace' : 'add';
    const updated = await client.fileMetadata.updateFileMetadataById(
      fileId,
      PROPERTIES_SCOPE,
      PROPERTIES_TEMPLATE_KEY,
      [{ op, path: `/${SUBMISSION_DATE_KEY}`, value: submissionDate }]
    );

    return { statusCode: 200, body: updated };
  } catch (error) {
    // Only a missing template should fall through to the create path.
    // Any other Box error should be surfaced to the caller.
    if (getBoxStatusCode(error) !== 404) throw error;

    const created = await client.fileMetadata.createFileMetadataById(
      fileId,
      PROPERTIES_SCOPE,
      PROPERTIES_TEMPLATE_KEY,
      { [SUBMISSION_DATE_KEY]: submissionDate }
    );

    return { statusCode: 201, body: created };
  }
}

/**
 * Deletes the entire `global.properties` metadata template from the file.
 *
 * This is different from deleting only `submissionDate`: removing the template
 * deletes every field stored in that template.
 *
 * @param {import('box-node-sdk').BoxClient} client
 * @param {string} fileId
 * @returns {Promise<void>}
 */
export async function deletePropertiesTemplate(client, fileId) {
  await client.fileMetadata.deleteFileMetadataById(
    fileId,
    PROPERTIES_SCOPE,
    PROPERTIES_TEMPLATE_KEY
  );
}

/**
 * Removes only the `submissionDate` field from the file's metadata.
 *
 * We first read the template so we can return a clean `404` when the field is
 * absent. If the field exists, we send a JSON Patch `remove` operation to Box.
 *
 * @param {import('box-node-sdk').BoxClient} client
 * @param {string} fileId
 * @returns {Promise<void>}
 */
export async function deleteSubmissionDate(client, fileId) {
  const metadata = await getPropertiesTemplate(client, fileId);
  if (!getSubmissionDateValue(metadata)) {
    throw createHttpError(404, 'Submission date not found on file metadata');
  }

  await client.fileMetadata.updateFileMetadataById(
    fileId,
    PROPERTIES_SCOPE,
    PROPERTIES_TEMPLATE_KEY,
    [{ op: 'remove', path: `/${SUBMISSION_DATE_KEY}` }]
  );
}

/**
 * Shared Lambda wrapper for the submission-date handlers.
 *
 * Responsibilities:
 * - validate that a file ID is available
 * - build or reuse the cached Box client
 * - run the handler-specific action
 * - translate thrown errors into JSON HTTP responses
 *
 * The `action` callback is expected to return a full API Gateway response
 * object. That keeps the wrapper generic and lets each handler control its own
 * success status code and response shape.
 *
 * @param {object} event
 * @param {(client: import('box-node-sdk').BoxClient, fileId: string) => Promise<object>} action
 * @param {string} fallbackMessage
 * @returns {Promise<object>}
 */
export async function withSubmissionDateHandler(event, action, fallbackMessage) {
  try {
    const fileId = resolveFileId(event);
    if (!fileId) {
      return jsonResponse(400, {
        error: 'Missing Box file ID',
        message: 'Provide fileId as a path parameter, query parameter, or BOX_TEST_FILE_ID'
      });
    }

    const client = await getClient();
    return await action(client, fileId);
  } catch (error) {
    const statusCode = getBoxStatusCode(error) ?? 500;
    return jsonResponse(statusCode, {
      error: fallbackMessage,
      message: error?.message || String(error)
    });
  }
}
