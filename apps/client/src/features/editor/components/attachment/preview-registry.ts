import { ComponentType, ReactNode, lazy } from "react";

export interface PreviewContentProps {
  url: string;
  width: number;
  mode: "inline" | "modal";
  onOpenFullModal?: () => void;
  renderFooter?: (node: ReactNode) => void;
}

const registry = new Map<string, ComponentType<PreviewContentProps>>();

registry.set("application/pdf", lazy(() => import("./previews/pdf-preview")));
registry.set("text/plain", lazy(() => import("./previews/text-preview")));

export function getPreviewComponent(mime: string): ComponentType<PreviewContentProps> | undefined {
  return registry.get(mime);
}
