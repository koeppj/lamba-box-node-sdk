# lambda-box-node-sdk

AWS Lambda shell project for JavaScript ESM on Node 20 with one function, `get-box-files`, calling Box folder items via `box-node-sdk@^10` and JWT auth.

## Included

- Node runtime: `nodejs20.x`
- Module format: ESM (`"type": "module"`)
- Function: `get-box-files`
- Box API call: `client.folders.getFolderItems(folderId, params)`

## Project files

- `template.yaml` SAM template
- `src/get-box-files.mjs` Lambda handler
- `events/get-box-files.json` sample invoke payload
- `.env.example` JWT environment variables

## Configure JWT auth

Use one auth input approach:

1. `BOX_CONFIG_FILE` path to full Box JWT config JSON file (recommended for local dev)
2. `BOX_JWT_CONFIG_JSON`
3. `BOX_JWT_CONFIG_JSON_BASE64`
4. Individual keys (`BOX_CLIENT_ID`, `BOX_CLIENT_SECRET`, `BOX_JWT_KEY_ID`, `BOX_PRIVATE_KEY`, `BOX_PRIVATE_KEY_PASSPHRASE`, and one subject ID)

Note for `sam local`: if you use `BOX_CONFIG_FILE`, the file must exist inside the project `CodeUri` so the runtime container can read it.

Optional:

- `BOX_AS_USER_ID` for as-user behavior
- `BOX_FOLDER_ID` default folder if not passed

## Local usage

```bash
npm install
sam build
sam local invoke GetBoxFilesFunction -e events/get-box-files.json
sam local start-api
```

Call local API:

```bash
curl "http://127.0.0.1:3000/box/folders/0/items?limit=100&offset=0&fields=id,type,name,size"
```

## Deploy

```bash
sam build
sam deploy --guided
```
