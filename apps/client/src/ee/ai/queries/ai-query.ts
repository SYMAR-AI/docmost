import { useMutation } from "@tanstack/react-query";

interface AiGenerateParams {
  action: string;
  prompt?: string;
  content?: string;
  onChunk?: (chunk: { content: string }) => void;
  onComplete?: () => void;
  onError?: () => void;
}

export function useAiGenerateStreamMutation() {
  return useMutation({
    mutationFn: async (_params: AiGenerateParams) => {
      _params.onError?.();
    },
  });
}
