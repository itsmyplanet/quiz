# Site Register — MCQ Quiz Book

A tiny installable web app that turns formatted `.txt` question banks into
tap-through quizzes with instant "stamped" verdicts and explanations.
No backend, no account — everything is saved in your browser's local storage
on your own device.

## What's in this folder

```
index.html      the whole app shell
style.css       visual design (blueprint / inspection-stamp theme)
app.js          parsing, storage, quiz logic
manifest.json   makes it installable ("Add to Home Screen")
sw.js           service worker, lets it work offline once loaded
seed-quiz.txt   your original 25-question sample, loaded automatically
icons/          app icons
```

## 1. Put it on GitHub Pages (free hosting)

1. Create a new **public** GitHub repository (e.g. `site-register`).
2. Upload every file in this folder into the repo, keeping the `icons/`
   folder as a folder.
3. In the repo, go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to `Deploy from a branch`,
   branch `main`, folder `/ (root)`. Save.
5. GitHub will give you a URL like
   `https://yourusername.github.io/site-register/`. It can take a minute
   to go live.

That's it — no build step, no npm install. It's plain HTML/CSS/JS.

## 2. Add it to your phone's home screen

**Android (Chrome):** open the GitHub Pages URL, tap the **⋮** menu →
"Add to Home screen" / "Install app".

**iPhone (Safari):** open the URL, tap the **Share** icon → "Add to Home
Screen".

Either way you get an icon that opens full-screen, like a normal app.

## 3. Add a new quiz

Tap **+ New Quiz**, give it a title, and upload a `.txt` file in this
exact format:

```
Q1. Question text goes here?

A) First option
B) Second option
C) Third option  ✅ CORRECT
D) Fourth option

Explanation: Why C is the right answer.

------------------------------------------------

Q2. Next question...
```

Rules the parser follows:

- Each question starts with `Q<number>.` at the start of a line.
- Options are lines starting with `A)`, `B)`, `C)`, `D)` (any number of
  options ≥ 2 is fine — it doesn't have to be exactly four).
- Put a `✅` right after the correct option's text — the app strips the
  checkmark and anything after it before showing the option, so it never
  gives the answer away while you're taking the quiz.
- An `Explanation:` line is optional but recommended — it's revealed the
  moment you answer, whether you got it right or wrong.
- Blocks can be separated by a line of dashes (`----------------`) or
  just left blank; both work.

You can keep uploading new `.txt` files any time — each one becomes its
own entry in the home page list ("the register"), with its own question
count and a delete button if you want to remove it later.

## Notes

- All quizzes live in your browser's local storage, scoped to whatever
  domain you host this on. Clearing site data / browser storage will
  remove them, so it's not a place for anything irreplaceable — if a
  quiz matters, keep the original `.txt` file too.
- Nothing is uploaded anywhere; parsing happens entirely on-device.
- Works offline after the first visit (the service worker caches the app
  shell).
