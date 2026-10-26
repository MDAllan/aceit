# Badges: how to add or change one

Every badge in Ace It comes from two things that live in this folder:

* `badges.json` is the list of badges (names, how to earn them, the numbers).
* `img/` holds the pictures, one PNG per tier of a badge.

You do not need to touch any code. Add a picture, add a few lines to `badges.json`, save, and the app shows it.

## The words we use

* **Badge family**: one tile in the profile, for example "Study Buddy". A family has a list of tiers.
* **Tier**: one level of a family, with its own picture. The default tier names, in order, are **Bronze, Silver, Gold, Emerald, Diamond, Ruby, Celestial, Legendary**. A family only uses as many as it needs: Study Buddy has 3 (Bronze, Silver, Gold), Flash uses all 8.
* The profile shows **one badge per family**:
  * nothing earned yet: the first tier, in grey, with a line that says how to unlock it ("Share a game with a friend to unlock");
  * some tiers earned: the highest earned tier, in colour, with a thin progress bar and a line such as "4 more shares to unlock Silver";
  * the last tier earned: "Max level reached".
* Tap a badge to see its name and current tier, how to unlock the next one, and a small picture of every tier (colour = earned, grey = locked).
* Each time a tier is earned the student sees "Congrats! You've earned Study Buddy – Silver!" with the picture.
* A family only appears once the student reaches its `minLevel`. The six starter families have `minLevel` 1, so a brand-new account sees those six first (all locked). The others appear as the student levels up.

## The starter families (new accounts see these first)

| Family | Counts | Tiers (thresholds) |
|---|---|---|
| Game On | Games played | 1, 10, 50, 100 |
| Busy Beaver | Correct answers | 10, 50, 100, 250, 500 |
| Hot Streak | Days in a row studied | 3, 5, 10, 15, 20, 30, 40, 50, 75, 100 (named "3-Day Streak" ... "100-Day Streak") |
| High Five | Level reached | 5, 10, 20, 30, 50 |
| Study Buddy | Games shared with friends | 1, 5, 10 |
| Golden Critic | Reviewed the app from the profile | 1 (a single badge) |

The other fifteen families (Flash, Sharpshooter, Card Shark, Brain Bank, Bullseye, Deck Master, Word Nerd, Night Owl, Early Bird, Comeback Kid, Topic Tamer, Challenger, Champion, Exam Ready, Class Conqueror) are in `badges.json` and appear as the student levels up.

## Add a picture

1. Make a PNG, **256 x 256 pixels, square, with a transparent background**.
2. Draw it in **full colour**. The app turns it grey by itself while the tier is locked.
3. Leave a few pixels of empty margin around the shape so it is not cut off, and keep it simple: the small tier pictures in the popup are only 48 pixels wide.
4. Keep the file small (under about 100 KB; a free site such as tinypng.com shrinks it).
5. Name it **`family id` + `-` + `tier number` + `.png`**, all lowercase, for example `study-buddy-1.png`, `study-buddy-2.png`, `study-buddy-3.png`. Put it in `badges/img/`.
   The name must match `badges.json` exactly, including capital letters, because the website is case sensitive (`Study-Buddy-1.PNG` will not be found).

To replace a placeholder with your own art, just save your PNG over the file with the same name. Nothing else changes.

The placeholders that came with the app are plain discs in the colour of each tier (bronze, silver, gold ...) with the first letters of the badge name. Hot Streak is a flame that gets bigger and brighter at every step; make your own flames the same way.

If a picture is missing or broken, the app shows a plain circle with the first letters of the badge name instead, so nothing breaks.

## Add a new tier to a badge that already exists

Open `badges.json`, find the family (for example `"id": "study-buddy"`), and add one more line at the **end** of its `"tiers"` list (remember the comma after the line before it):

```json
{ "at": 25, "image": "badges/img/study-buddy-4.png", "how": "Share 25 games with friends" }
```

Then put `study-buddy-4.png` in `badges/img/`. You do not need to write a tier name: the tier gets the default name for its place (this one is Emerald). You can use up to 8 tiers this way. A family with more than 8 tiers needs a `"name"` on every tier (see Hot Streak).

## Add a brand new badge (a new family)

Copy this block, paste it into the `"families"` list (before the final `]`), and change the words:

```json
{
  "id": "homework-hero", "name": "Homework Hero", "metric": "cardsReviewed", "unit": "cards", "minLevel": 3,
  "tiers": [
    { "at": 20, "image": "badges/img/homework-hero-1.png", "how": "Review 20 flashcards" },
    { "at": 100, "image": "badges/img/homework-hero-2.png", "how": "Review 100 flashcards" }
  ]
}
```

Then add `homework-hero-1.png` and `homework-hero-2.png` to `badges/img/`. To get placeholder pictures straight away, run `python tools/make_badge_placeholders.py --only-missing`.

### What each field means

Badge family:

