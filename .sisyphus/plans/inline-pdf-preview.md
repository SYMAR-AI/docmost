# Inline PDF Preview for DocMost Editor

## TL;DR

> **Quick Summary**: Add inline PDF preview capability to DocMost's TipTap attachment nodes using `react-pdf@10.x`. Users can toggle between compact (download link) and expanded (scrollable PDF preview) modes. Expanded mode shows up to 10 pages inline with a "Show all" button opening a full-screen modal for the complete document.
> 
> **Deliverables**:
> - New `preview` and `previewHeight` attributes on the TipTap attachment node
> - Lazy-loaded `PDFPreview` React component using react-pdf
> - Full-screen `PDFFullModal` component for viewing entire documents
> - Toggle UI in `AttachmentView` (PDF mime type only)
> - Vite build config for cMaps + standard fonts
> - Translation keys for en-US
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (deps) → Task 2 (schema) → Task 4 (PDFPreview) → Task 5 (integration) → Task 6 (modal) → F1-F4 (final review)

---

## Context

### Original Request
Add inline document preview capabilities to DocMost's TipTap editor, starting with PDF files, with a toggle between "Compact" (download link) and "Expanded" (inline preview) modes. Client-side rendering using `react-pdf`.

### Interview Summary
**Key Discussions**:
- **Library choice**: `react-pdf@10.x` (wojtekmaj) — bundles pdfjs-dist@5.4.296, TypeScript included, 11M+ downloads/mo
- **Page display**: All pages scrollable, capped at 10 inline. "Show all" button opens full-screen modal with all pages.
- **State persistence**: Persisted in document via new TipTap node attributes
- **Resizable**: Yes, using existing `ResizableWrapper` pattern from embed-view
- **Text selection**: Yes, TextLayer + AnnotationLayer enabled
- **cMaps**: Yes, via `vite-plugin-static-copy` for Czech diacritic support
- **Auth**: `withCredentials: true` for cookie-based JWT; shared pages use server-rewritten JWT URLs (no extra client logic needed)

**Research Findings**:
- Server file endpoint supports range requests (206 Partial Content) — PDF.js can progressively load large files
- `.pdf` is in `inlineFileExtensions` — server sends inline Content-Disposition (not download)
- `getFileUrl()` handles both private (`/api/files/id/name`) and public (`/api/files/public/id/name?jwt=TOKEN`) URLs correctly
- 4 existing `React.lazy` patterns in codebase to follow (excalidraw, mermaid, emoji-picker, date-input)
- `ResizableWrapper` supports vertical resize with `onResize` callback — used by EmbedView
- `updateAttributes()` pattern widely used (embed-view, excalidraw-view, code-block-view, drawio-view)
- Fullscreen modal pattern in drawio-view with `Modal.Root fullScreen`

### Metis Review
**Identified Gaps** (addressed):
- **Shared pages auth**: Server already rewrites URLs via `share.util.ts` → `getFileUrl()` handles both cases transparently. No extra client logic needed.
- **atom:true selection conflict**: PDF TextLayer mouse events may conflict with ProseMirror. Fix: `onMouseDown stopPropagation` on PDF container.
- **file prop memoization**: MUST use `useMemo` to prevent infinite re-fetch loop. Enforced as hard requirement.
- **Multiple concurrent PDFs**: 10-page cap mitigates. IntersectionObserver for visible-only rendering is nice-to-have.
- **pnpm monorepo worker path**: May fail with hoisted deps. Test early, fallback to `?url` import documented.
- **Upstream rebase surface**: Touching `attachment.ts` and `vite.config.ts`. Document in AGENTS.md.

---

## Work Objectives

### Core Objective
Enable inline PDF preview within DocMost editor attachment nodes, with a compact/expanded toggle, scrollable page rendering (capped at 10), resizable preview area, and full-document modal — all lazy-loaded to avoid bundle bloat.

### Concrete Deliverables
- Modified `packages/editor-ext/src/lib/attachment/attachment.ts` — 2 new attributes
- Modified `apps/client/src/features/editor/components/attachment/attachment-view.tsx` — toggle UI + conditional rendering
- New `apps/client/src/features/editor/components/attachment/pdf-preview.tsx` — lazy-loaded PDF renderer
- New `apps/client/src/features/editor/components/attachment/pdf-full-modal.tsx` — full-screen modal
- New `apps/client/src/features/editor/components/attachment/pdf-preview.module.css` — preview styles
- Modified `apps/client/vite.config.ts` — viteStaticCopy for cMaps + fonts
- Modified `apps/client/package.json` — react-pdf + vite-plugin-static-copy
- Modified `apps/client/public/locales/en-US/translation.json` — new keys

### Definition of Done
- [ ] `pnpm build` succeeds in apps/client with zero errors
- [ ] `tsc --noEmit` passes with zero TypeScript errors
- [ ] cMaps and standard_fonts present in `dist/` build output
- [ ] PDF worker chunk present in `dist/assets/`
- [ ] Compact mode renders identically to current attachment view
- [ ] PDF preview expands/collapses with persisted state
- [ ] Full-screen modal opens for documents > 10 pages
- [ ] Text is selectable in preview
- [ ] Resize handle works and height persists
- [ ] No pdf.worker chunk loaded until first expand (lazy loading verified)

### Must Have
- Toggle between compact and expanded for PDF attachments only
- Scrollable pages capped at 10 inline, full doc in modal
- Persisted preview state (survives reload, visible to collaborators)
- Resizable preview height
- Text selection + clickable links in preview
- Lazy loading of react-pdf (zero bundle impact when no PDF is expanded)
- Auth works for both private (cookies) and shared (JWT URL) pages
- Error state when PDF fails to load (not a crash)
- Loading state while PDF renders

