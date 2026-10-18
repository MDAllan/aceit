# ACEIT school setup guide

Things only the site owner can do (they need your accounts). Each takes 5 to 15 minutes.

## 1. Reliable emails (password resets, sign-ups)
Supabase's built-in sender allows only a few emails per hour. Connect your own:
1. Create a free account at resend.com (or brevo.com). Verify your sending domain or use their test sender.
2. In Supabase: Authentication > Emails > SMTP Settings > turn on "Enable custom SMTP", paste the host, port, username and password from Resend/Brevo, set the sender name to ACEIT.
3. Save. Test with "Forgot password?" on the login page.

## 2. A custom address (for example aceit.ca)
1. Buy the domain. In the GitHub repo: Settings > Pages > Custom domain, enter it, Save.
2. At your domain registrar add the DNS records GitHub shows (four A records and one CNAME).
3. In Supabase: Authentication > URL Configuration, set the Site URL and Redirect URLs to the new address.

## 3. School sign-in (Google or Microsoft)
1. Supabase: Authentication > Providers > Google (or Azure). Each needs a Client ID and Secret from Google Cloud / Microsoft Entra, with the Supabase callback URL as the redirect.
2. Ask the school IT team for an app registration limited to their domain.
3. The app needs a small "Sign in with Google" button added after this is configured.

## 4. Limit sign-ups to school emails
Log in as admin > Admin tab > "Allowed school emails" and enter for example `school.ca, uni.ca`. Leave it empty to allow anyone.

## 5. Instructors
Admin tab > Instructors: add the instructor's email (they must have signed up first) and pick the class. They then see only that class: progress, codes, exam date, feedback.

## 6. Protect the lecture files
Admin tab > "Protect lecture content" > Publish. This copies every lecture into the database so only members of a class can read it. Tell the developer once it says Done, so the public copies can be removed.

## 7. Pictures and copyright
The figures come from your lecture slides and the textbook. Before an institutional rollout, either get written permission from the instructor/publisher, or replace them with original diagrams.

## 8. Two-week pilot
Run with one class. Measure: students who joined and finished a topic in 24 hours; weekly active students; quiz accuracy between first and later attempts; the feedback ratings in the Admin tab. Collect 5 student comments.
