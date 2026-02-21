import { BoxClient } from 'box-node-sdk';
import { BoxJwtAuth, JwtConfig } from 'box-node-sdk/box';
import { readFileSync } from 'node:fs';

let cachedClient;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseOptionalCsv(value) {
  if (!value) return undefined;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalInt(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildJwtConfig() {
  const configFile = process.env.BOX_CONFIG_FILE;
  if (configFile) {
    const fileContent = readFileSync(configFile, 'utf8');
    return JwtConfig.fromConfigJsonString(fileContent);
  }

  const rawJson = process.env.BOX_JWT_CONFIG_JSON;
  if (rawJson) {
    return JwtConfig.fromConfigJsonString(rawJson);
  }

  const rawBase64 = process.env.BOX_JWT_CONFIG_JSON_BASE64;
  if (rawBase64) {
    const decodedJson = Buffer.from(rawBase64, 'base64').toString('utf8');
    return JwtConfig.fromConfigJsonString(decodedJson);
  }

  const privateKey = requiredEnv('BOX_PRIVATE_KEY').replace(/\\n/g, '\n');
  const userId = process.env.BOX_USER_ID;
  const enterpriseId = process.env.BOX_ENTERPRISE_ID;

  if (!userId && !enterpriseId) {
    throw new Error('Set BOX_USER_ID or BOX_ENTERPRISE_ID for JWT subject.');
  }

  return new JwtConfig({
    clientId: requiredEnv('BOX_CLIENT_ID'),
    clientSecret: requiredEnv('BOX_CLIENT_SECRET'),
    jwtKeyId: requiredEnv('BOX_JWT_KEY_ID'),
    privateKey,
    privateKeyPassphrase: requiredEnv('BOX_PRIVATE_KEY_PASSPHRASE'),
    userId,
    enterpriseId
  });
}

function getClient() {
  if (cachedClient) return cachedClient;

  const jwtAuth = new BoxJwtAuth({ config: buildJwtConfig() });
  const asUserId = process.env.BOX_AS_USER_ID;
  const auth = asUserId ? jwtAuth.withUserSubject(asUserId) : jwtAuth;

  cachedClient = new BoxClient({ auth });
  return cachedClient;
}

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

    const client = getClient();
    const result = await client.folders.getFolderItems(folderId, params);

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ folderId, ...result })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to list Box folder items',
        message: error?.message || String(error)
      })
    };
  }
}
