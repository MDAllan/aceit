# ACEIT

Plain-language notes, flashcards, quizzes and games for several classes (ERTH 209, ASTR 207, BIOL 305), with dashboards for instructors, school managers and platform admins. A static site (no build step) hosted on GitHub Pages. Logins, class membership, progress syncing and every permission rule run on Supabase.

**Who can do what:** platform admin -> schools -> school managers + instructors -> classes -> students. Each school sees only its own people. See `docs/SECURITY.md`.

Instructors can add their own questions, flashcards, notes, whole lectures and announcements (with pictures) to their class, and a school can require a manager to approve what is published: class page > Class content. See `docs/QUICKSTART.md`.

## Add a lecture
1. Add `content/<id>.json` (copy `content/biography.json` as the template).
2. Add `"<id>"` to that course's `lectures` list in `content/subjects.json`.
3. `python tools/build_manifest.py` (CI fails if `content/manifest.json` is stale).

To add a new course, add an entry to `content/subjects.json` and a row in the `courses` table (`insert into public.courses (id, title) values ('id', 'Title');`), then license it to a school in Platform > Schools. `supabase/add-biol305.sql` does this for BIOL 305 and is a template for the next course.

## Run locally
`python -m http.server 8765` then open http://localhost:8765

Preview the staff screens with sample data (no login, no database), on localhost only:
- `http://localhost:8765/?demo&role=admin`
- `http://localhost:8765/?demo&role=manager`
- `http://localhost:8765/?demo&role=instructor`

## Backend
- New project: run `supabase/schema.sql` once in Supabase > SQL Editor, then put the project's URL and public anon key in `config.js`.
- Existing project (before schools existed): run `supabase/RUN-ME-2.sql` once. It is safe to run again. Until it is run the app keeps using the older per-course model.
- `supabase/patch6.sql` (schools) and `supabase/patch7.sql` (what instructors add, with picture storage) are the sources of `RUN-ME-2.sql`, `RUN-ME-3.sql` and of the end of `schema.sql`; `python tools/build_sql.py` keeps the copies in step. Run `RUN-ME-2.sql` and then `RUN-ME-3.sql` on an existing project.

## Checks
- `npm run check`: content checks (JSON, ids, answers, images, manifest, student-safe text), SQL copies in step, database calls match the database, logic tests, content tests (the rules for what instructors add).
- `node tools/test_sql.mjs` (and `MODE=upgrade node tools/test_sql.mjs`): 190+ database security tests on a throwaway Postgres. Install it first: `npm i --no-save embedded-postgres pg`.
- `node tools/test_sql_scale.mjs`: how fast the dashboards answer with 6,000 students in 200 classes (all under half a second).
- `node tools/vendor.mjs`: rebuilds the self-hosted Supabase client and fonts (developer only).
- CI runs all of these on every push (`.github/workflows/check.yml`).

## Documents
| File | For |
|---|---|
| `docs/SCHOOL-SETUP.md` | The site owner: installing the upgrade, email, two-step login, adding a school |
| `docs/QUICKSTART.md` | One page each for students, instructors and school managers |
| `docs/SECURITY.md` | School IT and privacy teams |
| `docs/PITCH.md`, `docs/PILOT-PLAN.md` | Talking to a school |
| `docs/legal/` | Drafts for a lawyer: privacy policy, terms, data processing agreement, sub-processors, retention, incident response |
| `docs/ROADMAP.md` | What is built and what comes next |
