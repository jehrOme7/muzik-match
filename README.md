# Muzik Match — Security Checked Build

Files in this package:

- `public/index.html` — frontend with safer Wikipedia image rendering.
- `api/search.js` — Gemini proxy with method/content-type validation, input cleanup, response normalization, basic rate limit, no-store cache.
- `api/youtube.js` — YouTube lookup endpoint with method/query validation and basic rate limit.
- `vercel.json` — security headers including CSP, HSTS, Referrer-Policy, Permissions-Policy, frame protection, and nosniff.

Optional environment variable:

```txt
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

If `ALLOWED_ORIGINS` is empty, the API does not emit permissive CORS and stays same-origin friendly.
