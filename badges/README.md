# Badges: how to add or change one

Every badge in Ace It comes from two things that live in this folder:

* `badges.json` is the list of badges (names, how to earn them, the numbers).
* `img/` holds the pictures, one PNG per step of a badge.

You do not need to touch any code. Add a picture, add a few lines to `badges.json`, save, and the app shows it.

## The words we use

* **Badge family**: one tile in the profile grid, for example "Streak". A family is a ladder of steps.
* **Tier**: one step of the ladder, with its own name and its own picture. Streak has four tiers: Hot Streak, On Fire, Unstoppable, Eternal Flame.
* A tile always shows the **highest tier the student has earned**. Before anything is earned it shows the first tier in grey.
* **Rank**: a short label shown on a tier (Copper, Silver, Gold ...). Each family uses its own ladder of ranks, so not everything is Bronze, Silver, Gold.

## Add a picture

1. Make a PNG, **256 x 256 pixels, square, with a transparent background**.
2. Draw it in **full colour**. The app turns it grey by itself while the badge is locked.
3. Leave a few pixels of empty margin around the shape so it is not cut off, and keep it simple: it is shown as small as 52 pixels wide.
4. Keep the file small (under about 100 KB; a free site such as tinypng.com shrinks it).
5. Name it **`family id` + `-` + `tier number` + `.png`**, all lowercase, for example `streak-1.png`, `streak-2.png`. Put it in `badges/img/`.
   The name must match the config exactly, including capital letters, because the website is case sensitive (`Streak-1.PNG` will not be found).

To replace a placeholder with your own art, just save your PNG over the file with the same name. Nothing else changes.

If a picture is missing or broken, the app shows a plain circle with the first letters of the badge name instead, so nothing breaks.

## Add a new tier to a badge that already exists

Open `badges.json`, find the family (for example `"id": "streak"`), and add one more line at the **end** of its `"tiers"` list (remember the comma after the line before it):

```json
{ "name": "Eternal Flame", "rank": "Platinum", "at": 100, "image": "badges/img/streak-4.png", "how": "Study 100 days in a row" }
```

Then put `streak-4.png` in `badges/img/`.

## Add a brand new badge (a new family)

Copy this block, paste it into the `"families"` list (before the final `]`), and change the words:

```json
{
  "id": "homework",
  "name": "Homework",
  "metric": "cardsReviewed",
  "unit": "cards",
  "minLevel": 3,
  "ladder": "scout ranks",
  "tiers": [
    { "name": "Page Turner", "rank": "Cub", "at": 20, "image": "badges/img/homework-1.png", "how": "Review 20 flashcards" },
    { "name": "Deep Diver", "rank": "Scout", "at": 100, "image": "badges/img/homework-2.png", "how": "Review 100 flashcards" }
  ]
}
```

Then add `homework-1.png` and `homework-2.png` to `badges/img/`.

### What each field means

Badge family:

| Field | What it is |
| --- | --- |
| `id` | A short unique name for the family: lowercase letters, numbers and hyphens. It is also the start of the picture file names. **Do not change it later**, because students' progress is saved under this name. |
| `name` | The family name shown in the detail window ("Streak badge"). |
| `metric` | What the app counts for this badge. Pick one from the list further down. |
| `unit` | The word used in the "N more ..." messages ("days", "games", "cards"). Use the plural; the app makes it singular when one is left. |
| `minLevel` | The level a student must reach before this badge appears in their grid. The six starter badges use `1`, so a new student sees them straight away. Later badges use 2 to 8. A student who earns a badge early always sees it, whatever their level. |
| `ladder` | Only a note for you, such as "metals" or "chess pieces". The app does not show it. |
| `suffix` | Optional. Added after the numbers in the progress text, for example `"%"` shows "72% / 90%". |
| `cheer` | Optional. Your own list of encouraging lines for this badge (see below). If you leave it out, the app uses a good default set. |
| `tiers` | The steps, from easiest to hardest. |

Each tier:

