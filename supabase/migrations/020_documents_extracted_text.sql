-- Add extracted_text column to documents for caching AI-extracted data from PDFs/images
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_text TEXT;
COMMENT ON COLUMN documents.extracted_text IS 'Text/data extracted from document by Gemini Vision. Cached to avoid re-processing.';
