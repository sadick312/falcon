# If something breaks: how to go back

All commands run in a terminal opened in the `falcon` folder (`C:\Users\sarip\falcon`).
Nothing here deletes history: you can always come back.

## 1. See what changed recently

```bash
git log --oneline -15
```

Each line is one change, newest first, e.g. `6e10373 feat(visual): Danger Warning ...`.
The short code at the start (`6e10373`) is the commit id.

## 2. Quickest fix: use an older build, change nothing

Build the game file from an older commit into a separate folder, then paste that into Quick Inject.
Your code stays as it is.

```bash
git worktree add ../falcon-old 6e10373
```

```bash
cd ../falcon-old && npm install && npm run quickinject
```

The file is `..\falcon-old\mod-source\dist\falcon-quickinject.js`. When you're done:

```bash
cd ../falcon && git worktree remove ../falcon-old
```

## 3. Undo one change for good (safe)

`git revert` adds a new commit that undoes the chosen one. History stays, so you can redo it later.

```bash
git revert 6e10373
```

Then rebuild and test:

```bash
npm run quickinject
```

If git says there is a **conflict**, stop and run `git revert --abort` (nothing changes), then ask for help.

## 4. Undo changes you haven't committed yet

See what's changed:

```bash
git status
```

Throw away your edits to ONE file (this cannot be undone):

```bash
git restore mod-source/src/ui/Hook.ts
```

## 5. Settings broke, not the code

In the game: Esc > Configs > **Reset to Default**. Keys: Esc > Keybinds > **Reset all**.
If the menu won't even open, in the browser console (F12) run `localStorage.removeItem("falcon-settings")`
and reload.

## Don't use (they delete work)
- `git reset --hard`
- `git push --force`
- `git clean -fd`
