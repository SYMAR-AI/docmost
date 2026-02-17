# DocMost Fork: Git Setup and EE Strategy

TechMates fork of DocMost at https://github.com/SYMAR-AI/docmost.

## Branch Strategy

| Branch | Purpose | Force-push? |
|--------|---------|-------------|
| `main` | Clean upstream mirror — never commit directly | No |
| `techmates` | Our patches rebased on top of `main` | Yes (`--force-with-lease`) |

All custom work lives on `techmates`. The `main` branch is a read-only mirror of `docmost/docmost:main`.

## Git Remotes

```
origin   → https://github.com/SYMAR-AI/docmost.git    (our fork — push here)
upstream → https://github.com/docmost/docmost.git      (official repo — pull from here)
```

## Syncing Upstream Changes

```bash
# 1. Update main to match upstream
git checkout main
git pull upstream main
git push origin main

# 2. Rebase our patches on top
git checkout techmates
git rebase main

# 3. Resolve any conflicts (see below)

# 4. Force-push the rebased branch
git push --force-with-lease origin techmates
```

### Conflict Resolution During Rebase

| Conflict type | Cause | Resolution |
|---------------|-------|------------|
| `modify/delete` in `apps/client/src/ee/ai/*` | Upstream modified licensed EE files we deleted | `git rm` the files — our stubs replace them later in the commit chain |
| `apps/server/src/ee~HEAD` artifact | Submodule→directory structural mismatch | `rm -rf` the artifact, `git rm` it |
| `pnpm-lock.yaml` | Dependency changes on both sides | Accept upstream, then `pnpm install` to regenerate |
| `docker-compose.yml` | We pin Typesense v30 | Keep our version |

After resolving: `git rebase --continue`. If it goes sideways: `git rebase --abort`.

### Dropping a Patch

If upstream fixes something we patched (e.g., the Redis `decodeURIComponent` bug), skip that commit during rebase:

```bash
git rebase --skip
```

## EE Directory Strategy

`apps/server/src/ee/` was a git submodule pointing to DocMost's licensed EE repo. We removed the submodule and replaced it with clean-room implementations.

Our `ee/` contains:
- `api-key/` — JWT-based API key creation, validation, and revocation
- `attachments-ee/` — PDF text extraction and Typesense indexing
- `typesense/` — Hybrid keyword + semantic vector search (OpenAI text-embedding-3-large)
- `ee.module.ts` — EE module registration

### Client-Side EE Stubs

`apps/client/src/ee/ai/` — minimal stub files required for the Docker build. Upstream's client imports EE AI components; our stubs provide empty/no-op implementations:

- `components/ai-search-result.tsx`
- `hooks/use-ai-search.ts`
- `pages/ai-settings.tsx`
- `queries/ai-query.ts`
- `types/ai.types.ts`

## What We Patch Outside `ee/`

Most commits only touch `ee/` and config. The exceptions:

| File | Change | Why |
|------|--------|-----|
| `apps/server/src/common/helpers/utils.ts` | `decodeURIComponent(password)` in `parseRedisUrl` | WHATWG URL parser encodes `=` as `%3D` — breaks cloud Redis AUTH with base64 keys |
| `apps/client/src/ee/hooks/use-license.tsx` | License check bypass | Returns licensed=true without calling license server |
| `apps/server/src/integrations/environment/license-check.service.ts` | License check bypass | Server-side equivalent |
| `docker-compose.yml` | Typesense v30 + OpenAI config | Local dev environment |
| `.env.example` | Additional env vars | Documents our extra config |
| `.gitattributes` | `merge=ours` for protected paths | Prevents upstream overwriting our files |
| `.gitmodules` | Removed ee submodule entry | Submodule→directory conversion |

## Upstream Core (Do Not Touch)

Everything outside the files listed above belongs to upstream:
- `apps/server/src/core/` — all upstream
- `apps/server/src/integrations/` — upstream (except `license-check.service.ts`)
- `apps/client/src/` — upstream (except `ee/hooks/use-license.tsx` and our `ee/ai/` stubs)

Upstream uses dynamic `require()` hooks to load EE modules in:
- `app.module.ts`, `search.controller.ts`, `auth.controller.ts`, `jwt.strategy.ts`, `attachment.processor.ts`

We provide implementations for these hooks without modifying the hooks themselves.

## Docker Build & Deployment

Build from `techmates` branch, push to Azure Container Registry:

```bash
az acr build --registry mndgenesisacr --image docmost:latest --file Dockerfile .
az webapp restart --name mnd-docmost-web-app --resource-group mnd-genesis
```

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `SEARCH_DRIVER=typesense` | Enables Typesense search (not database) |
| `TYPESENSE_URL` | Typesense connection URL |
| `TYPESENSE_API_KEY` | Typesense auth key |
| `OPENAI_API_KEY` | Embedding generation for Typesense |
| `AZURE_OPENAI_API_KEY` | Optional — Azure OpenAI instead of direct OpenAI |
| `AZURE_OPENAI_ENDPOINT` | Optional — Azure OpenAI endpoint |
| `REDIS_URL` | Redis connection (use raw `=` in password, not `%3D`) |
