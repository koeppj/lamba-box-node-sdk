# lambda-box-node-sdk

AWS Lambda shell project for JavaScript ESM on Node 22 with six functions:

- `get-box-files` for Box folder items
- `box-list-users` for Box enterprise users
- `get-submission-date` for reading `global.properties.submissionDate`
- `set-submission-date` for creating or updating `global.properties.submissionDate`
- `delete-properties-template` for deleting the `global.properties` metadata template
- `delete-submission-date` for removing only `global.properties.submissionDate`

## Included

- Node runtime: `nodejs22.x`
- Module format: ESM (`"type": "module"`)
- Functions:
  - `get-box-files`
  - `box-list-users`
  - `get-submission-date`
  - `set-submission-date`
  - `delete-properties-template`
  - `delete-submission-date`
- Box API calls:
  - `client.folders.getFolderItems(folderId, params)`
  - `client.users.getUsers(params)`
  - `client.fileMetadata.getFileMetadataById(fileId, 'global', 'properties')`
  - `client.fileMetadata.createFileMetadataById(fileId, 'global', 'properties', body)`
  - `client.fileMetadata.updateFileMetadataById(fileId, 'global', 'properties', patch)`
  - `client.fileMetadata.deleteFileMetadataById(fileId, 'global', 'properties')`

## Project files

- `template.yaml` SAM template
- `src/box-client.mjs` shared Box JWT/client bootstrap
- `src/get-box-files.mjs` folder items Lambda handler
- `src/box-list-users.mjs` enterprise users Lambda handler
- `src/submission-date-common.mjs` shared metadata helper for submission date functions
- `src/get-submission-date.mjs` get metadata handler
- `src/set-submission-date.mjs` create or update metadata handler
- `src/delete-properties-template.mjs` delete template handler
- `src/delete-submission-date.mjs` delete property handler
- `events/get-box-files.json` sample invoke payload
- `events/box-list-users.json` sample invoke payload
- `events/get-submission-date.json` sample invoke payload
- `events/set-submission-date.json` sample invoke payload
- `events/delete-properties-template.json` sample invoke payload
- `events/delete-submission-date.json` sample invoke payload
- `.env.example` JWT environment variables

## Configure JWT auth

Use one auth input approach:

1. `BOX_JWT_SECRET_ARN` (recommended for AWS). Runtime fetch from AWS Secrets Manager.
2. `BOX_CONFIG_FILE` path to full Box JWT config JSON file (recommended for local dev)
3. `BOX_JWT_CONFIG_JSON`
4. `BOX_JWT_CONFIG_JSON_BASE64`
5. Individual keys (`BOX_CLIENT_ID`, `BOX_CLIENT_SECRET`, `BOX_JWT_KEY_ID`, `BOX_PRIVATE_KEY`, `BOX_PRIVATE_KEY_PASSPHRASE`, and one subject ID)

`BOX_CONFIG_FILE` notes:

- Direct local Node execution can use either a relative path like `config/box-jwt.json` or a host absolute path.
- `sam local` should be run against `template.yaml`, not `.aws-sam/build/template.yaml`, when using a local config file from `config/`.
- During `sam local`, the handler will remap a host absolute path to the mounted `/var/task/...` path when the file lives under the mounted project tree.
- A built-artifact invoke still will not see ignored local files unless you copy them into the build artifact yourself.

Optional:

- `BOX_AS_USER_ID` for as-user behavior
- `BOX_FOLDER_ID` default folder if not passed
- `BOX_TEST_FILE_ID` default file for the submission date handlers if not passed

## Create the Secrets Manager secret (recommended)

Store the full Box JWT config JSON (same shape as `config/box-jwt.json`) as the secret string.

AWS CLI:

```bash
aws secretsmanager create-secret \
  --name box/jwt/config \
  --secret-string file://path/to/box-jwt.json
```

Console (quick steps):

1. Secrets Manager → Store a new secret
2. Secret type: Other type of secret
3. Plaintext: paste the JSON config
4. Name: `box/jwt/config`
5. Create

Then deploy with the secret ARN or name:

```bash
sam deploy --guided \
  --parameter-overrides BoxJwtSecretArn=box/jwt/config
```

## Local usage

```bash
npm install
sam build
sam local invoke --template template.yaml GetBoxFilesFunction -e events/get-box-files.json
sam local invoke --template template.yaml BoxListUsersFunction -e events/box-list-users.json
sam local invoke --template template.yaml GetSubmissionDateFunction -e events/get-submission-date.json
sam local invoke --template template.yaml SetSubmissionDateFunction -e events/set-submission-date.json
sam local invoke --template template.yaml DeletePropertiesTemplateFunction -e events/delete-properties-template.json
sam local invoke --template template.yaml DeleteSubmissionDateFunction -e events/delete-submission-date.json
sam local start-api --template template.yaml
```

Call local APIs:

```bash
curl "http://127.0.0.1:3000/box/folders/0/items?limit=100&offset=0&fields=id,type,name,size"
```

```bash
curl "http://127.0.0.1:3000/box/users?user_type=managed&filter_term=example"
```

```bash
curl "http://127.0.0.1:3000/box/files/12345/metadata/submission-date"
```

```bash
curl "http://127.0.0.1:3000/box/files/12345/metadata/submission-date/set"
```

```bash
curl "http://127.0.0.1:3000/box/files/12345/metadata/properties/delete"
```

```bash
curl "http://127.0.0.1:3000/box/files/12345/metadata/submission-date/delete"
```

## Endpoints

`GET /box/folders/{folderId}/items`

- Optional query params: `limit`, `offset`, `fields`
- Fallback folder lookup order: path `folderId`, query `folderId`, `BOX_FOLDER_ID`, then `0`

`GET /box/users`

- Optional query params: `user_type`, `filter_term`
- Maps to `client.users.getUsers({ userType, filterTerm })`

`GET /box/files/{fileId}/metadata/submission-date`

- Returns the full `global.properties` metadata object when `submissionDate` is present
- Returns `404` when the properties template or `submissionDate` value is missing

`GET /box/files/{fileId}/metadata/submission-date/set`

- Uses the current UTC timestamp in RFC 3339 / ISO 8601 format
- Creates the `global.properties` template if missing
- Adds or replaces `submissionDate` when the template already exists

`GET /box/files/{fileId}/metadata/properties/delete`

- Deletes the `global.properties` metadata template
- Returns `204` on success

`GET /box/files/{fileId}/metadata/submission-date/delete`

- Removes only `submissionDate` from `global.properties`
- Returns `404` when the template or field is missing
- Returns `204` on success

## Deploy

```bash
sam build
sam deploy --guided
```
