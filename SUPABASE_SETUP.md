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

### 4. Get Your API Credentials

1. Click **Settings** (gear icon) in the left sidebar
2. Click **API** in the settings menu
3. Find and copy these two values:
   - **Project URL** (looks like: `https://xxx.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)

### 5. Configure Your App

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

#### For GitHub Pages Deployment:

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add two secrets:
   - Name: `VITE_SUPABASE_URL`, Value: your project URL
   - Name: `VITE_SUPABASE_ANON_KEY`, Value: your anon key

5. Update your GitHub Actions workflow (`.github/workflows/deploy.yml`) to include:
   ```yaml
   - name: Build
     run: npm run build
     env:
       VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
       VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
   ```

6. Push to trigger a new deployment

## Verifying It Works

1. Open your app
2. Record a match result
3. Open Supabase dashboard → **Table Editor**
4. You should see:
   - `match_history` table with your match
   - `player_ratings` table with updated ratings

## Security Notes

- The **anon key** is safe to expose in client-side code
- Row Level Security (RLS) is enabled
- Current setup allows public read/write (perfect for a friend group)
- If you need private data, you can add Supabase authentication later

## Troubleshooting

### "No rows returned" after running migration
✅ This is correct! The tables are created but empty.

### Data not syncing
- Check browser console for errors
- Verify your environment variables are set correctly
- Make sure the migration SQL ran successfully

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
