# Problems

(No problems yet)

## 2026-02-17 QA - Critical Bug (Fixed)
- **pdfjs-dist version mismatch**: Worker version 5.4.394 != API version 5.4.296
- Root cause: pnpm hoisting server-side pdfjs-dist over react-pdf's dependency
- Fix: Vite resolve alias + createRequire resolution through react-pdf context
- Status: FIXED in apps/client/vite.config.ts
