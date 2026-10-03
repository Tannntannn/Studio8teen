# resume-guest-session

Restores an active walk-in guest login using the contact **email + phone** from the booking.

## Deploy

```bash
npx supabase functions deploy resume-guest-session --no-verify-jwt
```

## Request

```json
{ "email": "jane@email.com", "phone": "09XXXXXXXXX" }
```

## Response

Session tokens for `supabase.auth.setSession` (same shape as `create-guest-session`).
