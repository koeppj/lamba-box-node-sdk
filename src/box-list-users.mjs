import { getClient, jsonResponse } from './box-client.mjs';

export async function handler(event = {}) {
  try {
    const query = event?.queryStringParameters || {};
    const filterTerm = event.filterTerm ?? query.filter_term ?? query.filterTerm;
    const userType = event.userType ?? query.user_type ?? query.userType;

    const params = {};
    if (filterTerm) params.filterTerm = String(filterTerm);
    if (userType) params.userType = String(userType);

    const client = await getClient();
    const result = await client.users.getUsers(params);

    return jsonResponse(200, result);
  } catch (error) {
    return jsonResponse(500, {
      error: 'Failed to list Box enterprise users',
      message: error?.message || String(error)
    });
  }
}
