# ACEIT

Plain-language notes, flashcards, quizzes and games for several classes (ERTH 209, ASTR 207). Static site (no build step), hosted on GitHub Pages. Logins, the access code, the admin dashboard and progress syncing run on Supabase.

## Add a lecture
1. Add `content/<id>.json` (copy `content/biography.json` as the template).
2. Add `"<id>"` to that class's `lectures` list in `content/subjects.json`.

To add a new class, add an entry to `content/subjects.json` and give it a code in the Admin tab.

## Run locally
`python -m http.server 8765` then open http://localhost:8765

## Backend
Run `supabase/schema.sql` once in Supabase > SQL Editor, then put the project's anon key in `config.js`.

## Checks
- `npm run check` : content checks (JSON, ids, answers, images, manifest, student-safe text) and logic tests.
- `python tools/build_manifest.py` : rebuild `content/manifest.json` after changing any lecture (CI fails if it is stale).
- `node tools/test_sql.mjs` : database security tests on a throwaway Postgres (`npm i --no-save embedded-postgres pg` first).
- `supabase/RUN-ME.sql` : the one file to run in Supabase SQL Editor to upgrade an existing database.
- See `docs/SCHOOL-SETUP.md` for emails, custom domain, school sign-in and the pilot plan.
