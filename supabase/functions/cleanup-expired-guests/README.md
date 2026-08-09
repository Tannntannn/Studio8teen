# cleanup-expired-guests

Deletes unclaimed guest profiles whose `guest_expires_at` is in the past.

## Setup

```bash
npx supabase secrets set CLEANUP_SECRET=your-long-random-secret
npx supabase functions deploy cleanup-expired-guests --no-verify-jwt
```

## Call (schedule daily)

```bash
curl -X POST "https://<project>.supabase.co/functions/v1/cleanup-expired-guests" \
  -H "x-cleanup-secret: your-long-random-secret"
```

Or hit with `?secret=your-long-random-secret`.

Recommended: Supabase scheduled trigger, GitHub Action cron, or any uptime ping once per day.
