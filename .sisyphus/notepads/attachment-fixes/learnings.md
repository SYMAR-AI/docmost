## Learnings

### TipTap Extension Details
- Attachment extension is `atom: true`, `draggable: true` with `data-drag-handle` on the Paper header
- `atom: true` means ProseMirror treats the entire node as non-editable/non-selectable
- ProseMirror overrides `user-select` and intercepts mouse events inside atom nodes

### Styling Conventions
- Mantine UI, CSS modules (`.module.css`)
- `@mixin light {}` / `@mixin dark {}` for theming
- CSS vars: `--mantine-spacing-*`, `--mantine-color-*`, `--mantine-radius-*`

### Architecture
- `preview-registry.ts` maps MIME types to lazy components
- `PreviewShell` wraps all previews with scrollArea + footer slot
- `ResizableWrapper` is a generic resize container with handle at bottom
- `attachment-view.tsx` is the main NodeView component
