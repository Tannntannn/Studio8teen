# forgot-password

Sends password reset emails through **Resend** (not Supabase's built-in mailer).

## Setup

Replace `re_xxxxxxxxx` with your real Resend API key:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
supabase secrets set RESEND_FROM_EMAIL="Studio 8Teen <noreply@studio8teen.org>"
supabase secrets set PASSWORD_RESET_REDIRECT_URL=https://studio8teen.org/reset-password
supabase functions deploy forgot-password
```

`RESEND_FROM_EMAIL` must use a domain verified in Resend.
