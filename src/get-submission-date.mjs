import { jsonResponse } from './box-client.mjs';
import {
  getSubmissionDateMetadata,
  withSubmissionDateHandler
} from './submission-date-common.mjs';

export async function handler(event = {}) {
  return withSubmissionDateHandler(
    event,
    async (client, fileId) => jsonResponse(200, await getSubmissionDateMetadata(client, fileId)),
    'Failed to get submission date metadata'
  );
}
