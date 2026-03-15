import {
  deletePropertiesTemplate,
  emptyResponse,
  withSubmissionDateHandler
} from './submission-date-common.mjs';

export async function handler(event = {}) {
  return withSubmissionDateHandler(
    event,
    async (client, fileId) => {
      await deletePropertiesTemplate(client, fileId);
      return emptyResponse(204);
    },
    'Failed to delete properties metadata template'
  );
}
