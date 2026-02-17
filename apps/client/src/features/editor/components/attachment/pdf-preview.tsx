import { pdfjs, Document, Page } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { useMemo, useState } from "react";
import { Button, Center, Group, Loader, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";

import classes from "./pdf-preview.module.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface PDFPreviewProps {
  url: string;
  width: number;
  onOpenFullModal: () => void;
}

const MAX_INLINE_PAGES = 10;

export default function PDFPreview({
  url,
  width,
  onOpenFullModal,
}: PDFPreviewProps) {
  const { t } = useTranslation();
  const [numPages, setNumPages] = useState<number | null>(null);
  const file = useMemo(() => ({ url, withCredentials: true }), [url]);
  const options = useMemo(
    () => ({
      cMapUrl: "/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/standard_fonts/",
    }),
    [],
  );
  const pagesToRender = numPages ? Math.min(numPages, MAX_INLINE_PAGES) : 0;

  return (
    <div
      onMouseDown={(event) => event.stopPropagation()}
      className={classes.previewContainer}
    >
      <div className={classes.scrollArea}>
        <Document
          file={file}
          options={options}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <Center p="xl">
              <Loader size="sm" />
            </Center>
          }
          error={
            <Center p="xl">
              <Text c="red">{t("Failed to load PDF")}</Text>
            </Center>
          }
        >
          {Array.from({ length: pagesToRender }, (_, index) => (
            <div key={`page-wrapper-${index + 1}`} className={classes.page}>
              <Page
                key={`page-${index + 1}`}
                pageNumber={index + 1}
                width={width - 2}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </div>
          ))}
        </Document>
      </div>
      {numPages ? (
        <Group justify="space-between" className={classes.footer}>
          <Text size="sm" c="dimmed">
            {numPages <= MAX_INLINE_PAGES
              ? t("Page {{current}} of {{total}}", {
                  current: numPages,
                  total: numPages,
                })
              : t("Pages 1-{{cap}} of {{total}}", {
                  cap: MAX_INLINE_PAGES,
                  total: numPages,
                })}
          </Text>
          {numPages > MAX_INLINE_PAGES && (
            <Button variant="subtle" size="xs" onClick={onOpenFullModal}>
              {t("Show all pages")}
            </Button>
          )}
        </Group>
      ) : null}
    </div>
  );
}
