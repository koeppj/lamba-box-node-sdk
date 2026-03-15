import { BoxClient } from 'box-node-sdk';
import { BoxJwtAuth, JwtConfig } from 'box-node-sdk/box';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

let cachedClient;
let cachedJwtConfig;
const secretsClient = new SecretsManagerClient({});

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function loadJwtConfigFromSecret() {
  const secretId = process.env.BOX_JWT_SECRET_ARN;
  if (!secretId) return undefined;
  if (cachedJwtConfig) return cachedJwtConfig;

  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );

  if (!response?.SecretString) {
    throw new Error('BOX_JWT_SECRET_ARN returned empty SecretString');
  }

  cachedJwtConfig = JwtConfig.fromConfigJsonString(response.SecretString);
  return cachedJwtConfig;
}

async function buildJwtConfig() {
  const secretConfig = await loadJwtConfigFromSecret();
  if (secretConfig) return secretConfig;

  const configFile = process.env.BOX_CONFIG_FILE;
  if (configFile) {
    const fileContent = readFileSync(resolveConfigFilePath(configFile), 'utf8');
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

function resolveConfigFilePath(configFile) {
  if (existsSync(configFile)) return configFile;
  if (process.env.AWS_SAM_LOCAL !== 'true') return configFile;

  const taskRoot = process.env.LAMBDA_TASK_ROOT || '/var/task';
  const normalized = String(configFile).replace(/\\/g, '/');

  if (!isAbsolute(configFile)) {
    const taskRootRelativePath = join(taskRoot, configFile);
    if (existsSync(taskRootRelativePath)) return taskRootRelativePath;
    return configFile;
  }

  const segments = normalized.split('/').filter(Boolean);
  for (let index = 0; index < segments.length; index += 1) {
    const candidate = join(taskRoot, ...segments.slice(index));
    if (existsSync(candidate)) return candidate;
  }

  return configFile;
}

export async function getClient() {
  if (cachedClient) return cachedClient;

  const jwtAuth = new BoxJwtAuth({ config: await buildJwtConfig() });
  const asUserId = process.env.BOX_AS_USER_ID;
  const auth = asUserId ? jwtAuth.withUserSubject(asUserId) : jwtAuth;

  cachedClient = new BoxClient({ auth });
  return cachedClient;
}

export function parseOptionalCsv(value) {
  if (!value) return undefined;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseOptionalInt(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}
