-- Add missing RLS policies for admin/employee access to case_form_submissions
-- Previously only clients could read their own submissions, blocking Henry's dashboard

CREATE POLICY "Admin can view all submissions"
  ON case_form_submissions
  FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin can update all submissions"
  ON case_form_submissions
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Employees can view submissions"
  ON case_form_submissions
  FOR SELECT
  USING (is_employee());
