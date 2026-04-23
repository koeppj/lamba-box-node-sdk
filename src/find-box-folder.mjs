import { getClient, jsonResponse } from './box-client.mjs';

const VALID_MODES = new Set(['native', 'exact']);

function getQueryValue(event, camelName, snakeName = camelName) {
  const query = event?.queryStringParameters || {};
  return event?.[camelName] ?? query[snakeName] ?? query[camelName];
}

function normalizeRequiredString(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

function quoteSearchQuery(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

export async function handler(event = {}) {
  try {
    const name = normalizeRequiredString(getQueryValue(event, 'name'));
    if (!name) {
      return jsonResponse(400, {
        error: 'Missing required query parameter: name'
      });
    }

    const mode = normalizeRequiredString(getQueryValue(event, 'mode')) || 'native';
    if (!VALID_MODES.has(mode)) {
      return jsonResponse(400, {
        error: 'Invalid query parameter: mode',
        message: 'mode must be either native or exact'
      });
    }

    const client = await getClient();
    const result = await client.search.searchForContent({
      query: quoteSearchQuery(name),
      contentTypes: ['name'],
      type: 'folder'
    });

    const entries = Array.isArray(result?.entries) ? result.entries : [];
    const filteredEntries =
      mode === 'exact' ? entries.filter((entry) => entry?.name === name) : entries;

    return jsonResponse(200, filteredEntries);
  } catch (error) {
    return jsonResponse(500, {
      error: 'Failed to find Box folders',
      message: error?.message || String(error)
    });
  }
}
