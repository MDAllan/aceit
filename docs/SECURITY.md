# ACEIT security overview

For school IT teams, privacy officers and instructors who want to know how student information is protected. It describes what is in place today, then what is planned. Last reviewed: October 2026.

## 1. How ACEIT is built

- A static web app (plain HTML, CSS and JavaScript, no build step) served over HTTPS.
- A managed Postgres database with sign-in (Supabase). There is no server code of our own to patch: all rules live in the database.
- The page loads **no third-party scripts, fonts or trackers**. A Content-Security-Policy lets the page talk only to its own origin and to the Supabase API. There is no analytics or advertising code.

## 2. What information is kept

| Information | Why |
|---|---|
| Email address and chosen display name | To log in and to show a person's name to their instructor |
| Which classes the person joined (and the school) | To show the right content and the right dashboards |
| Study progress: topics read, cards reviewed, quiz answers, games played | To resume where the student left off and to schedule revision |
| A summary of that progress: percent complete, mastery, last time ACEIT was opened | So an instructor can see how a class is doing without downloading everyone's detail |
| Feedback messages a student chooses to send | To improve the product |
| Notes, flashcards, questions, lectures, announcements and pictures that instructors add to their class | So the class can use them. Pictures are stored privately, in a folder for that class |
| Technical error reports (message, page) | To fix bugs |
| An audit trail of staff actions (who, what, when) | Accountability |

No date of birth, address, phone number, grades from the school's gradebook, photos of people or location is collected. Passwords are never visible to anyone (stored as salted hashes by the sign-in service).

## 3. Who can see what

| Role | Can see |
|---|---|
| Student | Only their own information and their own classes' content |
| Instructor | Name, email, progress and summary of the students in the classes they teach. The join code and exam date of those classes. Can add their own content to those classes |
| School manager | The same for every class in their school, plus the instructors of that school and that school's audit trail. Can create classes and invite instructors |
| Platform admin | Everything, to run the service. Can add schools, add admins, block or delete accounts |

These rules are enforced **in the database** (row level security and permission-checked functions), not just in the screens. They are checked by 190+ automated tests that run on every change against a real Postgres, including: a manager of one school cannot see another school; an instructor cannot see another instructor's class; a student cannot see anyone else; a visitor who is not logged in gets nothing; roles cannot be claimed by registering someone else's email.

## 4. Sign-in and account protection

- Email and password. The app asks for 8+ characters when a password is created (set the same minimum in the sign-in service settings).
- **Two-step login** with an authenticator app. Optional for everyone; the platform admin can **require it for instructors, school managers and admins**. When required, a staff session without the second step has no staff powers, even if the password is right (enforced in the database).
- **Roles come from invites, not from sign-up.** An invite is tied to an email address, expires after 14 days, can be cancelled, and is only applied once that email address is confirmed. People who have not signed up yet can be invited only after the platform admin has confirmed that "Confirm email" is on.
- Join codes: each class has its own random code (8 characters) or one chosen by the instructor (6+ characters), which can expire, be limited in seats, or be changed at any time. Wrong guesses are limited to 8 per 10 minutes per account.
- Staff are signed out after 30 minutes without activity.
- Sign-ups can be limited to the school's own email domains.
- Students can download their data, leave a class, or delete their account at any time.

## 5. Application security

- Strict Content-Security-Policy: scripts, styles, fonts and images only from the site itself; connections only to the site and the Supabase API; no inline scripts; no `eval`.
- All text from people (names, class names, feedback) is shown as text, never as HTML. Spreadsheet exports neutralise formulas.
- **Instructor-added content** is checked by the database with the same rules the app uses (length limits, no unexpected fields, a description for every picture, 600 items per class), and is always shown as text, never as web page code. Drafts are visible only to the class's staff; a school can require a manager's approval before anything is published. Pictures live in a private storage bucket: only the class's staff can add files (pictures only, 1 MB each, at most 400 per class), and a student can read a picture only if a published item of their own class uses it. Adding, publishing, approving and deleting are in the audit trail.
- The single third-party library (Supabase client) is bundled into the site and pinned to a version (`tools/vendor.mjs`), so a compromised CDN cannot change what runs.
- The page refuses to display inside another site's frame.
- Accessibility is checked automatically (axe-core, WCAG 2.x A and AA rules) on about 80 screens, in light and dark, on every change. This catches many but not all problems; a manual review is planned.
- One account cannot store unlimited data (size limit on progress). The audit trail cannot be edited or deleted through ACEIT by anyone, including admins.

## 6. Data location, backups and retention

- Data is stored in the Supabase project's region (confirm and record it for each deployment; a Canadian region is recommended for Canadian schools).
- Encrypted in transit (HTTPS) and at rest (managed by the database provider).
- Backups: depends on the Supabase plan. Daily backups need the Pro plan; one restore test should be done before a school goes live.
- Retention: data is kept while the account exists. Deleting an account removes the profile, progress, memberships and summaries. A school can ask for a class or all of its students to be removed.

## 7. Planned

These are planned before or during a school pilot, in this order:

1. Custom email sender and "Confirm email" on (needed for invites to new people).
2. Hosting behind Cloudflare Pages for response headers (HSTS, frame-ancestors, nosniff) on the school's own domain.
3. CAPTCHA on sign-up and password reset.
4. Written sub-processor and data-processing terms (drafts in `docs/legal/`), reviewed by a lawyer.
5. A short independent security review, and a WCAG 2.2 AA accessibility review.
6. Single sign-on with the school's Google or Microsoft accounts; later, LMS integration (LTI 1.3).
7. Automatic deletion of long-inactive accounts.

## 8. Reporting a problem

Email the address in `/.well-known/security.txt`. Please give us 90 days to fix an issue before publishing it. We will not take action against anyone who reports in good faith and does not access other people's data.
