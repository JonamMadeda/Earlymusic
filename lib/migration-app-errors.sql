CREATE TABLE IF NOT EXISTS public.app_errors (
  id          bigserial PRIMARY KEY,
  message     text NOT NULL,
  stack       text,
  path        text,
  ip          text,
  user_agent  text,
  user_id     uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_errors_created_at_idx
  ON public.app_errors (created_at DESC);

-- Nothing here references neon_auth."user": error rows must outlive the
-- account that hit them, exactly like public.auth_events.
