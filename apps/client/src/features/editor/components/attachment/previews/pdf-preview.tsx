import { pdfjs, Document, Page } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Center, Loader, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PreviewContentProps } from "../preview-registry";
import classes from "../attachment-preview.module.css";

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const PDF_OPTIONS = {
  cMapUrl: "/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/standard_fonts/",
};

const MAX_INLINE_PAGES = 10;

export default function PdfPreview({ url, width, mode, renderFooter }: PreviewContentProps) {
  const { t } = useTranslation();
  const [numPages, setNumPages] = useState<number | null>(null);
  const file = useMemo(() => ({ url, withCredentials: true }), [url]);

  const handleLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    queueMicrotask(() => setNumPages(n));
  }, []);

  const isInline = mode === "inline";
  const pagesToRender = numPages
    ? isInline ? Math.min(numPages, MAX_INLINE_PAGES) : numPages
    : 0;

  useEffect(() => {
    if (!isInline || numPages == null) {
      renderFooter?.(null);
      return;
    }
    renderFooter?.(
      <Text size="xs" c="dimmed">
        {numPages <= MAX_INLINE_PAGES
          ? t("{{count}} pages", { count: numPages })
          : t("1\u2013{{cap}} of {{total}} pages", {
              cap: MAX_INLINE_PAGES,
              total: numPages,
            })}
      </Text>,
    );
  }, [isInline, numPages, renderFooter, t]);

  return (
    <Document
      file={file}
      options={PDF_OPTIONS}
      onLoadSuccess={handleLoadSuccess}
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
        <div key={`page-${index + 1}`} className={classes.pageWrapper}>
          <Page
            pageNumber={index + 1}
            width={width}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </div>
      ))}
    </Document>
  );
}