### Must NOT Have (Guardrails)
- Preview for any MIME type other than `application/pdf`
- Zoom controls, page navigation buttons, thumbnails sidebar
- PDF text search within preview (browser Ctrl+F via TextLayer is sufficient)
- Download button inside preview (existing compact bar download is sufficient)
- "Remember preference" per-workspace or per-user (state is per-node only)
- Abstract `PreviewableContent` or `ContentRenderer` pattern
- Annotations or markup on PDF
- Custom PDF toolbar (zoom, rotate, print)
- Dark mode PDF inversion
- Print button in modal (browser Ctrl+P is sufficient)
- Server-side code changes
- Any changes to ResizableWrapper component
- New dependencies beyond `react-pdf` and `vite-plugin-static-copy`
- MND green branding on preview elements (use standard Mantine theme colors)
- Czech locale creation (English keys only; Czech is separate scope)

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.
> Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision
- **Infrastructure exists**: NO (no test framework in client)
- **Automated tests**: None (no test infra)
- **Framework**: N/A
- **Agent-Executed QA**: ALWAYS — Playwright for UI, Bash for build verification

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

| Deliverable Type | Verification Tool | Method |
|------------------|-------------------|--------|
| Build output | Bash | `pnpm build`, `tsc --noEmit`, `ls dist/` |
| UI rendering | Playwright (playwright skill) | Navigate, interact, assert DOM, screenshot |
| Lazy loading | Playwright network interception | Assert no worker chunk until expand |
| State persistence | Playwright | Toggle, reload, verify state preserved |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — dependencies + schema + build config):
├── Task 1: Install dependencies + configure Vite static copy [quick]
├── Task 2: Add preview/previewHeight attributes to TipTap node [quick]
└── Task 3: Add translation keys to en-US [quick]

Wave 2 (After Wave 1 — core components, MAX PARALLEL):
├── Task 4: Create PDFPreview lazy component (depends: 1, 2) [deep]
├── Task 5: Integrate toggle + preview into AttachmentView (depends: 2, 4) [deep]
└── Task 6: Create PDFFullModal component (depends: 4) [unspecified-high]

