import { pdfjs, Document, Page } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { useMemo, useState } from "react";
import { Center, Loader, Modal, Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { useTranslation } from "react-i18next";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface PDFFullModalProps {
  opened: boolean;
  onClose: () => void;
  url: string;
}

export default function PDFFullModal({
  opened,
  onClose,
  url,
}: PDFFullModalProps) {
  const { t } = useTranslation();
  const [numPages, setNumPages] = useState<number | null>(null);
  const { ref: sizeRef, width } = useElementSize();
  const file = useMemo(() => ({ url, withCredentials: true }), [url]);
  const options = useMemo(
    () => ({
      cMapUrl: "/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/standard_fonts/",
    }),
    [],
  );

  return (
    <Modal.Root opened={opened} onClose={onClose} fullScreen>
      <Modal.Overlay />
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>
            <Text size="sm" c="dimmed">
              {numPages
                ? t("Page {{current}} of {{total}}", {
                    current: numPages,
                    total: numPages,
                  })
                : null}
            </Text>
          </Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body
          ref={sizeRef}
          style={{ overflowY: "auto", height: "calc(100vh - 60px)" }}
        >
          <Document
            file={file}
            options={options}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={
              <Center p="xl">
                <Loader size="md" />
              </Center>
            }
            error={
              <Center p="xl">
                <Text c="red">{t("Failed to load PDF")}</Text>
              </Center>
            }
          >
            {Array.from({ length: numPages || 0 }, (_, index) => (
              <div
                key={`page-wrapper-${index + 1}`}
                style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}
              >
                <Page
                  key={`page-${index + 1}`}
                  pageNumber={index + 1}
                  width={width - 32}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </div>
            ))}
          </Document>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
