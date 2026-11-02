# Supabase Setup Guide

This guide will help you set up Supabase for persistent data storage in the QMG Teams Generator.

## Why Supabase?

Without Supabase, your data is stored in browser localStorage:
- ❌ Data lost if browser cache is cleared
- ❌ Not shared across devices
- ❌ Single player only

With Supabase:
- ✅ Permanent storage across all devices
- ✅ Shared history with your friend group
- ✅ Automatic backups
- ✅ Real-time sync

## Setup Steps

### 1. Create a Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email
4. It's **completely free** for this use case!

### 2. Create a New Project

1. Click "New Project"
2. Fill in:
   - **Name**: `cod-teams` (or whatever you prefer)
   - **Database Password**: Generate a strong password (save it somewhere safe)
   - **Region**: Choose the region closest to you
3. Click "Create new project"
4. Wait 1-2 minutes for setup to complete

### 3. Set Up the Database

1. In your Supabase project dashboard, click **SQL Editor** in the left sidebar
2. Click **New Query**
3. Open the `supabase-migration.sql` file from this repository
4. Copy and paste the entire SQL script into the query editor
5. Click **Run** (or press Ctrl/Cmd + Enter)
6. You should see "Success. No rows returned" - this is correct!

### 4. Configure Email Authentication

🔐 **Important: Authentication is required to add/delete match results!**

1. In your Supabase dashboard, click **Authentication** in the left sidebar
2. Click **Providers** tab
3. Find **Email** provider
4. Toggle it **ON** if not already enabled
5. **Important Settings:**
   - ✅ Enable email provider
   - ✅ Confirm email: **OFF** (for easier magic link experience)
   - ✅ Secure email change: **ON** (recommended)
6. Click **Save**

**Add Authorized Users:**
1. Go to **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter email addresses for your friend group
4. Click **Create user**
5. They'll receive a confirmation email

**OR** let them sign up themselves:
- They visit the site and enter their email
- They receive a magic link
- They're automatically added to the database

### 5. Get Your API Credentials

1. Click **Settings** (gear icon) in the left sidebar
2. Click **API** in the settings menu
3. Find and copy these two values:
   - **Project URL** (looks like: `https://xxx.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)

### 6. Configure Your App

#### For Local Development:

1. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. Restart your dev server:
   ```bash
   npm run dev
   ```

#### For Production (qmg.rolf.bible):

The production build reads the same `.env` on the server; `npm run deploy` bakes the
values into the bundle.

## Verifying It Works

1. Open your app
2. You'll see a **"Sign In Required"** section
3. Enter your email and click **"Send Magic Link"**
4. Check your email and click the magic link
5. You'll be redirected back to the app, now signed in
6. Select teams and record a match result
7. Open Supabase dashboard → **Table Editor**
8. You should see:
   - `match_history` table with your match
   - `player_ratings` table with updated ratings
9. Check **Authentication** → **Users** to see who's signed in

## How Authentication Works

### Magic Link Flow:
1. User enters email
2. Supabase sends email with magic link
3. User clicks link (valid for 1 hour)
4. User is automatically signed in
5. Session lasts 7 days by default

### What's Protected:
- ✅ **Public (no login):** View teams, see ratings, browse match history
- 🔒 **Authenticated only:** Record matches, delete matches, update ratings

### Managing Users:
- Anyone can request a magic link
- You can pre-add users in Supabase dashboard
- Or let people sign themselves up
- No passwords to manage!

## Security Notes

- ✅ The **anon key** is safe to expose in client-side code
- ✅ Row Level Security (RLS) protects write operations
- ✅ Only authenticated users can add/modify data
- ✅ Anyone can view data (perfect for spectators)
- 🔒 Magic links expire after 1 hour
- 🔒 Sessions expire after 7 days (users must re-authenticate)

## Troubleshooting

### "No rows returned" after running migration
✅ This is correct! The tables are created but empty.

### Data not syncing
- Check browser console for errors
- Verify your environment variables are set correctly
- Make sure the migration SQL ran successfully

### Magic link not arriving
- Check spam/junk folder
- Verify email provider is enabled in Supabase
- Check Supabase logs: **Authentication** → **Logs**
- Try a different email address

### "Permission denied" when recording match
- Make sure you're signed in (check for email display at top)
- RLS policies require authentication - sign in first
- If still failing, check Supabase logs for errors

### Session expired / keeps logging out
- Sessions last 7 days by default
- Clear browser cookies and sign in again
- Check if Supabase project is still active

### Want to reset everything?
Run this in SQL Editor:
```sql
TRUNCATE match_history, player_ratings;
```

## Fallback to localStorage

If Supabase isn't configured (no env variables), the app automatically falls back to localStorage. This means:
- The app works without Supabase (local-only)
- You can set up Supabase later without losing data
- Perfect for testing locally first

## Questions?

Check the [Supabase Documentation](https://supabase.com/docs) or open an issue in this repository.
