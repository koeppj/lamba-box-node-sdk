# AGENTS.md

## Project Summary

This repository is a small AWS SAM application that exposes two Lambda-backed API endpoints:

- `get-box-files` for listing Box folder items
- `box-list-users` for Box enterprise users

- Runtime target: Node.js 22
- Module format: ESM
- Handlers:
  - `src/get-box-files.mjs`
  - `src/box-list-users.mjs`
- Infrastructure entrypoint: `template.yaml`
- Local invoke payloads:
  - `events/get-box-files.json`
  - `events/box-list-users.json`

The Lambda uses `box-node-sdk` v10 with JWT auth and can source credentials from AWS Secrets Manager, a local config file, raw JSON, base64 JSON, or individual env vars.

## Key Files

- `src/box-client.mjs`: shared Box client/auth construction and env parsing helpers
- `src/get-box-files.mjs`: folder items Lambda handler
- `src/box-list-users.mjs`: enterprise users Lambda handler
- `template.yaml`: SAM function, API route, env vars, and optional Secrets Manager policy
- `package.json`: scripts and runtime expectations
- `README.md`: setup and usage notes
- `api-docs/openapi-v2025.0.json`: authoritative Box API reference for endpoints, parameters, schemas, and request/response details
- `api-docs/README.md`: local index for the Box Node SDK documentation added to this repo
- `api-docs/client.md`: Box client behavior, headers, interceptors, timeouts, and request patterns
- `api-docs/folders.md`: folder operations, including `client.folders.getFolderItems()`
- `.env.example`: local env variable reference
- `events/get-box-files.json`: sample event for `sam local invoke`
- `samconfig.toml`: local deploy defaults; treat values here as environment-specific

## Working Rules

- Preserve ESM module syntax unless the project is intentionally migrated.
- Keep runtime references aligned across `template.yaml`, `package.json`, and `README.md`.
- Do not commit secrets or real Box credentials. `.env` and `config/` are intentionally ignored.
- Prefer minimal changes. This repo has two small functions and one shared Box client helper.
- If you touch auth loading, preserve the current precedence order unless the change explicitly requires a breaking behavior change.
- Treat `api-docs/openapi-v2025.0.json` as the authoritative source for Box API behavior and object shapes.
- When changing any `box-node-sdk` usage, consult the local docs in `api-docs/` before making assumptions about method names, signatures, or supported patterns.
- Use `api-docs/openapi-v2025.0.json` to verify endpoint semantics, request parameters, and response schemas, then use the markdown docs as convenience references for SDK-specific method names and examples.
- Start with `api-docs/README.md`, then read only the topic docs relevant to the change. For this project, `api-docs/client.md`, `api-docs/authentication.md`, and `api-docs/folders.md` are the most likely references.

## Auth Precedence

The handler currently resolves Box JWT config in this order:

1. `BOX_JWT_SECRET_ARN`
2. `BOX_CONFIG_FILE`
3. `BOX_JWT_CONFIG_JSON`
4. `BOX_JWT_CONFIG_JSON_BASE64`
5. Individual env vars

When documenting or changing auth behavior, keep that order explicit.

## Local Config File Notes

- `BOX_CONFIG_FILE` may be relative or absolute during direct local Node execution.
- For `sam local`, prefer invoking against `template.yaml` so the project root is mounted into `/var/task`.
- The handler will try to remap a host absolute `BOX_CONFIG_FILE` path into the mounted `/var/task/...` path when running under `sam local`.
- Invoking from `.aws-sam/build/template.yaml` will still fail for ignored local config files unless they are copied into the build artifact.

## Commands

Install dependencies:

```bash
npm install
```

Run the current test command:

```bash
npm test
```

Notes:

- `npm test` currently runs `node --test`, but there are no test files yet.

Build the SAM app:

```bash
sam build
```

Invoke locally with the sample event:

```bash
sam local invoke --template template.yaml GetBoxFilesFunction -e events/get-box-files.json
sam local invoke --template template.yaml BoxListUsersFunction -e events/box-list-users.json
```

Run the local API:

```bash
sam local start-api --template template.yaml
```

Deploy:

```bash
sam deploy --guided
```

## Validation Expectations

When making code changes, prefer this validation sequence:

1. `npm test`
2. `sam build`
3. `sam local invoke --template template.yaml GetBoxFilesFunction -e events/get-box-files.json` if Box credentials are available locally
4. `sam local invoke --template template.yaml BoxListUsersFunction -e events/box-list-users.json` if Box credentials are available locally

If local Box credentials are unavailable, state that the invoke step could not be exercised end-to-end.

## Repo-Specific Notes

- `samconfig.toml` contains a concrete AWS region and secret ARN. Treat those as local/operator-specific values, not universally safe defaults.
- The repository name and SAM stack name use `lamba` rather than `lambda`. Do not mass-rename that without explicit user intent.

## Change Guidance

If you modify `src/get-box-files.mjs`, check these behaviors carefully:

- API Gateway path parameter fallback for `folderId`
- Query parsing for `limit`, `offset`, and comma-separated `fields`
- Error responses staying JSON-shaped
- Client caching behavior across Lambda invocations

If you modify `src/box-list-users.mjs`, check these behaviors carefully:

- Query parsing for `user_type` and `filter_term`
- Error responses staying JSON-shaped
- Enterprise user listing staying on `client.users.getUsers()`

If you modify `src/box-client.mjs`, check these behaviors carefully:

- Auth precedence remains unchanged
- `BOX_CONFIG_FILE` handling still works for direct local execution and `sam local`
- Client caching behavior across Lambda invocations

If you modify `template.yaml`, verify:

- Handler path still matches the source file
- Secrets Manager permissions still match `BOX_JWT_SECRET_ARN` usage
- Environment variables remain consistent with the handler
