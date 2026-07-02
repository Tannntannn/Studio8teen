# analyze-image (AI vision mood board analyzer)

## Recommended: OpenRouter (no Google AI Studio needed)

If Google AI Studio blocks your API key as "suspicious", use **OpenRouter** instead.

### Setup (about 2 minutes)

1. Go to **[openrouter.ai](https://openrouter.ai)** and sign up (email — no Google AI Studio)
2. Open **Keys** → **Create key** → copy it (starts with `sk-or-...`)
3. In terminal:

```powershell
cd C:\Users\Trist\Desktop\StudioBook
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your_key_here
supabase functions deploy analyze-image
```

4. Hard refresh admin → upload an image → should show **Analysis completed.**

Uses free vision models (`google/gemini-2.0-flash-exp:free` or `openrouter/free`).

---

## Alternative: Google Gemini direct

Only if OpenRouter doesn't work for you:

```powershell
supabase secrets set GEMINI_API_KEY=AIza...
supabase functions deploy analyze-image
```

Get key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

If Google says **"suspicious"**:
- Try a different Google account with phone verified
- Use a normal browser (not VPN)
- Or skip Google and use OpenRouter above

---

## Priority order

1. `OPENROUTER_API_KEY` (recommended)
2. `GEMINI_API_KEY`
3. `OPENAI_API_KEY` (paid)

Optional model override:
```powershell
supabase secrets set OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free
```
