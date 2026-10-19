# Sub-processors (draft)

Services that store or process information for ACEIT. Keep this list current and tell schools before changing it.

| Service | What it does | What it can see | Region | Notes |
|---|---|---|---|---|
| Supabase | Database, sign-in, API, and file storage for the pictures instructors add (a private bucket) | Everything stored (account, progress, summaries, feedback, audit log, content and pictures instructors add) | [fill in from Supabase > Project Settings > General] | Hosted on [cloud provider]. Encrypted in transit and at rest. Sign its data processing addendum: [link/date] |
| GitHub Pages (GitHub, Inc.) | Serves the website files | Technical request data (IP address, browser) when the site is loaded. No student information | United States / global CDN | Move to [Cloudflare Pages] when the custom domain is set up |
| [Email sender, for example Resend or Brevo] | Sends sign-in, confirmation and password-reset emails | Email address and the message | [region] | Needed before invites and confirmation work reliably |
| [Error or uptime monitor, if added] | | | | |

Not used: advertising networks, analytics services, social-media widgets, third-party fonts or script hosts (the site serves its own).

Last reviewed: [date].