| Field | What it is |
| --- | --- |
| `id` | A short unique name for the family: lowercase letters, numbers and hyphens. It is also the start of the picture file names. **Do not change it later**, because students' progress is saved under this name. |
| `name` | The badge name shown everywhere ("Study Buddy"). Every family name must be different. Fun, short and the same for every class (no subject words, no scientist names). |
| `metric` | What the app counts for this badge. Pick one from the list further down. |
| `unit` | The word used in the "N more ..." line ("shares", "days", "cards"). Use the plural; the app makes it singular when one is left. |
| `minLevel` | The level a student must reach before this badge appears. The six starter badges use `1`. Later badges use 2 to 8. A student who earns a badge early always sees it, whatever their level. |
| `suffix` | Optional. Added after the numbers in the progress text, for example `"%"` shows "72% / 90%". |
| `cheer` | Optional. Your own list of encouraging lines for the popup (see below). If you leave it out, the app uses a good default set. |
| `tiers` | The tiers, from easiest to hardest. |

Each tier:

| Field | What it is |
| --- | --- |
| `name` | Optional. Leave it out to get Bronze, Silver, Gold ... by position. Give one only when you want a different name, as Hot Streak does ("3-Day Streak"). A family with a single tier shows no tier name at all. Names must be different inside a family. |
| `at` | The number needed. The tier is earned when the count **reaches** this number (`at: 5` means 5 or more). Each tier's number must be bigger than the one before it. |
| `image` | Where the picture is, always `badges/img/<family id>-<tier number>.png`. |
| `how` | Tells the student how to unlock it, written as an instruction: "Share a game with a friend". The app adds " to unlock" ("Share a game with a friend to unlock"), so do not end it with a full stop. Never mention lectures, slides or textbooks, and keep it subject-neutral (it must work for every class). A short example in brackets at the end ("(for example 6 correct, then 9)") is shown in the popup and left out of the tile line. |

Optional `cheer` lines can use these blanks, which the app fills in: `{remaining}` (how many more), `{unit}`, `{next}` (name of the next tier), `{how}`, `{name}` (family name). For example:

```json
"cheer": [ "{remaining} more {unit} to unlock {next}. You've got this!", "Nearly there: {next} is {remaining} {unit} away." ]
```

## Change, move or remove things

* **Reword a name or a "how" line**: edit the text, save. Students keep what they earned.
* **Change a number (`at`)**: fine. Students who already earned the tier keep it.
* **Reorder families**: the grid follows the order in the file. Keep the six starter badges (the ones with `"minLevel": 1`) at the top, and list the others in the order they appear (lowest `minLevel` first).
* **Add a tier in the middle of a list**: avoid it. The app remembers "this student earned the first 2 tiers of Hot Streak", so a tier slipped into the middle would change what those numbers mean. Always add new tiers at the end.
* **Remove or rename a family**: students lose nothing in the database, but it disappears from the app. Never reuse an old `id` for something different. If you ever reshuffle the ids or the tier order on purpose, raise `BADGE_SCHEMA` in `js/main.js` so existing students are re-measured quietly instead of getting a pile of celebration popups.

## What the app counts (the `metric` list)

| Metric | What it counts |
| --- | --- |
| `level` | The student's current level. |
| `xp` | Total XP earned. |
| `streak` | Days in a row the student has studied (the current run). |
| `gamesPlayed` | Games finished. |
| `correctAnswers` | Questions answered correctly (quizzes and games). |
| `sprintBeats` | How many times the student beat their own personal best in the 60-second sprint (for example 6, then 9, is one beat; the first sprint only sets the personal best). |
| `sprintBest` | The student's best score in the 60-second sprint. (Available; no badge uses it yet.) |
| `shares` | Games shared with a friend (through the share button). |
| `challengesSent` | Challenges the student sent to friends. |
| `challengesWon` | Challenges the student won against friends. |
| `reviews` | Times the student reviewed the app: 0, or 1 and more. |
| `quizBest` | The student's best quiz score, as a percentage from 0 to 100. (Available; no badge uses it yet.) |
| `quizzes90` | Quizzes finished with 90% or more (quizzes of at least 5 questions). |
| `quizzes100` | Quizzes finished with 100% (quizzes of at least 5 questions). |
| `cardsReviewed` | Flashcards reviewed (every time a card is marked). |
| `decksFinished` | Complete flashcard decks finished. |
| `glossaryStudied` | Glossary terms studied (opened). |
| `comebacks` | Weak questions that climbed back above 60% after being weak. |
| `topicsTamed` | Lectures where every question was last answered correctly. |
| `classesConquered` | Classes where every lecture is complete. |
| `nightSessions` | Days the student studied after 10 pm. |
| `earlySessions` | Days the student studied before 8 am. |
| `examPrepped` | Practice tests finished before a midterm or a final. |

A badge can only use a metric from this list. If you type one that does not exist, the checker (below) tells you.

## Check your work

Every time you edit, run this in the project folder:

```
node tools/test_badges.mjs
```

It reads `badges.json` and tells you in plain words if something is wrong: a missing or misspelled picture, a number that is not bigger than the one before, a repeated name, an unknown metric, a missing comma that breaks the file, and so on. It says "all badge tests passed" when everything is fine.

JSON is picky: every line in a list needs a comma after it except the last one, and text goes in straight double quotes `"like this"`.

## The placeholder pictures

To remake them, or to make placeholders for new badges you just added to `badges.json`, run:

```
python tools/make_badge_placeholders.py --only-missing
```

`--only-missing` never overwrites a picture that is already there, so your own art is safe. Without it, every placeholder is redrawn and **replaces** the file with the same name.
