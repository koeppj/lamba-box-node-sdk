import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROPERTIES_SCOPE,
  PROPERTIES_TEMPLATE_KEY,
  SUBMISSION_DATE_KEY,
  deletePropertiesTemplate,
  deleteSubmissionDate,
  getSubmissionDateMetadata,
  resolveFileId,
  setSubmissionDateMetadata
} from '../src/submission-date-common.mjs';

function createNotFoundError() {
  return {
    message: '404 not_found',
    responseInfo: {
      statusCode: 404
    }
  };
}

test('resolveFileId prefers event inputs and falls back to BOX_TEST_FILE_ID', () => {
  process.env.BOX_TEST_FILE_ID = 'from-env';

  assert.equal(resolveFileId({ fileId: 'from-event' }), 'from-event');
  assert.equal(resolveFileId({ pathParameters: { fileId: 'from-path' } }), 'from-path');
  assert.equal(
    resolveFileId({ queryStringParameters: { fileId: 'from-query' } }),
    'from-query'
  );
  assert.equal(resolveFileId({}), 'from-env');

  delete process.env.BOX_TEST_FILE_ID;
});

test('getSubmissionDateMetadata returns metadata when submissionDate exists', async () => {
  const metadata = { [SUBMISSION_DATE_KEY]: '2026-03-15T00:00:00.000Z' };
  const client = {
    fileMetadata: {
      getFileMetadataById: async () => metadata
    }
  };

  assert.equal(await getSubmissionDateMetadata(client, '12345'), metadata);
});

test('getSubmissionDateMetadata returns 404 when submissionDate is missing', async () => {
  const client = {
    fileMetadata: {
      getFileMetadataById: async () => ({})
    }
  };

  await assert.rejects(
    () => getSubmissionDateMetadata(client, '12345'),
    (error) => error.statusCode === 404
  );
});

test('setSubmissionDateMetadata creates properties metadata when template is missing', async () => {
  const calls = [];
  const client = {
    fileMetadata: {
      getFileMetadataById: async () => {
        throw createNotFoundError();
      },
      createFileMetadataById: async (...args) => {
        calls.push(args);
        return { [SUBMISSION_DATE_KEY]: '2026-03-15T12:30:45.000Z' };
      }
    }
  };

  const result = await setSubmissionDateMetadata(client, '12345', new Date('2026-03-15T12:30:45.000Z'));

  assert.equal(result.statusCode, 201);
  assert.deepEqual(calls, [
    [
      '12345',
      PROPERTIES_SCOPE,
      PROPERTIES_TEMPLATE_KEY,
      { [SUBMISSION_DATE_KEY]: '2026-03-15T12:30:45.000Z' }
    ]
  ]);
});

test('setSubmissionDateMetadata adds submissionDate when template exists without a value', async () => {
  const calls = [];
  const client = {
    fileMetadata: {
      getFileMetadataById: async () => ({ $id: 'properties' }),
      updateFileMetadataById: async (...args) => {
        calls.push(args);
        return { [SUBMISSION_DATE_KEY]: '2026-03-15T12:30:45.000Z' };
      }
    }
  };

  const result = await setSubmissionDateMetadata(client, '12345', new Date('2026-03-15T12:30:45.000Z'));

  assert.equal(result.statusCode, 200);
  assert.deepEqual(calls, [
    [
      '12345',
      PROPERTIES_SCOPE,
      PROPERTIES_TEMPLATE_KEY,
      [{ op: 'add', path: `/${SUBMISSION_DATE_KEY}`, value: '2026-03-15T12:30:45.000Z' }]
    ]
  ]);
});

test('setSubmissionDateMetadata replaces submissionDate when template already has a value', async () => {
  const calls = [];
  const client = {
    fileMetadata: {
      getFileMetadataById: async () => ({ [SUBMISSION_DATE_KEY]: '2025-01-01T00:00:00.000Z' }),
      updateFileMetadataById: async (...args) => {
        calls.push(args);
        return { [SUBMISSION_DATE_KEY]: '2026-03-15T12:30:45.000Z' };
      }
    }
  };

  const result = await setSubmissionDateMetadata(client, '12345', new Date('2026-03-15T12:30:45.000Z'));

  assert.equal(result.statusCode, 200);
  assert.deepEqual(calls, [
    [
      '12345',
      PROPERTIES_SCOPE,
      PROPERTIES_TEMPLATE_KEY,
      [{ op: 'replace', path: `/${SUBMISSION_DATE_KEY}`, value: '2026-03-15T12:30:45.000Z' }]
    ]
  ]);
});

test('deletePropertiesTemplate delegates to deleteFileMetadataById', async () => {
  const calls = [];
  const client = {
    fileMetadata: {
      deleteFileMetadataById: async (...args) => {
        calls.push(args);
      }
    }
  };

  await deletePropertiesTemplate(client, '12345');

  assert.deepEqual(calls, [['12345', PROPERTIES_SCOPE, PROPERTIES_TEMPLATE_KEY]]);
});

test('deleteSubmissionDate returns 404 when submissionDate is missing', async () => {
  const client = {
    fileMetadata: {
      getFileMetadataById: async () => ({})
    }
  };

  await assert.rejects(
    () => deleteSubmissionDate(client, '12345'),
    (error) => error.statusCode === 404
  );
});

test('deleteSubmissionDate removes submissionDate when present', async () => {
  const calls = [];
  const client = {
    fileMetadata: {
      getFileMetadataById: async () => ({ [SUBMISSION_DATE_KEY]: '2026-03-15T12:30:45.000Z' }),
      updateFileMetadataById: async (...args) => {
        calls.push(args);
      }
    }
  };

  await deleteSubmissionDate(client, '12345');

  assert.deepEqual(calls, [
    ['12345', PROPERTIES_SCOPE, PROPERTIES_TEMPLATE_KEY, [{ op: 'remove', path: `/${SUBMISSION_DATE_KEY}` }]]
  ]);
});
