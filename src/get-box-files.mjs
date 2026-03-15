import { getClient, jsonResponse, parseOptionalCsv, parseOptionalInt } from './box-client.mjs';

export async function handler(event = {}) {
  try {
    const folderId =
      event.folderId ||
      event?.pathParameters?.folderId ||
      event?.queryStringParameters?.folderId ||
      process.env.BOX_FOLDER_ID ||
      '0';

    const query = event?.queryStringParameters || {};
    const limit = parseOptionalInt(event.limit ?? query.limit, 100);
    const offset = parseOptionalInt(event.offset ?? query.offset, 0);
    const fields = parseOptionalCsv(event.fields ?? query.fields);

    const params = { limit, offset };
    if (fields?.length) params.fields = fields;

    const client = await getClient();
    const result = await client.folders.getFolderItems(folderId, params);

    return jsonResponse(200, { folderId, ...result });
  } catch (error) {
    return jsonResponse(500, {
      error: 'Failed to list Box folder items',
      message: error?.message || String(error)
    });
  }
}
