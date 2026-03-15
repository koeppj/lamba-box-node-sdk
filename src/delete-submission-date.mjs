import {
  deleteSubmissionDate,
  emptyResponse,
  withSubmissionDateHandler
} from './submission-date-common.mjs';

export async function handler(event = {}) {
  return withSubmissionDateHandler(
    event,
    async (client, fileId) => {
      await deleteSubmissionDate(client, fileId);
      return emptyResponse(204);
    },
    'Failed to delete submission date metadata'
  );
}
