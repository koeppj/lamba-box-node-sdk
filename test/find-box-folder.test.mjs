import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { handler } from '../src/find-box-folder.mjs';

describe('find-box-folder handler validation', () => {
  it('returns 400 when name is missing', async () => {
    const response = await handler({ queryStringParameters: {} });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      error: 'Missing required query parameter: name'
    });
  });

  it('returns 400 when mode is invalid', async () => {
    const response = await handler({
      queryStringParameters: {
        name: 'example',
        mode: 'contains'
      }
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      error: 'Invalid query parameter: mode',
      message: 'mode must be either native or exact'
    });
  });
});
