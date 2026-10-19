# ACEIT: study tools your students actually use, with dashboards your instructors can trust

*One page for a school or department. Replace the bracketed parts before sending.*

## The problem

Students revise from long slide decks and textbooks, then cram. Instructors do not find out who is struggling until the midterm. Generic study apps are not built on your course, and generic LMS quizzes are dull.

## What ACEIT is

A mobile-first study site built on **your course material**:

- **Notes** in plain language, one topic at a time, each with its own picture.
- **Flashcards** that flip, and come back at the right time (spaced repetition).
- **Quizzes** with explanations, with "how sure were you?" ratings, and **practice exams**.
- **Games** that make revision something students choose to do (matching, memory, blitz, number-crunching, timelines and more).
- Progress, levels and streaks, an exam countdown and a study plan aimed at each student's weakest topics.
- Made for everyone: works on any phone, in light or dark mode, with larger text, an easy-read font and a reduced-motion option. Every main screen passes automated WCAG 2.x A/AA checks (a full manual accessibility review is planned before an institutional rollout).

Every quiz answer in the first two courses (geology and astronomy) was checked against the source material by a second, independent reader.

## What your staff get

| Role | Sees | Controls |
|---|---|---|
| **Instructor** | Each student's progress in their classes, which questions the class finds hardest, who has gone quiet for a week | Join code, exam date, removing a student, CSV export, **adding their own questions, flashcards, notes, lectures and announcements** (with pictures) |
| **School manager** | Every class in the school, with progress and activity | Creating classes, inviting instructors, seat limits, code expiry, archiving, the school's audit trail, **optional approval of what instructors publish** |
| **Platform admin (ACEIT)** | The whole service | Adding schools, courses per school, admins, account safety |

Each school's information stays inside that school. Instructors see only their own classes.

## Trust and security

- Access rules are enforced **in the database** and tested automatically against a real Postgres on every change (190+ tests).
- Optional **two-step login** for staff, which the platform can require.
- Roles are given by **email invite** to a confirmed address; nobody can claim a role by signing up.
- **No third-party scripts, fonts or trackers.** Strict Content-Security-Policy.
- Students can download or delete their data. Staff actions are logged in an audit trail nobody can edit.
- Details: `docs/SECURITY.md`. Draft privacy and data-processing documents: `docs/legal/`.

## Try it with one class: a two-week pilot

1. We create your school and add your course(s). You name a school manager.
2. The manager creates a class per section and invites the instructors (15 minutes).
3. Students join with a code. No student data is needed in advance.
4. After two weeks you get a one-page summary: how many students joined and returned, quiz accuracy over time, the hardest questions, and student comments. (`docs/PILOT-PLAN.md`)

## What it costs

[To be agreed: for example a per-school or per-student yearly fee, with a free pilot.]

## Next step

[Name, email, phone]. We can show it to your team in 20 minutes, on a real class or with sample data.
