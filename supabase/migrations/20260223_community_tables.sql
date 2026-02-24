-- =============================================
-- COMUNIDAD USALATINOPRIME - TABLAS + RLS
-- =============================================

-- 1. Membresías de comunidad
CREATE TABLE IF NOT EXISTS community_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'active', 'cancelled', 'past_due')),
  payment_method text CHECK (payment_method IN ('stripe', 'zelle')),
  stripe_subscription_id text,
  stripe_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. Publicaciones de la comunidad
CREATE TABLE IF NOT EXISTS community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'video', 'zoom', 'announcement')),
  title text,
  content text,
  video_url text,
  zoom_url text,
  pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Comentarios
CREATE TABLE IF NOT EXISTS community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. Reacciones
CREATE TABLE IF NOT EXISTS community_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL DEFAULT '❤️',
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- 5. Pagos Zelle (verificación manual)
CREATE TABLE IF NOT EXISTS zelle_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 25,
  screenshot_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- ÍNDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_community_memberships_user ON community_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_community_memberships_status ON community_memberships(status);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned ON community_posts(pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_type ON community_posts(type);
CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_reactions_post ON community_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_zelle_payments_status ON zelle_payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zelle_payments_user ON zelle_payments(user_id);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE community_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE zelle_payments ENABLE ROW LEVEL SECURITY;

-- Memberships: users see own, admin sees all
CREATE POLICY "Users view own membership" ON community_memberships
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin views all memberships" ON community_memberships
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin manages memberships" ON community_memberships
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role manages memberships" ON community_memberships
  FOR ALL USING (auth.role() = 'service_role');

-- Posts: active members + admin see all, admin creates
CREATE POLICY "Members view posts" ON community_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Free users view limited posts" ON community_posts
  FOR SELECT USING (
    pinned = true
    OR type = 'announcement'
  );

CREATE POLICY "Admin manages posts" ON community_posts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Comments: active members read/write, admin manages
CREATE POLICY "Members view comments" ON community_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Members create comments" ON community_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM community_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users delete own comments" ON community_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admin manages comments" ON community_comments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Reactions: active members toggle
CREATE POLICY "Members view reactions" ON community_reactions
  FOR SELECT USING (true);

CREATE POLICY "Members toggle reactions" ON community_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM community_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Members remove own reaction" ON community_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Zelle: users see own, admin sees all
CREATE POLICY "Users view own zelle" ON zelle_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users submit zelle" ON zelle_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin manages zelle" ON zelle_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role manages zelle" ON zelle_payments
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- STORAGE BUCKET para screenshots Zelle
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('zelle-screenshots', 'zelle-screenshots', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own screenshots" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'zelle-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users view own screenshots" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'zelle-screenshots'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
  );

CREATE POLICY "Admin views all screenshots" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'zelle-screenshots'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
