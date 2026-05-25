-- Supabase Auth Triggers for Auto-Profile Management
-- Run these in Supabase SQL Editor to enable automatic profile creation/updates

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_user_updated() CASCADE;
DROP FUNCTION IF EXISTS public.handle_user_deleted() CASCADE;

-- Function: Auto-create user profile when new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  SET LOCAL row_security = off;

  INSERT INTO public.users (
    id,
    email,
    name,
    is_verified,
    created_at,
    approval_status,
    role,
    is_admin
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.user_metadata->>'name', split_part(NEW.email, '@', 1)),
    TRUE,
    NOW(),
    CASE 
      WHEN NEW.email = 'vynoraautomations@gmail.com' THEN 'approved'
      ELSE 'pending'
    END,
    CASE 
      WHEN NEW.email = 'vynoraautomations@gmail.com' THEN 'admin'
      ELSE 'user'
    END,
    CASE 
      WHEN NEW.email = 'vynoraautomations@gmail.com' THEN TRUE
      ELSE FALSE
    END
  ) ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: Update profile when auth user metadata changes
CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS TRIGGER AS $$
BEGIN
  SET LOCAL row_security = off;

  UPDATE public.users
  SET
    email = NEW.email,
    name = COALESCE(NEW.user_metadata->>'name', COALESCE(name, split_part(NEW.email, '@', 1))),
    is_verified = CASE WHEN NEW.confirmed_at IS NOT NULL THEN TRUE ELSE COALESCE(is_verified, FALSE) END
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Update profile on auth user changes
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_updated();

-- Function: Mark user as deleted when auth user is deleted
CREATE OR REPLACE FUNCTION public.handle_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
  SET LOCAL row_security = off;

  DELETE FROM public.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Clean up profile on auth user deletion
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_deleted();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_user_updated() TO postgres, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_user_deleted() TO postgres, anon, authenticated, service_role;

-- Set RLS policies for public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Policy: Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Policy: Admins can read all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
CREATE POLICY "Admins can view all profiles" ON public.users
  FOR SELECT USING (is_admin = TRUE OR role = 'admin');

-- Policy: Allow service role to manage all profiles (for backend)
DROP POLICY IF EXISTS "Service role manages profiles" ON public.users;
CREATE POLICY "Service role manages profiles" ON public.users
  FOR ALL USING (current_setting('request.jwt.claims')::jsonb->>'role' = 'service_role');

-- Set RLS for other tables (if they exist)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;

-- Subscription policies
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- Security log policies (write-only for auth system)
CREATE POLICY "Service role logs security events" ON public.security_logs
  FOR INSERT WITH CHECK (current_setting('request.jwt.claims')::jsonb->>'role' = 'service_role');

-- Keyword policies
CREATE POLICY "Users can manage own keywords" ON public.keywords
  FOR ALL USING (user_id = auth.uid());

-- Refresh views (if any)
REFRESH MATERIALIZED VIEW CONCURRENTLY IF EXISTS public.user_stats;
