# Muzik Match

Muzik Match is a static music personality quiz and discovery site. The frontend lives in `public/index.html`; Vercel Functions in `api/` provide AI song recommendations, the iTunes US chart, and a legacy YouTube lookup endpoint.

## Charts

The site renders the bundled 20-song snapshot immediately, with its source and date visible. It then requests `/api/charts?limit=20` in the background. When that request succeeds, the page shows the current iTunes US Top Songs feed and its update time. If it fails, the dated snapshot stays visible.

The chart API caches the iTunes feed for up to one hour. Songs with a verified bundled YouTube ID can play an embedded video; newer songs link to a YouTube search instead.

Playlist Shuffle keeps direct Spotify links where the playlist matches the label. Entries whose old link was missing or led to an unrelated playlist open Spotify's playlist search for that category instead. This applies to both the main page and the standalone `/playlist.html` page.

## Development checks

Run `npm test` to check matching, recommendations, Discover, chart rendering, and the chart API. The site has no build step or runtime npm dependencies.

## Configuration

Set `GEMINI_API_KEY` in Vercel for AI recommendations. `GEMINI_API_KEY_2` and `GEMINI_API_KEY_3` are optional fallback keys. `ALLOWED_ORIGINS` can contain a comma-separated list of allowed browser origins for `/api/search`; when unset, that endpoint does not emit permissive CORS headers.

The AI endpoint uses Gemini 3.6 Flash. Quiz recommendations send the matched artist, music personality, and selected music language as separate context fields; existing query-only requests remain supported.
If a recommendation request takes longer than 15 seconds, the quiz shows a retry option. Retrying or resetting the quiz cancels the previous request so older results cannot replace the current ones.

`vercel.json` sets the site's security headers, including CSP, HSTS, frame protection, and `nosniff`. API keys belong only in Vercel environment variables.
