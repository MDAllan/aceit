# Roadmap

What is built, and what comes next, in the order that matters for selling to schools. Effort is a rough guide for one developer.

## Built

- Platform admin -> schools -> school managers + instructors -> classes -> students, enforced in the database and covered by 200+ automated tests (two schools, cross-school isolation, invites, seat limits, expiry, last-admin guard, two-step login, deletion).
- Workspace screens for each role; per-class progress, hardest questions, quiet students, CSV export, exam dates, feedback; copy a class for a new term; delete a school that leaves.
- **Instructors add their own content**: questions, flashcards and notes for the course's lectures, whole lectures of their own, announcements and pictures (private storage), drafts and publishing, optional manager approval, paste-many from documents and spreadsheets, copy to a new term. The database enforces the same rules as the app and is tested against it on thousands of generated examples.
- **Account care**: a record of which Terms and Privacy Policy version each person accepted; deleting an account waits 22 days (logging in again cancels it) and a daily job then removes it for good; a customer service inbox where the platform admin answers questions inside the app; the platform admin can make a person an instructor of any class; the platform admin can edit the course lectures and their pictures, with a change history that can be undone.
- Email invites (apply only to confirmed addresses), optional two-step login (can be required for staff), staff idle sign-out, log out everywhere.
- No third-party code on the page; strict Content-Security-Policy; automated accessibility scan (WCAG 2.x A/AA) of about 80 screens in light and dark.
- Documents for schools: security overview, pitch, quick starts, pilot plan, legal drafts.

## Before the first school (owner actions, about a day in total)

1. Custom email sender, then Confirm email on. (`docs/SCHOOL-SETUP.md` steps 1 and 2)
2. Two-step login on for yourself, then required for staff. (step 3)
3. Decide the Supabase region and plan; do one backup restore test. (step 6)
4. Written permission for the slide and textbook figures, or replace them. (step 9)
5. Have a lawyer read `docs/legal/`.
6. Run `RUN-ME-4.sql`, switch on pg_cron for the daily account-removal job, and check the Supabase sign-in settings. (step 0c)

## Next, in this order

| # | Item | Why | Effort |
|---|---|---|---|
| 1 | **A shared library**: let an instructor offer questions, flashcards or whole lectures to other instructors of the same school (and later across schools), with the author credited | The next thing instructors ask for once they have written something good | 2 days |
| 2 | Import a whole question set from Word or a spreadsheet file (today: paste), and export a class's content | Saves the first-time set-up for a big course | 1 day |
| 3 | Version history for an item ("who changed what, restore the earlier wording") | Useful when several instructors share a class | 1 day |
| 4 | CAPTCHA on sign-up and password reset (Cloudflare Turnstile) | Stops bulk fake accounts | half a day plus keys |
| 5 | Roster import (CSV of emails) and bulk invite | Saves a school manager an hour per term | 1 day |
| 6 | Weekly email digest for instructors (who is quiet, hardest questions) | The feature instructors remember | 1 day (needs the email sender) |
| 7 | Single sign-on with Google and Microsoft accounts | Schools expect it | 1 day plus the school's IT |
| 8 | LMS integration (LTI 1.3 for Brightspace, Canvas, Moodle) | Opens whole universities | 1 to 2 weeks |
| 9 | Automatic deletion of long-inactive accounts and old error reports | Matches the retention policy | half a day |
| 10 | Staging project and migration files applied with the Supabase CLI | Safer releases | 1 day |

## How to keep quality while adding these

- Every new permission rule gets a test in `tools/test_sql.mjs` first (it runs against a real Postgres).
- Every new database call is checked by `tools/check_rpc.py`.
- Every new screen is added to the lists in `tools/browser/a11y.mjs` and `workspace-demo.mjs`.
- Keep the page free of third-party code; add any library through `tools/vendor.mjs`.
