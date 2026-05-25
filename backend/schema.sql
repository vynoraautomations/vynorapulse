-- Vynora Pulse Database Schema for Supabase PostgreSQL
-- Run this in your Supabase SQL Editor to create all required tables, triggers, and indices.

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing triggers and functions if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create users profile table (mapped to auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(40) DEFAULT '',
    whatsapp_number VARCHAR(40),
    notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Career Profile details
    user_type VARCHAR(100) DEFAULT 'Student',
    user_mode VARCHAR(50) DEFAULT 'student', -- 'student' or 'professional'
    career_profile VARCHAR(255) DEFAULT 'AIML, Full Stack, Software Engineering',
    telegram_username VARCHAR(100) DEFAULT '',
    
    -- Analytics/SaaS Counters
    opportunities_tracked INTEGER DEFAULT 0,
    applications_submitted INTEGER DEFAULT 0,
    interviews_scheduled INTEGER DEFAULT 0,
    responsiveness_score INTEGER DEFAULT 92,
    spam_cleaned_count INTEGER DEFAULT 0,
    
    -- Subscription details
    selected_category VARCHAR(150) DEFAULT 'Engineering opportunities',
    subscription_plan VARCHAR(100) DEFAULT 'student-basic',
    approval_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'payment_uploaded', 'approved', 'rejected', 'suspended'
    payment_screenshot VARCHAR(500) DEFAULT '',
    is_admin BOOLEAN DEFAULT FALSE,
    role VARCHAR(40) DEFAULT 'user',
    is_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    interests VARCHAR(500) DEFAULT '',
    education_details VARCHAR(500) DEFAULT '',
    bio VARCHAR(500) DEFAULT '',
    avatar_url VARCHAR(500) DEFAULT ''
);

-- Indexing for fast queries
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON public.users(approval_status);

-- RLS policies for user profile access. The trigger functions below bypass RLS
-- for the auth bootstrap flow while authenticated users can manage their own data.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.users
    FOR SELECT USING (role = 'admin' OR is_admin = TRUE);

-- Safe upgrades for existing projects created before profile expansion.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(40) DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(40);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_type VARCHAR(100) DEFAULT 'Student';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_mode VARCHAR(50) DEFAULT 'student';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS career_profile VARCHAR(255) DEFAULT 'AIML, Full Stack, Software Engineering';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100) DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS opportunities_tracked INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS applications_submitted INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS interviews_scheduled INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS responsiveness_score INTEGER DEFAULT 92;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS spam_cleaned_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS selected_category VARCHAR(150) DEFAULT 'Engineering opportunities';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(100) DEFAULT 'student-basic';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payment_screenshot VARCHAR(500) DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role VARCHAR(40) DEFAULT 'user';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS interests VARCHAR(500) DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS education_details VARCHAR(500) DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio VARCHAR(500) DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500) DEFAULT '';

-- Create plans table
CREATE TABLE IF NOT EXISTS public.plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    amount_inr NUMERIC NOT NULL,
    period VARCHAR(20) DEFAULT 'month' NOT NULL,
    display_name VARCHAR(150) NOT NULL
);

