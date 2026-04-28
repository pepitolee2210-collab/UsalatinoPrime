-- Log de transcripciones para auditoría + rate limit por token de cita.
-- NO guarda audio ni texto — solo metadata (tamaño, mime, duración, # chars).
-- El cliente puede transcribir hasta 30 veces/hora por token.
CREATE TABLE IF NOT EXISTS public.voice_transcriptions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  client_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  audio_size_bytes integer,
  audio_mime text,
  char_count integer,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_log_token_created
  ON public.voice_transcriptions_log (token, created_at DESC);

COMMENT ON TABLE public.voice_transcriptions_log IS
  'Log de transcripciones de voz desde el portal del cliente (/cita/[token]). Solo metadata para rate limit y auditoría — el audio y el texto NO se guardan aquí.';

ALTER TABLE public.voice_transcriptions_log ENABLE ROW LEVEL SECURITY;
-- Solo service_role accede (las inserts vienen del endpoint server con createServiceClient)
