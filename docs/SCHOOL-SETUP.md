# ACEIT setup guide for the site owner

Things only you can do, because they need your accounts. Do them in this order. Each takes 5 to 15 minutes.

## 0. Install the schools upgrade (once)

1. Open Supabase > SQL Editor > New query.
2. Paste the whole of `supabase/RUN-ME-2.sql` and press Run. It must say "Success". It is safe to run again.
3. Open ACEIT, log out and log in again. A new tab appears at the bottom: **Platform** (you are the platform admin).

What the upgrade does: adds schools, school managers, instructors, classes, invites and progress summaries; turns your existing ERTH 209 and ASTR 207 into two classes of a school called **ACEIT Direct**, keeping their codes, students, instructors and exam dates; and tightens a few rules (the audit log can no longer be edited, class codes are unique, one account cannot store huge amounts of data). Nobody is logged out, and until you run it the site keeps working exactly as before.

Check it worked (2 minutes):
1. Platform > Schools shows **ACEIT Direct** with 2 classes and your existing students.
2. Open its ASTR 207 class: the join code is the one you had before, and the roster lists the students who had joined.
3. Log in as a student: they still see their class, and Profile > My classes shows it under "ACEIT Direct".

If something looks wrong, tell the developer which screen and what you saw. Do not delete tables.

## 0a. Let instructors add their own content (once)

Instructors and school managers can add their own notes, flashcards, questions, whole lectures and announcements to a class, with pictures. Students see an item only after it is published, and the course's own material is never changed.

1. Supabase > SQL Editor > New query. Paste the whole of `supabase/RUN-ME-3.sql` and press Run. Run it after step 0. It must say "Success". It is safe to run again.
2. It creates the storage for pictures: a **private** bucket called `class-media`. Check Supabase > Storage: it should be listed and marked private. Only a class's staff can add pictures, and a student can only read a picture that a published item of their own class uses.
3. Open ACEIT as an instructor or manager. The class page now has a **Class content** card. A school can ask a manager to approve what instructors publish (School > Approvals).

Until you run it nothing changes: the Class content screens just say the upgrade is not installed. A school that stops using ACEIT can be removed completely from Platform > Schools > (school) > Settings > Delete this school; that also removes its pictures.

## 0b. Add the BIOL 305 (Human Biology) course and its class (once)

1. Supabase > SQL Editor > New query. Paste the whole of `supabase/add-biol305.sql` and press Run. It must say "Success". It is safe to run again, and it works both before and after step 0.
2. Students join with the code **Ace305**. Before step 0 (the older model) it must be typed exactly like that, capital A included. After step 0 capital letters do not matter.
3. When you run step 0, BIOL 305 and the students who already joined it are carried over, like ERTH 209 and ASTR 207. Afterwards the course is licensed to **ACEIT Direct** and its class is there. For another school, tick BIOL 305 in Platform > Schools > (school) > Settings and create a class for it.
4. Once the new site version is live, open Platform > Content and press **Publish content to the database** again so the new lectures (the biology course and the geology deformation lecture) are protected like the others.

## 0c. Account deletion, questions, terms and admin tools (once)

1. Supabase > SQL Editor > New query. Paste the whole of `supabase/RUN-ME-4.sql` and press Run. Run it after steps 0 and 0a (`RUN-ME-2.sql` and `RUN-ME-3.sql`). It must say "Success". It is safe to run again.
2. What it adds:
   - **A record of acceptance.** When someone agrees to the Terms of Use and Privacy Policy, ACEIT keeps which version they agreed to and when. You and the person can see it; nobody can change it.
   - **Deleting an account waits 22 days.** The person asks to delete; nothing is removed yet. If they log in again within 22 days the request is cancelled and everything is back as it was. After 22 days a daily job removes the account for good: the profile, progress and class memberships. Admin accounts are never removed this way. The job needs a Supabase extension called pg_cron (next paragraph).
   - **A customer service inbox.** Students and staff send a question from the app (up to 5 a day each). Only you, the platform admin, can read them. You mark each one open, answered or closed and can add a note; the person sees your note and the status in the app, so no email is needed.
   - **Instructor tools for you.** You can make any confirmed person an instructor of any class, see which classes a person teaches, and take the role away again.
   - **Editing the course lectures.** You can change a lecture's text and add pictures to it. Every save keeps the version it replaced (the newest 100 per lecture) and any change can be undone. Pictures go in a **private** bucket called `course-media`: check Supabase > Storage, it should be listed and marked private. Only you can add pictures; people who may read the course can see them.
3. **The daily job (pg_cron).** The patch tries to switch it on by itself. If the SQL Editor shows a notice that says the daily job "could not be set up", do this once:
   1. Supabase > Database > Extensions > search for **pg_cron** > turn it on.
   2. In the SQL Editor run this one line: `select cron.schedule('aceit-purge-deleted-accounts', '17 3 * * *', 'select public.purge_deleted_accounts()');`
   3. Check it with `select jobname, schedule from cron.job;`. It should list `aceit-purge-deleted-accounts`.

   Until the job exists nobody is removed automatically; the accounts just keep waiting.
