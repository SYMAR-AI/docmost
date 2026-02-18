# Learnings

## 2026-02-17 Session Start
- Working directory for docmost-src: /Users/adam/repos/mnd/docmost-src
- Branch: techmates (our patches rebased on upstream main)
- Monorepo with pnpm workspaces
- react-pdf@10.x target, vite-plugin-static-copy for cMaps
- Server supports Range requests (206) for progressive PDF loading
- Cookie-based auth for private files, JWT query param for shared/public
- 4 existing React.lazy patterns: excalidraw, mermaid, emoji-picker, date-input
- ResizableWrapper from embed-view supports vertical resize with onResize callback
- Fullscreen modal pattern exists in drawio-view

## 2026-02-17 PDF Preview Component
- Added PDF preview component file with react-pdf worker config and CSS imports scoped to the component file.
- Build succeeded via `pnpm build` in apps/client.

## 2026-02-17 Attachment PDF Toggle
- Attachment view now lazy-loads PDF preview/full modal and toggles preview state with persisted height.
- Preview width uses useElementSize container ref; render guarded by mime + preview + url.

## 2026-02-17 QA Session - Final Results

### Bug Found & Fixed: pdfjs-dist Version Mismatch
- react-pdf@10.3.0 depends on pdfjs-dist@5.4.296, but pnpm hoisted 5.4.394 from server-side EE code
- Fix: apps/client/vite.config.ts - resolve pdfjs-dist through react-pdf's context + add Vite resolve alias
- After fix, PDF rendering works correctly

### Resize Handle Behavior
- ResizableWrapper's resize handle only appears when hovering directly over the wrapper element
- The handle div is conditionally rendered (not just CSS hidden) based on isHovered state
- Previous session misdiagnosed this as a bug — it works correctly, just needs direct hover on wrapper

### State Persistence
- preview and previewHeight attributes are properly defined in the TipTap attachment extension
- updateAttributes() persists to the document via the collaborative/saving mechanism
- Verified: preview state survives navigation away and back to the page
