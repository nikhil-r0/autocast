# Autocast AI agent rules
- Never write Remotion animation with CSS transitions; use useCurrentFrame, interpolate, spring.
- Do not edit React components for content changes; edit storyboard.json.
- Run `npm run lint:storyboard` before any Kane review run.
- Kane runs: always use `--agent`, parse the final `run_end` line, never scrape human output.
- If a Kane shoot run FAILS an assertion on the product, STOP and report. Do not render.
- Fix only the failing scene or component. No whole-file rewrites.
- Max 3 shoot retries, max 4 review iterations. Then exit non-zero.
- Never commit .env, API keys, evidence packs, or rendered videos.

