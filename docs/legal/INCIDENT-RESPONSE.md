# Incident response (draft)

What we do if student information may have been exposed or the service is attacked.

## 1. Roles
- **Incident lead:** [name, phone, email]. **Backup:** [name].
- **School contacts:** each school's privacy contact (kept in the sign-up record for that school).

## 2. Detect
Sources: the audit trail, error reports, the sign-in service's logs, a school or user report, a security researcher (`/.well-known/security.txt`).

## 3. Contain (first hour)
1. Decide what is affected and how far it reaches (which schools, which people, which data).
2. Stop the problem: block the account (Platform > People), remove a role, change the join code, suspend a school (Platform > Schools > Settings), sign everyone out by rotating the project's JWT secret if a key was exposed, or switch the site to maintenance by removing the published files.
3. Keep evidence: do not delete logs; note times and actions.

## 4. Assess
Was personal information exposed, to whom, how many people, how sensitive, and is it likely to cause harm?

## 5. Notify
- Tell each affected school's privacy contact **without undue delay and within [72] hours** of confirming a breach: what happened, what information, how many people, what we have done, what the school should do, and who to call.
- The school decides whether to notify individuals and the regulator, with our help. If ACEIT is directly responsible for the accounts, notify the regulator and individuals as the applicable law requires.

## 6. Recover and learn
Fix the cause, restore from backup if needed, add an automated test that would have caught it, update `docs/SECURITY.md`, and write a short report for each affected school within [14] days.

## 7. Practice
Once a year: run this plan on an invented scenario, and do one backup restore test.
