# create-guest-session

Creates or resumes a walk-in **Quick Session** guest account.

## Deploy

```bash
npx supabase functions deploy create-guest-session --no-verify-jwt
```

(`--no-verify-jwt` because guests are not authenticated yet when calling this.)

Uses `SUPABASE_SERVICE_ROLE_KEY` (auto-provided) and existing project URL.

## Request body

```json
{ "full_name": "Jane Doe", "phone": "09XXXXXXXXX", "email": "jane@email.com" }
```

## Response

Session tokens for `supabase.auth.setSession`.