4. **Supabase sign-in settings to check** (Supabase > Authentication):
   - **Password reset link lifetime and code expiry**: Providers > Email > *Email OTP Expiration*. This is how long a password reset link and an emailed code keep working. 3600 seconds (1 hour) is the most you should allow; 900 (15 minutes) is better.
   - **Secure email change**: Providers > Email > turn it **on**. When a person changes their email, the old and the new address must both confirm it.
   - **"Email me a code" sign-in**: keep the Email provider on, and make sure the *Magic Link* and *Confirm signup* email templates (Authentication > Emails) show the 6-digit code (`{{ .Token }}`), not only the link. Do step 1 below first so these emails arrive.

## 1. Reliable emails (password resets, sign-ups, invites)

Supabase's built-in sender allows only a few emails per hour, which is too few for a school.
1. Create a free account at resend.com (or brevo.com). Verify your sending domain, or use their test sender while you try it out.
2. Supabase > Authentication > Emails > SMTP Settings > turn on **Enable custom SMTP**, paste the host, port, username and password, set the sender name to ACEIT.
3. Test with **Forgot password?** on the login page.

## 2. Turn on Confirm email (before you invite any real staff)

Today anyone can create an account with any email address, because "Confirm email" is off. That is fine for students, but it would let a student register your instructor's address *before* the instructor does and receive the instructor role.
1. Supabase > Authentication > Providers > Email > turn **Confirm email** on. (Do step 1 first, so the confirmation emails arrive.)
2. In ACEIT: Platform > Settings. It should now say "Confirm email is ON in Supabase". Tick **Allow invites to people who have not signed up yet**.

Until you tick that box, the database refuses to invite anyone who has no account yet. You can still add people who already signed up.
3. While you are in Supabase > Authentication > Providers > Email, also set **Minimum password length** to 8 or more (the app already asks for 8) and, on the Pro plan, turn on leaked-password protection.

## 3. Turn on two-step login for staff

1. In ACEIT: Profile > Two-step login > Set up authenticator app. Scan the code with Google Authenticator, Microsoft Authenticator, 1Password or Authy, and enter the 6-digit code.
2. Log out and log in again (you will be asked for a code).
3. Platform > Settings > tick **Require two-step login for staff**. From then on admins, school managers and instructors must set it up the next time they log in, and the database ignores their powers on any session that did not use the code.

If setting it up says two-step login is disabled, turn it on in Supabase > Authentication > Multi-Factor (enable TOTP).

You cannot tick the box before you have used it yourself (so you cannot lock yourself out). If you ever do get locked out, run this in the Supabase SQL Editor: `update public.app_secrets set value = '0' where key = 'require_staff_mfa';`

## 4. Add a school (the whole flow takes about 10 minutes)

1. Platform > Schools > **New school**. Enter the name, a region, an optional student limit, tick the courses it may use, and enter the school manager's email.
2. The manager signs up (or logs in) with that email and confirms it. A **School** tab appears for them. If they already had an account they are added at once.
3. The manager opens School > New class, picks the course, names the class (for example "ERTH 209 Section 2") and creates it. The class gets a random join code; they can also type their own.
4. The manager invites instructors (School > Instructors > Invite an instructor, pick the class). If the instructor has no account yet, ACEIT shows a message to send them.
5. Students log in, tap **Join a class** and enter the code. They see only their own class. The instructor and manager see their progress.

Each instructor sees only their own classes. A manager sees every class in their school and nothing from other schools. You see everything.

## 5. A custom address (for example aceit.ca)

1. Buy the domain. In the GitHub repo: Settings > Pages > Custom domain, enter it, Save.
2. At your registrar add the DNS records GitHub shows.
3. Supabase > Authentication > URL Configuration: set the Site URL and Redirect URLs to the new address.

GitHub Pages cannot send security headers (HSTS and similar). For a school rollout, host the same files on Cloudflare Pages (free) with the custom domain; add the headers listed in `docs/SECURITY.md`. The page already forbids third-party code with a Content-Security-Policy and has no third-party scripts or fonts.

## 6. Where your data lives, and backups

1. Supabase > Project Settings > General: note the **Region**. For Canadian schools, "Canada (Central)" is the right answer. A region cannot be changed later; if yours is different, create a new project in the right region and run `supabase/schema.sql` there.
2. Supabase's free plan has no daily backups you can restore. For a school, use the Pro plan (daily backups, optional point-in-time recovery), and do one restore test so you know it works.
3. Keep a second copy of the content: this GitHub repo is already that.

## 7. Allowed sign-up emails (optional)

Platform > Settings > Allowed email domains, for example `school.ca, uni.ca`. Only those domains can create accounts. Your own admin email and anyone you invited always work. Leave it empty to allow anyone.

## 8. Protect the lecture files

Platform > Content > **Publish content to the database**. This copies every lecture into the database so only members of a class can read it. Tell the developer when it says Done, so the public copies can be removed from the site.

## 9. Pictures and copyright

The figures come from your lecture slides and the textbook. Before an institutional rollout, either get written permission from the instructor or publisher, or replace them with original diagrams.

## 10. Rebuilding the self-hosted libraries (developer only)

`node tools/vendor.mjs` rebuilds `js/vendor/supabase.js` and the fonts (needs npm and network). Review the diff when you change a version.

## 11. Two-week pilot

See `docs/PILOT-PLAN.md`.
