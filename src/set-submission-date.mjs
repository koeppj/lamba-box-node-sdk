import { jsonResponse } from './box-client.mjs';
import {
  setSubmissionDateMetadata,
  withSubmissionDateHandler
} from './submission-date-common.mjs';

export async function handler(event = {}) {
  return withSubmissionDateHandler(
    event,
    async (client, fileId) => {
      const result = await setSubmissionDateMetadata(client, fileId);
      return jsonResponse(result.statusCode, result.body);
    },
    'Failed to set submission date metadata'
  );
}
