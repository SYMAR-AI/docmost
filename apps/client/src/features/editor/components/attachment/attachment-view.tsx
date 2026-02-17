import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Text, Paper, ActionIcon, Loader } from "@mantine/core";
import { lazy, Suspense, useCallback } from "react";
import { getFileUrl } from "@/lib/config.ts";
import { IconDownload, IconPaperclip, IconEye, IconEyeOff } from "@tabler/icons-react";
import { useDisclosure, useElementSize, useHover } from "@mantine/hooks";
import { formatBytes } from "@/lib";
import { useTranslation } from "react-i18next";
import { ResizableWrapper } from "../common/resizable-wrapper";

const PDFPreview = lazy(() => import("./pdf-preview"));
const PDFFullModal = lazy(() => import("./pdf-full-modal"));

export default function AttachmentView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, selected, updateAttributes, editor } = props;
  const { url, name, size, mime, preview, previewHeight } = node.attrs;
  const { hovered, ref } = useHover();
  const isPdf = mime === "application/pdf";
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const { ref: sizeRef, width: containerWidth } = useElementSize();
  const handleResize = useCallback(
    (newHeight: number) => {
      updateAttributes({ previewHeight: newHeight });
    },
    [updateAttributes],
  );

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
                {isPdf && editor.isEditable && (
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
        {isPdf && preview && url && (
          <Suspense fallback={<Loader size="sm" />}>
            <ResizableWrapper
              initialHeight={previewHeight || 400}
              minHeight={200}
              maxHeight={1200}
              onResize={handleResize}
              isEditable={editor.isEditable}
            >
              <PDFPreview
                url={getFileUrl(url)}
                width={containerWidth}
                onOpenFullModal={openModal}
              />
            </ResizableWrapper>
          </Suspense>
        )}
        {isPdf && url && modalOpened && (
          <Suspense fallback={null}>
            <PDFFullModal opened={modalOpened} onClose={closeModal} url={getFileUrl(url)} />
          </Suspense>
        )}
      </div>
    </NodeViewWrapper>
  );
}
