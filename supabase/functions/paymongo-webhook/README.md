# PayMongo (Studio 8Teen)

## Secrets (Supabase Edge Functions)

```
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_WEBHOOK_SECRET=whsk_test_...   # signing secret from a Test webhook

Use the test key for the capstone so checkout does not charge real money.
The website copy stays like a normal studio payment and does not say “test”.

Do not put the secret key in the frontend `.env`. GCash is already enabled
(`payment_method_types` includes `gcash`). A successful payment sets the
booking to `pending` until an admin confirms it.
```

Webhook URL:

`https://<PROJECT_REF>.supabase.co/functions/v1/paymongo-webhook`

Event: `checkout_session.payment.paid`

## Deploy

```
npx supabase db push
npx supabase functions deploy create-paymongo-checkout
npx supabase functions deploy paymongo-webhook
```
