import { useEffect, useState } from "react";
import { Center, Loader, Text, Code } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { PreviewContentProps } from "../preview-registry";

export default function TextPreview({ url }: PreviewContentProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);

    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.text();
      })
      .then((text) => {
        if (mounted) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [url]);

  if (loading) {
    return (
      <Center p="xl">
        <Loader size="sm" />
      </Center>
    );
  }

  if (error) {
    return (
      <Center p="xl">
        <Text c="red" size="sm">
          {t("Failed to load text file")}
        </Text>
      </Center>
    );
  }

  return (
    <Code
      block
      style={{
        whiteSpace: "pre-wrap",
        minHeight: "100%",
        border: "none",
        backgroundColor: "transparent",
        color: "inherit",
        margin: 0,
        padding: "var(--mantine-spacing-md)",
        fontSize: "var(--mantine-font-size-sm)",
      }}
    >
      {content}
    </Code>
  );
}
