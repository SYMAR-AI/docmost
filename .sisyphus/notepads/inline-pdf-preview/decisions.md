# Decisions

## 2026-02-17 Session Start
- Library: react-pdf@10.x (bundles pdfjs-dist)
- Default mode: compact (preview: false)
- Inline page cap: 10 pages, "Show all" opens fullscreen modal
- English keys only (no Czech locale in this scope)
- Standard Mantine theme colors (NOT MND green)
- Worker config: new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)
- stopPropagation on mouse events to prevent ProseMirror interference
- useMemo on file prop to prevent infinite re-fetch
