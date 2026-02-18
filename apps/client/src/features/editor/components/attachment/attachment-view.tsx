import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Text, Paper, ActionIcon, Loader, Modal } from "@mantine/core";
import { ComponentType, ReactNode, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { getFileUrl } from "@/lib/config.ts";
import { IconDownload, IconPaperclip, IconEye, IconEyeOff, IconMaximize } from "@tabler/icons-react";
import { useDisclosure, useElementSize, useHover } from "@mantine/hooks";
import { formatBytes } from "@/lib";
import { useTranslation } from "react-i18next";
import { ResizableWrapper } from "../common/resizable-wrapper";
import { getPreviewComponent, PreviewContentProps } from "./preview-registry";
import classes from "./attachment-preview.module.css";

const MODAL_STYLES = {
  content: {
    maxHeight: "90vh",
    display: "flex" as const,
    flexDirection: "column" as const,
  },
  body: {
    flex: 1,
    overflow: "auto" as const,
    padding: 0,
    minHeight: 0,
  },
};

interface PreviewShellProps {
  Content: ComponentType<PreviewContentProps>;
  url: string;
  width: number;
  mode: "inline" | "modal";
  onOpenFullModal?: () => void;
}

function PreviewShell({ Content, url, width, mode, onOpenFullModal }: PreviewShellProps) {
  const { t } = useTranslation();
  const [footer, setFooter] = useState<ReactNode>(null);
  const footerRef = useRef<ReactNode>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Wrap setFooter in a microtask to avoid flushSync warnings from react-pdf
  const renderFooter = useCallback((node: ReactNode) => {
    footerRef.current = node;
    queueMicrotask(() => {
      setFooter(footerRef.current);
    });
  }, []);

  // Stop ProseMirror from hijacking selectstart events inside the preview
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("mousedown", stop);
    el.addEventListener("mouseup", stop);
    el.addEventListener("pointerdown", stop);
    el.addEventListener("selectstart", stop);
    return () => {
      el.removeEventListener("mousedown", stop);
      el.removeEventListener("mouseup", stop);
      el.removeEventListener("pointerdown", stop);
      el.removeEventListener("selectstart", stop);
    };
  }, []);

  const isInline = mode === "inline";

  return (
    <div
      ref={containerRef}
      className={`${classes.previewContainer}${!isInline ? ` ${classes.previewContainerModal}` : ""}`}
      contentEditable={false}
      data-preview="true"
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ userSelect: "text" }}
    >
      <div className={classes.scrollArea}>
        <Content
          url={url}
          width={width}
          mode={mode}
          onOpenFullModal={onOpenFullModal}
          renderFooter={renderFooter}
        />
      </div>
      {isInline && onOpenFullModal && (
        <ActionIcon
          className={classes.expandButton}
          variant="default"
          size="md"
          aria-label={t("Open full view")}
          onClick={onOpenFullModal}
        >
          <IconMaximize size={18} />
        </ActionIcon>
      )}
      {isInline && footer && (
        <div className={classes.footer}>
          {footer}
        </div>
      )}
    </div>
  );
}

interface ModalBodyProps {
  Content: ComponentType<PreviewContentProps>;
  url: string;
}

function ModalBody({ Content, url }: ModalBodyProps) {
  const { ref, width } = useElementSize();

  return (
    <div ref={ref} className={classes.modalBody}>
      <PreviewShell Content={Content} url={url} width={width} mode="modal" />
    </div>
  );
}

export default function AttachmentView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, selected, updateAttributes, editor } = props;
  const { url, name, size, mime, preview, previewHeight } = node.attrs;
  const { hovered, ref } = useHover();
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const { ref: sizeRef, width: containerWidth } = useElementSize();
  const handleResize = useCallback(
    (newHeight: number) => {
      updateAttributes({ previewHeight: newHeight });
    },
    [updateAttributes],
  );

  const PreviewContent = mime ? getPreviewComponent(mime) : undefined;

  return (
    <NodeViewWrapper>
      <div ref={sizeRef}>
        <Paper withBorder p="4px" ref={ref} data-drag-handle>
          <Group
            justify="space-between"
            gap="xl"
            style={{ cursor: "pointer" }}
            wrap="nowrap"
            h={25}
          >
            <Group wrap="nowrap" gap="sm" style={{ minWidth: 0, flex: 1 }}>
              {url ? (
                <IconPaperclip size={20} style={{ flexShrink: 0 }} />
              ) : (
                <Loader size={20} style={{ flexShrink: 0 }} />
              )}

              <Text component="span" size="md" truncate="end" style={{ minWidth: 0 }}>
                {url ? name : t("Uploading {{name}}", { name })}
              </Text>

              <Text component="span" size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                {formatBytes(size)}
              </Text>
            </Group>

            {url && (selected || hovered) && (
              <Group gap={4} wrap="nowrap">
                {PreviewContent && editor.isEditable && (
                  <ActionIcon
                    variant="default"
                    aria-label={preview ? t("Collapse preview") : t("Preview")}
                    onClick={() => updateAttributes({ preview: !preview })}
                  >
                    {preview ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </ActionIcon>
                )}
                <a href={getFileUrl(url)} target="_blank">
                  <ActionIcon variant="default" aria-label={t("Download attachment")}>
                    <IconDownload size={18} />
                  </ActionIcon>
                </a>
              </Group>
            )}
          </Group>
        </Paper>
        {PreviewContent && preview && url && (
          <Suspense fallback={<Loader size="sm" />}>
            <ResizableWrapper
              initialHeight={previewHeight || 400}
              minHeight={200}
              maxHeight={1200}
              onResize={handleResize}
              isEditable={editor.isEditable}
            >
              <PreviewShell
                Content={PreviewContent}
                url={getFileUrl(url)}
                width={containerWidth}
                mode="inline"
                onOpenFullModal={openModal}
              />
            </ResizableWrapper>
          </Suspense>
        )}
        {PreviewContent && url && modalOpened && (
          <Suspense fallback={null}>
            <Modal
              opened={modalOpened}
              onClose={closeModal}
              size="70%"
              centered
              title={
                <Text size="sm" fw={500}>
                  {name}
                </Text>
              }
              styles={MODAL_STYLES}
            >
              <ModalBody Content={PreviewContent} url={getFileUrl(url)} />
            </Modal>
          </Suspense>
        )}
      </div>
    </NodeViewWrapper>
  );
}
