import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";

export function useAiSearch() {
  const [streamingAnswer, setStreamingAnswer] = useState<string | null>(null);
  const [streamingSources, setStreamingSources] = useState<any[]>([]);

  const clearStreaming = useCallback(() => {
    setStreamingAnswer(null);
    setStreamingSources([]);
  }, []);

  const mutation = useMutation({
    mutationFn: async (_params: Record<string, unknown>) => {
      throw new Error("AI search is not available");
    },
  });

  return {
    ...mutation,
    streamingAnswer,
    streamingSources,
    clearStreaming,
  };
}
