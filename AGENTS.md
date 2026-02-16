# DocMost Fork: Git Setup and EE Strategy

This document outlines the special git configuration and directory strategy for this DocMost fork. It focuses on the clean-room reimplementation of Enterprise Edition features.

## Git Remotes
Both origin and upstream point to the public DocMost repository at https://github.com/docmost/docmost.git. There's no private fork at this time. All work happens on the local main branch, which has diverged from the upstream.

## EE Directory Strategy
The path apps/server/src/ee/ was once a git submodule pointing to the licensed DocMost EE repository. We removed the submodule and converted it into a regular directory. This change involved clearing .gitmodules and ensuring the git index tracks the folder as a normal tree.

Our version of the ee directory contains only:
- api-key/
- attachments-ee/
- typesense/
- ee.module.ts

## .gitattributes merge=ours Strategy
The .gitattributes file at the repository root uses the merge=ours strategy to protect specific paths from upstream changes.

Protected paths include:
- apps/server/src/ee/** (our EE reimplementation)
- apps/client/src/ee/hooks/use-license.tsx (client license bypass)
- apps/server/src/integrations/environment/license-check.service.ts (server license bypass)
- docker-compose.yml (Typesense v30 config)
- .env.example (environment template)
- .gitattributes (self-protection)

The git configuration must have the merge driver enabled:
git config merge.ours.driver true

This strategy only works when both sides modify the same file. It won't handle cases where one side deletes a file while the other modifies it. It also doesn't solve structural conflicts between submodules and directories or handle new upstream files that don't exist in our branch.

## How to Pull Upstream Changes
Follow these steps to merge upstream updates:

1. git fetch upstream
2. Run git merge upstream/main --no-ff --no-edit
3. Resolve conflicts. You may see the following:
   - Deleted files in apps/client/src/ee/ai/* if upstream modified them. Use git rm to remove these files.
   - Artifacts like apps/server/src/ee~upstream_main. Delete the folder and use git rm on it.
   - Conflicts in package.json or pnpm-lock.yaml. Keep our typesense version (^3.0.1) and accept other upstream changes.
4. Commit the merge after resolution.
5. Execute pnpm install and pnpm run build in apps/server/ to verify the build.

The submodule pointer conflict for apps/server/src/ee was a one-time issue and shouldn't reappear.

## What We Must Never Touch (Upstream Core)
Files outside apps/server/src/ee/ belong to the upstream codebase. While environment.service.ts and environment.validation.ts reference Gemini, that's upstream code. The apps/server/src/core/ directory is also entirely upstream.

Upstream core uses five dynamic require() hooks to load EE modules. These are located in:
- app.module.ts
- search.controller.ts
- auth.controller.ts
- jwt.strategy.ts
- attachment.processor.ts

We provide implementations for these hooks without modifying the hooks themselves.

## Our EE Features
- Typesense hybrid search: Located in ee/typesense/. It supports keyword and semantic vector search using OpenAI text-embedding-3-large embeddings.
- API keys: Located in ee/api-key/. This feature handles JWT-based API key creation, validation, and revocation.
- PDF attachment search: Located in ee/attachments-ee/. It uses pdf-parse for text extraction and indexes the content in Typesense.
- AI queue no-op: Found in ee/typesense/processors/ai-queue-noop.processor.ts. This drains jobs from the AI_QUEUE since the Gemini module was removed.

## Key Environment Variables
- OPENAI_API_KEY: Typesense uses this to generate embeddings.
- SEARCH_DRIVER=typesense: Enables the Typesense search path.
- TYPESENSE_URL and TYPESENSE_API_KEY: Connection details for Typesense.
- AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT: Optional variables to use Azure OpenAI instead of direct OpenAI for embeddings.
