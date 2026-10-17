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