| Field | What it is |
| --- | --- |
| `name` | The fun name of this step ("Hot Streak"). Every tier name in the whole file must be different. |
| `rank` | A short label shown with the name ("Copper"). Keep it to one or two short words. |
| `at` | The number needed. The tier is earned when the count **reaches** this number (`at: 7` means 7 or more). Each tier's number must be bigger than the one before it. |
| `image` | Where the picture is, always `badges/img/<family id>-<tier number>.png`. |
| `how` | Tells the student how to unlock it, written as an instruction: "Study 7 days in a row". Never mention lectures, slides or textbooks, and keep names subject-neutral (they must work for Biology, Chemistry, Math and every other class). |

Optional `cheer` lines can use these blanks, which the app fills in: `{remaining}` (how many more), `{unit}`, `{next}` (name of the next tier), `{how}`, `{name}`, `{rank}`. For example:

```json
"cheer": [ "{remaining} more {unit} to unlock {next}. You've got this!", "Nearly there: {next} is {remaining} {unit} away." ]
```

## Change, move or remove things

* **Reword a name or a "how" line**: edit the text, save. Students keep what they earned.
* **Change a number (`at`)**: fine. Students who already earned the tier keep it.
* **Reorder families**: the grid follows the order in the file. Keep the six starter badges (the ones with `"minLevel": 1`) at the top.
* **Add a tier in the middle of a ladder**: avoid it. The app remembers "this student earned the first 2 tiers of Streak", so a tier slipped into the middle would change what those numbers mean. Always add new tiers at the end.
* **Remove a family**: students lose nothing in the database, but it disappears from the app. Never reuse an old `id` for something different.

## What the app counts (the `metric` list)

| Metric | What it counts |
| --- | --- |
| `level` | The student's current level. |
| `xp` | Total XP earned. |
| `streak` | Days in a row the student has studied (the current run). |
| `gamesPlayed` | Games finished. |
| `correctAnswers` | Questions answered correctly. |
| `sprintBeats` | How many times the student beat their own personal best in the 60-second sprint (for example 6, then 9, is two beats). |
| `sprintBest` | The student's best score in the 60-second sprint. (Available, but no badge uses it yet.) |
| `shares` | Games shared with a friend. |
| `challengesSent` | Challenges the student sent to friends. |
| `challengesWon` | Challenges the student won against friends. |
| `reviews` | Times the student reviewed the app: 0, or 1 and more. |
| `quizBest` | The student's best quiz score, as a percentage from 0 to 100. |
| `cardsReviewed` | Flashcards reviewed. |
| `decksFinished` | Complete flashcard decks finished. |
| `glossaryStudied` | Glossary terms studied. |
| `comebacks` | Weak topics turned into strong ones. |
| `topicsTamed` | Topics where every question was answered correctly. |
| `classesConquered` | Classes where every topic is complete. |
| `nightSessions` | Days the student studied after 10 pm. |
| `earlySessions` | Days the student studied before 8 am. |
| `examPrepped` | Practice tests finished before a midterm or a final. |

A badge can only use a metric from this list. If you type one that does not exist, the checker (below) tells you.

## Check your work

Every time you edit, run this in the project folder:

```
node tools/test_badges.mjs
```

It reads `badges.json` and tells you in plain words if something is wrong: a missing or misspelled picture, a tier number that is not bigger than the one before, a repeated name, an unknown metric, a missing comma that breaks the file, and so on. It says "all badge tests passed" when everything is fine.

JSON is picky: every line in a list needs a comma after it except the last one, and text goes in straight double quotes `"like this"`.

## The placeholder pictures

The pictures that came with the app are simple placeholders (a coloured disc with the first letters of the name and the tier number). To remake them, or to make placeholders for new badges you just added to `badges.json`, run:

```
python tools/make_badge_placeholders.py --only-missing
```

`--only-missing` never overwrites a picture that is already there, so your own art is safe. Without it, every placeholder is redrawn and **replaces** the file with the same name.