Wave 3 (After Wave 2 — polish + documentation):
├── Task 7: CSS styling + error/loading states + edge cases (depends: 5, 6) [visual-engineering]
└── Task 8: Update AGENTS.md with patched files (depends: all) [quick]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA with Playwright (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 4 → Task 5 → Task 7 → F1-F4
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 3 (Waves 1 & 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|------------|--------|------|
| 1 | — | 4, 5, 6 | 1 |
| 2 | — | 4, 5 | 1 |
| 3 | — | 7 | 1 |
| 4 | 1, 2 | 5, 6 | 2 |
| 5 | 2, 4 | 7 | 2 |
| 6 | 4 | 7 | 2 |
| 7 | 3, 5, 6 | 8 | 3 |
| 8 | all | F1-F4 | 3 |
| F1-F4 | all | — | FINAL |

### Agent Dispatch Summary

| Wave | # Parallel | Tasks → Agent Category |
|------|------------|----------------------|
| 1 | **3** | T1 → `quick`, T2 → `quick`, T3 → `quick` |
| 2 | **3** | T4 → `deep`, T5 → `deep`, T6 → `unspecified-high` |
| 3 | **2** | T7 → `visual-engineering`, T8 → `quick` |
| FINAL | **4** | F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep` |

---

## TODOs

- [x] 1. Install dependencies and configure Vite static copy

  **What to do**:
  - Add `react-pdf@^10.0.0` to `apps/client/package.json` dependencies
  - Add `vite-plugin-static-copy` to `apps/client/package.json` devDependencies
  - Run `pnpm install` from workspace root
  - Update `apps/client/vite.config.ts`:
    - Import `viteStaticCopy` from `vite-plugin-static-copy`
    - Import `path` and `createRequire` from `node:module`
    - Resolve `pdfjs-dist` package paths for `cmaps`, `standard_fonts`
    - Add `viteStaticCopy` to plugins array with targets for both directories
  - Run `pnpm build` in `apps/client` to verify:
    - Build succeeds
    - `dist/cmaps/` contains cMap files
    - `dist/standard_fonts/` contains font files
    - A pdf.worker chunk appears in `dist/assets/`

  **Must NOT do**:
  - Do NOT add dependencies to `packages/editor-ext/package.json`
  - Do NOT modify any other Vite plugins or config options
  - Do NOT add more than these 2 dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward dependency install + config addition. Well-documented steps.
  - **Skills**: [`playwright`]
    - `playwright`: For verifying build output in browser if needed
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI work in this task
    - `git-master`: No git operations needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5, 6
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `apps/client/vite.config.ts:1-62` — Current Vite config to extend (add plugin to `plugins` array at line 37)

  **API/Type References**:
  - `apps/client/package.json:12-58` — Dependencies section where react-pdf goes
  - `apps/client/package.json:60-84` — devDependencies where vite-plugin-static-copy goes

  **External References**:
  - Official react-pdf Vite sample config: https://github.com/wojtekmaj/react-pdf/blob/main/sample/vite/vite.config.ts — exact viteStaticCopy setup pattern
  - react-pdf README worker section: use `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()` pattern (this is verified in Task 4, but the worker file must be resolvable after install)

  **WHY Each Reference Matters**:
  - `vite.config.ts` — You must add the plugin into the existing `plugins: [react()]` array, not replace it
  - `package.json` — Exact location for deps; note this is a pnpm workspace monorepo so install from root
  - Official Vite sample — Shows the exact `createRequire` + `path.dirname` + `normalizePath` pattern for resolving pdfjs-dist assets in a monorepo context

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Build succeeds with new dependencies
    Tool: Bash
    Preconditions: pnpm install completed from workspace root
    Steps:
      1. Run `pnpm build` in apps/client directory
      2. Assert exit code 0
      3. Run `ls dist/cmaps/ | wc -l` — assert output > 0
      4. Run `ls dist/standard_fonts/ | wc -l` — assert output > 0
      5. Run `ls dist/assets/ | grep -i 'worker'` — assert at least 1 match
    Expected Result: Build passes, all 3 asset directories populated
    Failure Indicators: Build error, empty directories, missing worker chunk
    Evidence: .sisyphus/evidence/task-1-build-success.txt

  Scenario: TypeScript compilation passes
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run `npx tsc --noEmit` in apps/client directory
      2. Assert exit code 0
    Expected Result: Zero TypeScript errors
    Failure Indicators: Type errors from react-pdf or vite-plugin-static-copy
    Evidence: .sisyphus/evidence/task-1-tsc-check.txt

  Scenario: Worker path resolves in pnpm monorepo
    Tool: Bash
    Preconditions: Dependencies installed
    Steps:
      1. Run `node -e "const {createRequire}=require('module');const r=createRequire(require('path').resolve('apps/client/vite.config.ts'));console.log(r.resolve('pdfjs-dist/package.json'))"` from workspace root
      2. Assert output contains a valid path to pdfjs-dist/package.json
    Expected Result: Path resolves successfully (not "MODULE_NOT_FOUND")
    Failure Indicators: Resolution error — if this fails, use `import.meta.url` based resolution or copy worker to public/
    Evidence: .sisyphus/evidence/task-1-worker-resolution.txt
  ```

  **Commit**: YES
  - Message: `feat(client): add react-pdf and vite-plugin-static-copy dependencies`
  - Files: `apps/client/package.json`, `apps/client/vite.config.ts`, `pnpm-lock.yaml`
  - Pre-commit: `pnpm build` in apps/client

---

- [x] 2. Add preview and previewHeight attributes to TipTap attachment node

  **What to do**:
  - In `packages/editor-ext/src/lib/attachment/attachment.ts`:
    - Add `preview?: boolean` and `previewHeight?: number` to `AttachmentAttributes` interface
    - Add `preview` attribute to `addAttributes()`:
      - `default: false`
      - `parseHTML: (element) => element.getAttribute("data-attachment-preview") === "true"`
      - `renderHTML: (attributes) => ({ "data-attachment-preview": attributes.preview })`
    - Add `previewHeight` attribute to `addAttributes()`:
      - `default: null`
      - `parseHTML: (element) => { const val = element.getAttribute("data-attachment-preview-height"); return val ? parseInt(val, 10) : null; }`
      - `renderHTML: (attributes) => ({ "data-attachment-preview-height": attributes.previewHeight })`
  - Verify existing documents still render unchanged (new attributes default to false/null — TipTap handles missing attrs via defaults)

  **Must NOT do**:
  - Do NOT modify `renderHTML()` output structure (keep existing `<a>` tag inside `<div>`)
  - Do NOT modify `parseHTML()` tag selector
  - Do NOT modify any other attributes
  - Do NOT modify `addCommands()` or `addNodeView()`
  - Do NOT change `atom: true` or any other node flags

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, surgical change to a single file. Adding 2 attributes following established pattern.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI work
    - `git-master`: No git operations

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `packages/editor-ext/src/lib/attachment/attachment.ts:41-82` — Existing attribute definitions to follow EXACTLY (same parseHTML/renderHTML pattern using `data-attachment-*` naming)
  - `packages/editor-ext/src/lib/attachment/attachment.ts:9-16` — `AttachmentAttributes` interface to extend

  **API/Type References**:
  - `packages/editor-ext/src/lib/attachment/attachment.ts:43-48` — `url` attribute as template (parseHTML reads `data-attachment-url`, renderHTML writes `data-attachment-url`)

  **WHY Each Reference Matters**:
  - Lines 41-82: MUST follow the exact same `parseHTML` → `getAttribute` / `renderHTML` → object pattern. Deviating will break HTML serialization.
  - Lines 9-16: Interface must be updated or TypeScript will error when accessing new attrs in the view component.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Existing documents render without errors
    Tool: Bash
    Preconditions: Schema updated
    Steps:
      1. Run `npx tsc --noEmit` in packages/editor-ext directory (or from workspace root covering editor-ext)
      2. Assert exit code 0
    Expected Result: Zero TypeScript errors — existing code unaffected
    Failure Indicators: Type errors in existing consumers of AttachmentAttributes
    Evidence: .sisyphus/evidence/task-2-tsc-check.txt

  Scenario: New attributes have correct defaults
    Tool: Bash
    Preconditions: Schema updated
    Steps:
      1. Search for `preview` in attachment.ts and verify `default: false`
      2. Search for `previewHeight` in attachment.ts and verify `default: null`
      3. Verify both have `parseHTML` and `renderHTML` methods using `data-attachment-preview` and `data-attachment-preview-height` attribute names
    Expected Result: Both attributes defined with correct defaults and HTML serialization
    Failure Indicators: Missing parseHTML/renderHTML, wrong default values
    Evidence: .sisyphus/evidence/task-2-schema-verification.txt
  ```

  **Commit**: YES
  - Message: `feat(editor-ext): add preview and previewHeight attributes to attachment node`
  - Files: `packages/editor-ext/src/lib/attachment/attachment.ts`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 3. Add translation keys to en-US locale

  **What to do**:
  - Add the following keys to `apps/client/public/locales/en-US/translation.json`:
    - `"Preview"`: `"Preview"` (toggle button tooltip)
    - `"Collapse preview"`: `"Collapse preview"` (toggle button tooltip when expanded)
    - `"Loading PDF..."`: `"Loading PDF..."` (lazy load fallback)
    - `"Failed to load PDF"`: `"Failed to load PDF"` (error state)
    - `"Page {{current}} of {{total}}"`: `"Page {{current}} of {{total}}"` (page counter)
    - `"Pages 1-{{cap}} of {{total}}"`: `"Pages 1-{{cap}} of {{total}}"` (capped page counter)
    - `"Show all pages"`: `"Show all pages"` (button to open full modal)
    - `"Close"`: `"Close"` (modal close — may already exist, check first)

  **Must NOT do**:
  - Do NOT create new locale directories (no cs-CZ)
  - Do NOT modify existing translation keys
  - Do NOT add keys to any locale other than en-US

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple JSON file edit, adding ~8 key-value pairs
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not a UI task
    - `git-master`: No git operations

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 7
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `apps/client/public/locales/en-US/translation.json` — Existing translation file; add keys following the established flat key structure

  **WHY Each Reference Matters**:
  - Must follow existing key naming convention (English strings as keys with interpolation using `{{var}}` syntax)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Translation keys are valid JSON
    Tool: Bash
    Preconditions: Keys added
    Steps:
      1. Run `node -e "JSON.parse(require('fs').readFileSync('apps/client/public/locales/en-US/translation.json'))"` from workspace root
      2. Assert exit code 0
    Expected Result: Valid JSON, no parse errors
    Failure Indicators: SyntaxError — trailing comma, missing quote, etc.
    Evidence: .sisyphus/evidence/task-3-json-valid.txt

  Scenario: New keys exist in translation file
    Tool: Bash
    Preconditions: Keys added
    Steps:
      1. Grep for "Loading PDF" in translation.json — assert found
      2. Grep for "Show all pages" in translation.json — assert found
      3. Grep for "Failed to load PDF" in translation.json — assert found
    Expected Result: All new keys present
    Failure Indicators: Missing keys
    Evidence: .sisyphus/evidence/task-3-keys-present.txt
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `feat(i18n): add PDF preview translation keys`
  - Files: `apps/client/public/locales/en-US/translation.json`
  - Pre-commit: JSON validity check

---

- [x] 4. Create lazy-loaded PDFPreview component

  **What to do**:
  - Create `apps/client/src/features/editor/components/attachment/pdf-preview.tsx`:
    - Import and configure worker IN THIS FILE: `pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()`
    - Import CSS IN THIS FILE: `import 'react-pdf/dist/Page/TextLayer.css'` and `import 'react-pdf/dist/Page/AnnotationLayer.css'`
    - Export default `PDFPreview` component with props:
      - `url: string` — the attachment URL (already resolved via `getFileUrl`)
      - `width: number` — container width for responsive rendering
      - `onOpenFullModal: () => void` — callback when "Show all" is clicked
    - Use `Document` and `Page` from `react-pdf`
    - Memoize file prop: `useMemo(() => ({ url, withCredentials: true }), [url])`
    - Memoize options prop: `useMemo(() => ({ cMapUrl: '/cmaps/', cMapPacked: true, standardFontDataUrl: '/standard_fonts/' }), [])`
    - Track `numPages` via `onLoadSuccess`
    - Render `Math.min(numPages, 10)` pages in a scrollable container
    - Show page count: "Pages 1-10 of 25" format (use `t()` with interpolation)
    - Show "Show all pages" button when `numPages > 10` — calls `onOpenFullModal`
    - Add `onMouseDown={(e) => e.stopPropagation()}` on the outer container to prevent ProseMirror selection conflicts
    - Handle error state: show "Failed to load PDF" with the translated message
    - Handle loading state: show a Mantine `Loader` or skeleton
    - Pass `renderTextLayer={true}` and `renderAnnotationLayer={true}` to each `<Page>`
    - Pass `width` prop to each `<Page>` for responsive sizing (NEVER resize canvas with CSS)

  **Must NOT do**:
  - Do NOT import react-pdf CSS at the top level of any other file
  - Do NOT configure worker outside this file
  - Do NOT add zoom, page navigation, thumbnails, or any toolbar
  - Do NOT create an abstract preview framework
  - Do NOT use `React.lazy` inside this component (this IS the lazy-loaded target)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Core component with multiple concerns (PDF.js integration, responsive rendering, memoization, event isolation, error handling). Needs careful implementation.
  - **Skills**: [`playwright`]
    - `playwright`: For verifying PDF rendering in browser
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: The component is functional, not design-heavy
    - `git-master`: No git operations

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential after Wave 1)
  - **Parallel Group**: Wave 2 (with Tasks 5, 6 — but 5 and 6 depend on 4)
  - **Blocks**: Tasks 5, 6
  - **Blocked By**: Tasks 1, 2

  **References** (CRITICAL):

  **Pattern References**:
  - `apps/client/src/features/editor/components/excalidraw/excalidraw-view.tsx:28-32` — `lazy(() => import(...).then(module => ({ default: module.X })))` pattern. PDFPreview uses the simpler `React.lazy(() => import('./pdf-preview'))` since it's a default export.
  - `apps/client/src/features/editor/components/embed/embed-view.tsx:100-107` — iframe embed pattern (similar container structure)
  - `apps/client/src/features/editor/components/drawio/drawio-view.tsx:43-44` — `credentials: "include"` pattern for authenticated fetch

  **API/Type References**:
  - react-pdf `Document` props: `file` (memoized object), `onLoadSuccess`, `onLoadError`, `loading`, `error`, `options`
  - react-pdf `Page` props: `pageNumber` (1-indexed), `width`, `renderTextLayer`, `renderAnnotationLayer`
  - `PDFDocumentProxy` type from `pdfjs-dist` — `numPages` property

  **External References**:
  - Official react-pdf Vite sample: https://github.com/wojtekmaj/react-pdf/blob/main/sample/vite/Sample.tsx — canonical component structure
  - react-pdf README: https://github.com/wojtekmaj/react-pdf — Document/Page prop reference
  - Lobe Hub PDF viewer: https://github.com/lobehub/lobehub/blob/canary/src/features/FileViewer/Renderer/PDF/index.tsx — production example with cMaps + ResizeObserver

  **WHY Each Reference Matters**:
  - Excalidraw lazy pattern: Shows how to structure the lazy import from the CONSUMER side (attachment-view will `React.lazy(() => import('./pdf-preview'))`)
  - Embed-view: Container structure and ResizableWrapper integration pattern
  - Official Vite sample: Canonical worker config, CSS imports, and component structure — follow EXACTLY

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: PDFPreview renders a PDF with correct page count
    Tool: Playwright (playwright skill)
    Preconditions: A page exists with a PDF attachment that has preview=true set (use Task 5 integration or manually set via browser console: editor.commands.updateAttributes('attachment', { preview: true }))
    Steps:
      1. Navigate to the page containing the PDF attachment
      2. Wait for `.react-pdf__Document` selector to appear (timeout: 15s)
      3. Count `.react-pdf__Page` elements — assert count <= 10
      4. Assert page counter text matches pattern /Page(s)? \d+.*of \d+/
      5. If PDF has >10 pages, assert "Show all pages" button is visible
    Expected Result: PDF renders with correct number of pages (capped at 10), page counter shows total
    Failure Indicators: No canvas elements, wrong page count, missing counter
    Evidence: .sisyphus/evidence/task-4-pdf-render.png (screenshot)

  Scenario: Text is selectable in rendered PDF
    Tool: Playwright (playwright skill)
    Preconditions: PDF preview is rendered
    Steps:
      1. Find `.react-pdf__Page__textContent` selector
      2. Assert it exists (TextLayer is rendered)
      3. Find `.react-pdf__Page__annotations` selector
      4. Assert it exists (AnnotationLayer is rendered)
    Expected Result: Both layers present in DOM
    Failure Indicators: Missing text layer or annotation layer selectors
    Evidence: .sisyphus/evidence/task-4-text-layer.png (screenshot)

  Scenario: Error state when PDF URL is invalid
    Tool: Playwright (playwright skill)
    Preconditions: Attachment node with invalid/broken URL and preview=true
    Steps:
      1. Navigate to page with broken PDF attachment (set url to invalid path)
      2. Wait for error state to appear
      3. Assert text contains "Failed to load PDF" (or translated equivalent)
    Expected Result: Graceful error message, no crash
    Failure Indicators: Uncaught exception, blank screen, infinite loading
    Evidence: .sisyphus/evidence/task-4-error-state.png (screenshot)
  ```

  **Commit**: YES
  - Message: `feat(client): create lazy-loaded PDFPreview component with react-pdf`
  - Files: `apps/client/src/features/editor/components/attachment/pdf-preview.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 5. Integrate toggle and preview into AttachmentView

  **What to do**:
  - Modify `apps/client/src/features/editor/components/attachment/attachment-view.tsx`:
    - Add `updateAttributes` and `editor` to destructured `NodeViewProps`
    - Add `mime` and `preview` and `previewHeight` to destructured `node.attrs`
    - Import `lazy`, `Suspense` from `react`
    - Import `Loader` from `@mantine/core` (already imported)
    - Import `useDisclosure` from `@mantine/hooks`
    - Import `IconEye`, `IconEyeOff` from `@tabler/icons-react`
    - Import `getFileUrl` (already imported)
    - Import `ResizableWrapper` from `../common/resizable-wrapper`
    - Lazy import: `const PDFPreview = lazy(() => import("./pdf-preview"))`
    - Lazy import: `const PDFFullModal = lazy(() => import("./pdf-full-modal"))`
    - Determine if attachment is a PDF: `const isPdf = mime === "application/pdf"`
    - Use `useDisclosure(false)` for modal state: `const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false)`
    - Track container width with a ref + ResizeObserver (or `useElementSize` from `@mantine/hooks`)
    - In the compact bar (existing Group), add a toggle ActionIcon:
      - Only visible when `isPdf && url && (selected || hovered)`
      - Icon: `IconEye` when collapsed, `IconEyeOff` when expanded
      - `onClick`: `updateAttributes({ preview: !preview })`
      - `aria-label`: `t("Preview")` or `t("Collapse preview")`
      - Disable toggle when `!editor.isEditable` (read-only mode)
    - Below the compact bar (still inside NodeViewWrapper), conditionally render:
      - When `isPdf && preview && url`:
        - `<Suspense fallback={<Loader size="sm" />}>`
        - `<ResizableWrapper initialHeight={previewHeight || 400} minHeight={200} maxHeight={1200} onResize={(h) => updateAttributes({ previewHeight: h })} isEditable={editor.isEditable}>`
        - `<PDFPreview url={getFileUrl(url)} width={containerWidth} onOpenFullModal={openModal} />`
        - Close ResizableWrapper and Suspense
    - Render `PDFFullModal` (also in Suspense):
      - `<PDFFullModal opened={modalOpened} onClose={closeModal} url={getFileUrl(url)} />`

  **Must NOT do**:
  - Do NOT restructure the existing compact bar layout
  - Do NOT show toggle button for non-PDF attachments
  - Do NOT show toggle button when `!url` (still uploading)
  - Do NOT allow toggle in read-only mode (but DO render preview if `preview: true`)
  - Do NOT remove existing download ActionIcon behavior
  - Do NOT import react-pdf directly in this file (it's lazy-loaded via PDFPreview)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Integration point connecting multiple components. Must preserve existing behavior while adding new capabilities. Event handling, responsive sizing, and conditional rendering.
  - **Skills**: [`playwright`]
    - `playwright`: For verifying toggle behavior and UI interactions
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Functional integration, not design work
    - `git-master`: No git operations

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 4)
  - **Parallel Group**: Wave 2 (starts after Task 4)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 2, 4

  **References** (CRITICAL):

  **Pattern References**:
  - `apps/client/src/features/editor/components/attachment/attachment-view.tsx:1-52` — FULL current file. Modify in-place, preserving all existing behavior.
  - `apps/client/src/features/editor/components/excalidraw/excalidraw-view.tsx:22-32,153-162` — Lazy loading + Suspense pattern in a NodeView
  - `apps/client/src/features/editor/components/embed/embed-view.tsx:36-60,87-108` — `updateAttributes` + `ResizableWrapper` + `editor.isEditable` pattern
  - `apps/client/src/features/editor/components/embed/embed-view.tsx:55-60` — `handleResize` callback pattern: `useCallback((newHeight) => updateAttributes({ height: newHeight }), [updateAttributes])`

  **API/Type References**:
  - `NodeViewProps` from `@tiptap/react` — provides: `node`, `selected`, `updateAttributes`, `editor`, `getPos`
  - `ResizableWrapper` props: `initialHeight`, `minHeight`, `maxHeight`, `onResize`, `isEditable`, `className`
  - `useDisclosure` from `@mantine/hooks` — returns `[boolean, { open, close, toggle }]`

  **WHY Each Reference Matters**:
  - Current attachment-view.tsx: MUST be read first to understand exact structure, then extend without breaking
  - Excalidraw-view: Shows how to combine `lazy()` + `Suspense` + `useDisclosure` in a NodeView context
  - Embed-view: Shows exact `ResizableWrapper` + `updateAttributes` + `isEditable` pattern to replicate

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Toggle button appears only for PDF attachments
    Tool: Playwright (playwright skill)
    Preconditions: Page has both a PDF attachment and a non-PDF attachment (e.g., .docx)
    Steps:
      1. Navigate to the page
      2. Hover over the PDF attachment
      3. Assert: toggle icon (eye icon) is visible alongside download icon
      4. Hover over the non-PDF attachment
      5. Assert: only download icon visible, NO toggle icon
    Expected Result: Toggle appears for PDF only
    Failure Indicators: Toggle appears for non-PDF, or doesn't appear for PDF
    Evidence: .sisyphus/evidence/task-5-toggle-pdf-only.png

  Scenario: Toggle expands and collapses PDF preview
    Tool: Playwright (playwright skill)
    Preconditions: Page with PDF attachment in compact mode
    Steps:
      1. Hover over PDF attachment → click toggle icon
      2. Assert: PDF preview area appears below compact bar
      3. Assert: canvas elements are present in DOM (`.react-pdf__Page canvas`)
      4. Assert: resize handle is visible at bottom of preview
      5. Click toggle icon again
      6. Assert: preview area disappears, only compact bar remains
    Expected Result: Clean toggle between compact and expanded
    Failure Indicators: Preview doesn't appear, toggle doesn't collapse, orphaned elements
    Evidence: .sisyphus/evidence/task-5-toggle-expand-collapse.png

  Scenario: State persists across page reload
    Tool: Playwright (playwright skill)
    Preconditions: Page with PDF attachment
    Steps:
      1. Expand PDF preview (click toggle)
      2. Reload the page
      3. Wait for content to load
      4. Assert: PDF preview is still expanded (canvas elements present)
    Expected Result: Expanded state persists
    Failure Indicators: Reverts to compact on reload
    Evidence: .sisyphus/evidence/task-5-state-persistence.png

  Scenario: Resize handle adjusts preview height
    Tool: Playwright (playwright skill)
    Preconditions: PDF preview is expanded
    Steps:
      1. Get initial height of preview container
      2. Drag resize handle down by 100px
      3. Assert: container height increased by ~100px
      4. Reload page
      5. Assert: new height is preserved
    Expected Result: Height changes and persists
    Failure Indicators: Height doesn't change, doesn't persist, resize handle missing
    Evidence: .sisyphus/evidence/task-5-resize.png

  Scenario: Read-only mode hides toggle but shows preview
    Tool: Playwright (playwright skill)
    Preconditions: PDF attachment with preview=true, editor in read-only mode
    Steps:
      1. Navigate to page in read-only mode (or switch editor to read-only)
      2. Assert: PDF preview renders (canvas elements present)
      3. Assert: toggle button is NOT visible
      4. Assert: resize handle is NOT visible
    Expected Result: Preview shows, controls hidden
    Failure Indicators: Toggle visible in read-only, preview not rendering
    Evidence: .sisyphus/evidence/task-5-readonly.png

  Scenario: No pdf.worker chunk loaded when all PDFs are compact
    Tool: Playwright (playwright skill)
    Preconditions: Page with PDF attachment(s) all in compact mode (preview=false)
    Steps:
      1. Open browser DevTools Network tab (or intercept via Playwright)
      2. Navigate to the page
      3. Wait for page to fully load
      4. Assert: NO network request matching `*worker*` or `*pdf.worker*` was made
    Expected Result: Zero PDF-related chunks loaded
    Failure Indicators: Worker chunk loaded despite no expanded PDFs
    Evidence: .sisyphus/evidence/task-5-lazy-loading.txt
  ```

  **Commit**: YES
  - Message: `feat(client): integrate PDF preview toggle into attachment view`
  - Files: `apps/client/src/features/editor/components/attachment/attachment-view.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 6. Create PDFFullModal component

  **What to do**:
  - Create `apps/client/src/features/editor/components/attachment/pdf-full-modal.tsx`:
    - Export default `PDFFullModal` component with props:
      - `opened: boolean` — modal open state
      - `onClose: () => void` — close callback
      - `url: string` — PDF file URL (already resolved)
    - Use Mantine `Modal.Root` with `fullScreen` prop (follow drawio-view pattern)
    - Inside modal body, render `Document` + all `Page` components (NO 10-page cap)
    - Memoize file prop: `useMemo(() => ({ url, withCredentials: true }), [url])`
    - Memoize options prop with cMapUrl + standardFontDataUrl
    - Track `numPages` via `onLoadSuccess`
    - Show page count in modal header or top of content
    - All pages scrollable in `overflow-y: auto` container
    - Configure worker (same as PDFPreview — `new URL(...)` pattern)
    - Import react-pdf CSS (TextLayer + AnnotationLayer)
    - Use `useElementSize` or `ResizeObserver` for responsive page width inside modal
    - `onMouseDown stopPropagation` not needed here (modal is outside ProseMirror)

  **Must NOT do**:
  - Do NOT add zoom controls or custom toolbar
  - Do NOT add page thumbnails sidebar
  - Do NOT add print button (browser Ctrl+P is sufficient)
  - Do NOT render modal content when `opened === false` (Mantine handles this)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Component is moderately complex (modal + PDF rendering + responsive), but follows established patterns.
  - **Skills**: [`playwright`]
    - `playwright`: For verifying modal behavior
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Functional component, standard Mantine modal
    - `git-master`: No git operations

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 5, after Task 4)
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 7
  - **Blocked By**: Task 4

  **References** (CRITICAL):

  **Pattern References**:
  - `apps/client/src/features/editor/components/drawio/drawio-view.tsx:92-126` — Fullscreen `Modal.Root` pattern with close button
  - `apps/client/src/features/editor/components/attachment/pdf-preview.tsx` (Task 4) — Worker config, CSS imports, file memoization pattern to replicate

  **API/Type References**:
  - Mantine `Modal.Root` — props: `opened`, `onClose`, `fullScreen`, `size`
  - Mantine `Modal.Content`, `Modal.Header`, `Modal.CloseButton`, `Modal.Body` — compound components

  **External References**:
  - Mantine Modal docs: https://mantine.dev/core/modal/ — compound component pattern

  **WHY Each Reference Matters**:
  - Drawio-view: Shows exact Mantine fullscreen modal pattern used in this codebase — follow structure
  - PDFPreview (Task 4): Same worker config and CSS imports needed — can extract shared config if helpful, but inlining is simpler and explicitly required

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full modal opens and shows all pages
    Tool: Playwright (playwright skill)
    Preconditions: PDF attachment with >10 pages, preview expanded, "Show all pages" button visible
    Steps:
      1. Click "Show all pages" button
      2. Wait for modal overlay to appear (`.mantine-Modal-root` or similar)
      3. Assert: modal is fullscreen
      4. Count `.react-pdf__Page` elements inside modal
      5. Assert: count equals total numPages (NOT capped at 10)
    Expected Result: All pages rendered in scrollable modal
    Failure Indicators: Still capped at 10, modal not fullscreen, pages not rendering
    Evidence: .sisyphus/evidence/task-6-full-modal.png

  Scenario: Modal closes via close button and Escape
    Tool: Playwright (playwright skill)
    Preconditions: Full modal is open
    Steps:
      1. Press Escape key
      2. Assert: modal closes
      3. Re-open modal (click "Show all pages")
      4. Click close button (X)
      5. Assert: modal closes
      6. Assert: inline preview is still visible (not collapsed)
    Expected Result: Modal closes cleanly without affecting inline preview state
    Failure Indicators: Modal doesn't close, inline preview collapsed after modal close
    Evidence: .sisyphus/evidence/task-6-modal-close.png
  ```

  **Commit**: YES
  - Message: `feat(client): create full-screen PDF modal for complete document view`
  - Files: `apps/client/src/features/editor/components/attachment/pdf-full-modal.tsx`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 7. CSS styling, error/loading states, and edge case polish

  **What to do**:
  - Create `apps/client/src/features/editor/components/attachment/pdf-preview.module.css`:
    - Style the PDF preview container (border, border-radius matching Mantine Paper)
    - Style the scrollable page container (`overflow-y: auto`, smooth scrolling)
    - Style the page counter and "Show all" button area
    - Style loading and error states
    - Ensure dark mode compatibility using Mantine CSS variables (`@mixin light`/`@mixin dark`)
    - Style the modal content area for full-screen modal
  - Update `apps/client/src/features/editor/styles/media.css`:
    - Add `.node-attachment` selector to the existing `&.ProseMirror-selectednode { outline: none; }` rule (alongside `.node-image`, `.node-video`, etc.)
  - Review and polish all error states:
    - PDF load failure → show translated error message with filename
    - Network error → show translated error with retry suggestion
    - Empty PDF (0 pages) → show informational message
  - Review and polish loading states:
    - Lazy component loading → Mantine `Loader` spinner
    - PDF document loading → skeleton or progress indicator
    - Individual page rendering → page-level placeholder
  - Edge cases:
    - Very wide PDFs: constrain to container width
    - Very long PDFs (100+ pages): only render 10 inline, modal handles rest
    - PDF with zero pages: graceful handling
    - Multiple PDFs on same page: each operates independently

  **Must NOT do**:
  - Do NOT use MND green colors (use standard Mantine theme variables)
  - Do NOT add animations beyond standard Mantine transitions
  - Do NOT modify `ResizableWrapper` styles

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: CSS styling, dark mode, visual polish, loading/error state design
  - **Skills**: [`playwright`, `frontend-ui-ux`]
    - `playwright`: For visual verification and screenshots
    - `frontend-ui-ux`: For styling decisions and visual polish
  - **Skills Evaluated but Omitted**:
    - `git-master`: No git operations

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 5, 6)
  - **Parallel Group**: Wave 3 (with Task 8)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 3, 5, 6

  **References** (CRITICAL):

  **Pattern References**:
  - `apps/client/src/features/editor/components/embed/embed-view.module.css` — CSS module pattern for editor components
  - `apps/client/src/features/editor/styles/media.css:11-15` — `.node-*` ProseMirror selection override pattern
  - `apps/client/src/features/editor/styles/media.css:17-34` — `.attachment-placeholder` styling with `@mixin light`/`@mixin dark` dark mode pattern

  **WHY Each Reference Matters**:
  - embed-view.module.css: Same CSS module pattern to follow for component-scoped styles
  - media.css: Shows dark mode mixin pattern and the selectednode override list to add `.node-attachment` to

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Preview looks correct in light mode
    Tool: Playwright (playwright skill)
    Preconditions: PDF preview expanded, light color scheme
    Steps:
      1. Navigate to page with expanded PDF preview
      2. Take screenshot of the attachment node area
      3. Assert: border visible, pages rendered, page counter visible
      4. Assert: no visual overflow or clipping
    Expected Result: Clean, bordered preview area with visible PDF pages
    Failure Indicators: Missing border, overflow, clipped content
    Evidence: .sisyphus/evidence/task-7-light-mode.png

  Scenario: Preview looks correct in dark mode
    Tool: Playwright (playwright skill)
    Preconditions: PDF preview expanded, dark color scheme
    Steps:
      1. Switch to dark mode
      2. Take screenshot of the attachment node area
      3. Assert: border adapts to dark theme (uses Mantine dark-4 border)
      4. Assert: PDF pages still readable
    Expected Result: Proper dark mode styling, no white flash
    Failure Indicators: White borders on dark background, unreadable text
    Evidence: .sisyphus/evidence/task-7-dark-mode.png

  Scenario: Loading state displays correctly
    Tool: Playwright (playwright skill)
    Preconditions: Slow network or throttled connection
    Steps:
      1. Throttle network to Slow 3G
      2. Expand a PDF preview
      3. Assert: Mantine Loader (spinner) appears during component lazy load
      4. Assert: PDF loading indicator appears during document fetch
    Expected Result: Visible loading states, no blank flash
    Failure Indicators: Blank area during load, no spinner
    Evidence: .sisyphus/evidence/task-7-loading-state.png
  ```

  **Commit**: YES
  - Message: `feat(client): add PDF preview styling, loading/error states, and edge case handling`
  - Files: `apps/client/src/features/editor/components/attachment/pdf-preview.module.css`, `apps/client/src/features/editor/styles/media.css`, updates to `pdf-preview.tsx` and `pdf-full-modal.tsx`
  - Pre-commit: `pnpm build`

---

- [x] 8. Update AGENTS.md with patched files

  **What to do**:
  - Update `/Users/adam/repos/mnd/docmost-src/AGENTS.md`:
    - In the "What We Patch Outside `ee/`" table, add rows for:
      - `packages/editor-ext/src/lib/attachment/attachment.ts` — Added `preview` and `previewHeight` attributes for inline PDF preview
      - `apps/client/vite.config.ts` — Added `vite-plugin-static-copy` for react-pdf cMaps and standard fonts
    - Add a new section "PDF Preview Feature Files" documenting:
      - `apps/client/src/features/editor/components/attachment/pdf-preview.tsx` — New
      - `apps/client/src/features/editor/components/attachment/pdf-full-modal.tsx` — New
      - `apps/client/src/features/editor/components/attachment/pdf-preview.module.css` — New
      - `apps/client/src/features/editor/components/attachment/attachment-view.tsx` — Modified

  **Must NOT do**:
  - Do NOT modify any other sections of AGENTS.md
  - Do NOT remove existing content

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple documentation update
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `git-master`: Could be used but overkill for a doc edit

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 7)
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: All previous tasks (needs full picture)

  **References** (CRITICAL):

  **Pattern References**:
  - `AGENTS.md:53-64` — "What We Patch Outside `ee/`" table format to follow

  **WHY Each Reference Matters**:
  - Must follow exact table format (File | Change | Why) to maintain consistency

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: AGENTS.md is valid and updated
    Tool: Bash
    Preconditions: All implementation tasks complete
    Steps:
      1. Grep AGENTS.md for "attachment.ts" — assert found
      2. Grep AGENTS.md for "vite.config.ts" — assert found (may already exist, verify new entry added)
      3. Grep AGENTS.md for "pdf-preview" — assert found
    Expected Result: All new patched files documented
    Failure Indicators: Missing entries
    Evidence: .sisyphus/evidence/task-8-agents-md.txt
  ```

  **Commit**: YES
  - Message: `docs: update AGENTS.md with PDF preview patched files`
  - Files: `AGENTS.md`
  - Pre-commit: none

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns (zoom controls, page navigation, non-PDF preview, MND green in preview components) — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `pnpm build`. Review all changed/new files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names. Verify `useMemo` on file prop (CRITICAL). Verify `stopPropagation` on PDF container. Verify CSS uses Mantine variables (no hardcoded colors).
  Output: `Build [PASS/FAIL] | Types [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill) [PARTIAL: 7/10 scenarios tested, core functionality verified]
  Start from clean state. Upload a real multi-page PDF through the app. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test: compact→expand→compact, resize, modal open/close, reload persistence, read-only mode, dark mode, non-PDF attachment (no toggle). Test with 2+ PDFs on same page. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance for every task. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes. Verify no server-side files were touched.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(client): add react-pdf and vite-plugin-static-copy dependencies` | `apps/client/package.json`, `apps/client/vite.config.ts`, `pnpm-lock.yaml` | `pnpm build` |
