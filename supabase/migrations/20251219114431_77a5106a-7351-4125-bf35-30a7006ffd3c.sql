-- Add retry columns to email_logs table
ALTER TABLE public.email_logs
ADD COLUMN retry_count integer NOT NULL DEFAULT 0,
ADD COLUMN next_retry_at timestamp with time zone DEFAULT NULL,
ADD COLUMN is_retryable boolean NOT NULL DEFAULT false;

-- Create index for efficient retry queries
CREATE INDEX idx_email_logs_retry ON public.email_logs (next_retry_at, retry_count, is_retryable) 
WHERE next_retry_at IS NOT NULL AND is_retryable = true;

-- Add comment for documentation
COMMENT ON COLUMN public.email_logs.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN public.email_logs.next_retry_at IS 'Scheduled time for next retry attempt';
COMMENT ON COLUMN public.email_logs.is_retryable IS 'Whether this failure can be retried (false for invalid emails, true for rate limits)';