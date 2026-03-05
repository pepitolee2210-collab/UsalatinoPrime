-- Add residence proof documents column to cambio_corte_submissions
ALTER TABLE cambio_corte_submissions ADD COLUMN IF NOT EXISTS residence_proof_docs TEXT[] DEFAULT '{}';