-- Seed pricing plans
INSERT INTO public.plans (id, name, amount_inr, period, display_name) VALUES
('student-basic', 'Student Basic', 29, 'month', 'STUDENT BASIC — ₹29/month'),
('student-pro', 'Student Pro', 79, 'month', 'STUDENT PRO — ₹79/month'),
('professional', 'Professional', 99, 'month', 'PROFESSIONAL — ₹99/month'),
('business', 'Business', 199, 'month', 'BUSINESS — ₹199/month')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name, 
    amount_inr = EXCLUDED.amount_inr, 
    display_name = EXCLUDED.display_name;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    plan_slug VARCHAR(100) NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    amount NUMERIC NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- 'pending', 'approved', 'expired', 'rejected'
    approved_by_admin BOOLEAN DEFAULT FALSE,
    stripe_session_id VARCHAR(255),
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    subscription_id BIGINT REFERENCES public.subscriptions(id) ON DELETE CASCADE NOT NULL,
    provider VARCHAR(50) NOT NULL, -- 'manual', 'razorpay'
    amount NUMERIC NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    screenshot_path VARCHAR(500),
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create gmail_connections table
CREATE TABLE IF NOT EXISTS public.gmail_connections (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    gmail_email VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_uri VARCHAR(255),
    scopes TEXT,
    last_history_id VARCHAR(100),
    monitoring_enabled BOOLEAN DEFAULT TRUE,
    last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create important_emails table
CREATE TABLE IF NOT EXISTS public.important_emails (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    gmail_message_id VARCHAR(100) UNIQUE NOT NULL,
    sender VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    snippet TEXT,
    summary TEXT,
    category VARCHAR(100) DEFAULT 'Career Opportunity',
    priority VARCHAR(50) DEFAULT 'Medium',
    gmail_link VARCHAR(500),
    relevance_score INTEGER DEFAULT 85,
    urgency VARCHAR(50) DEFAULT 'Medium',
    suggested_action VARCHAR(255),
    opportunity_value VARCHAR(255),
    company VARCHAR(255),
    is_notified BOOLEAN DEFAULT FALSE,
    is_opened BOOLEAN DEFAULT FALSE,
    is_ignored BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emails_user_id ON public.important_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_message_id ON public.important_emails(gmail_message_id);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    email_id BIGINT REFERENCES public.important_emails(id) ON DELETE SET NULL,
    recipient VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'queued' NOT NULL, -- 'queued', 'sent', 'failed'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create daily_digests table
CREATE TABLE IF NOT EXISTS public.daily_digests (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    digest_text TEXT NOT NULL,
    whatsapp_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create keywords table
CREATE TABLE IF NOT EXISTS public.keywords (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    keyword VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create user_goals table
CREATE TABLE IF NOT EXISTS public.user_goals (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    goal VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create delivery_logs table
CREATE TABLE IF NOT EXISTS public.delivery_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    recipient VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'sent', 'failed'
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_user_id ON public.delivery_logs(user_id);

-- Create admin_logs table (Activity logs)
CREATE TABLE IF NOT EXISTS public.admin_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_email VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    target_user_id UUID,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create security_logs table
CREATE TABLE IF NOT EXISTS public.security_logs (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255),
    event VARCHAR(255) NOT NULL,
    ip_address VARCHAR(100),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger: Automatically insert profile when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    SET LOCAL row_security = off;

    INSERT INTO public.users (
        id, 
        name, 
        email, 
        phone_number,
        whatsapp_number, 
        user_type, 
        user_mode, 
        selected_category, 
        subscription_plan, 
        approval_status, 
        is_admin, 
        role, 
        is_verified
    )
    VALUES (
        new.id,
        coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        new.email,
        coalesce(new.raw_user_meta_data->>'phone_number', ''),
        coalesce(new.raw_user_meta_data->>'whatsapp_number', new.raw_user_meta_data->>'phone_number', ''),
        coalesce(new.raw_user_meta_data->>'user_type', 'Student'),
        coalesce(new.raw_user_meta_data->>'user_mode', 'student'),
        coalesce(new.raw_user_meta_data->>'selected_category', 'Engineering opportunities'),
        coalesce(new.raw_user_meta_data->>'subscription_plan', 'student-basic'),
        CASE WHEN new.email = 'vynoraautomations@gmail.com' THEN 'approved' ELSE 'pending' END,
        CASE WHEN new.email = 'vynoraautomations@gmail.com' THEN TRUE ELSE FALSE END,
        CASE WHEN new.email = 'vynoraautomations@gmail.com' THEN 'admin' ELSE 'user' END,
        CASE WHEN new.email = 'vynoraautomations@gmail.com' THEN TRUE ELSE FALSE END
    ) ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
