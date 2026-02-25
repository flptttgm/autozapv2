import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type SignedUrlRequest = {
  bucket: string;
  path: string;
  expiresIn?: number;
};

type SignedUrlResponse = {
  signedUrl: string;
  expiresIn?: number;
};

export function useSignedMediaUrl() {
  return useMutation({
    mutationFn: async (input: SignedUrlRequest): Promise<SignedUrlResponse> => {
      const { data, error } = await supabase.functions.invoke("media-signed-url", {
        body: input,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.signedUrl) {
        throw new Error("Resposta inválida ao carregar mídia");
      }

      return data as SignedUrlResponse;
    },
  });
}