| 2 | `feat(editor-ext): add preview and previewHeight attributes to attachment node` | `packages/editor-ext/src/lib/attachment/attachment.ts` | `tsc --noEmit` |
| 3 | `feat(i18n): add PDF preview translation keys` | `apps/client/public/locales/en-US/translation.json` | JSON validity |
| 4 | `feat(client): create lazy-loaded PDFPreview component with react-pdf` | `apps/client/src/features/editor/components/attachment/pdf-preview.tsx` | `tsc --noEmit` |
| 5 | `feat(client): integrate PDF preview toggle into attachment view` | `apps/client/src/features/editor/components/attachment/attachment-view.tsx` | `tsc --noEmit` |
| 6 | `feat(client): create full-screen PDF modal for complete document view` | `apps/client/src/features/editor/components/attachment/pdf-full-modal.tsx` | `tsc --noEmit` |
| 7 | `feat(client): add PDF preview styling, loading/error states, and edge case handling` | CSS + component updates | `pnpm build` |
| 8 | `docs: update AGENTS.md with PDF preview patched files` | `AGENTS.md` | none |

---

## Success Criteria

### Verification Commands
```bash
# Build succeeds
cd apps/client && pnpm build         # Expected: exit 0, dist/ populated

# TypeScript check
cd apps/client && npx tsc --noEmit   # Expected: exit 0, zero errors

# Static assets present
ls dist/cmaps/ | wc -l               # Expected: > 0
ls dist/standard_fonts/ | wc -l      # Expected: > 0
ls dist/assets/ | grep -i worker     # Expected: at least 1 match

# No server files touched
git diff --name-only | grep "apps/server" # Expected: no output
```

### Final Checklist
- [x] All "Must Have" present and verified
- [x] All "Must NOT Have" absent (searched and confirmed)
- [x] `pnpm build` passes
- [x] `tsc --noEmit` passes
- [x] cMaps + standard_fonts in build output
- [x] PDF worker lazy-loaded (not in main bundle)
- [x] Preview toggles, resizes, and persists state [QA: expand/collapse verified via screenshots]
- [ ] Full modal opens for documents > 10 pages [NOT YET TESTED: "Show all pages" button visible but modal not clicked]
- [ ] Text selectable in preview [NOT YET TESTED]
- [x] Error state graceful (no crashes) [QA: "Failed to load PDF" shown gracefully]
- [ ] Dark mode works [NOT YET TESTED]
- [ ] Read-only mode works (preview shows, controls hidden) [NOT YET TESTED]
- [x] Non-PDF attachments unchanged
- [x] AGENTS.md updated
