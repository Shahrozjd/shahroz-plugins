# worktree-band

When several Claude Code sessions run at once, it is easy to lose track of where each one
is editing. `worktree-band` adds one quiet line above the prompt box that answers three
questions at a glance: which folder am I in, which branch, and is my work safe?

```
⎇ login-fix  my-app feature/login-fix ● 3 changed  ↓12 behind main
```

## What the line shows

| Part | Meaning |
| --- | --- |
| `⎇ login-fix` (bold) | The worktree folder the session works in, separate from your main checkout. |
| `⎇ main checkout` | The session edits the repo's main folder directly. |
| `my-app` | The repo (project) name, also inside a worktree. |
| `⎇ no worktree` (yellow) | The session is in a folder of several repos and edits them in place. |
| the branch | The branch. In a folder of several repos, each repo on a branch gets its own name, branch and state. |
| `● 3 changed` | Uncommitted files. Yellow. |
| `● 2 to push` / `● not pushed` | Commits that exist only on this machine. Yellow. |
| `● synced` | Committed and pushed. Green. |
| `↓12 behind main` | The default branch has moved on: merge it before you review or open a PR. |

It always stays on one line: in a narrow window the branch name is shortened in the
middle, so the folder, repo and state stay readable. Outside a git folder the line does not appear. It refreshes when a session starts and
after every turn. Colours come from your theme, so it reads in light and dark mode.

## Push guard

Claude can not run `git commit` or `git push` on `main` or `master`, or push to them from
another branch (`git push origin HEAD:main`). The command is blocked with a message that
says to make a branch first. You can still run it yourself in a terminal.

The guard reads the repo from `git -C <dir>` or a leading `cd <dir> &&`; any other shape
is checked against the session's own folder.

## Commands

- `/worktrees`: every worktree of this repo (or of each repo in the folder), with its
  branch, its state and how far it is behind the default branch. Good for spotting old
  worktrees you can delete.
- `/open-worktree`: opens the session's folder in VS Code. Needs the `code` command on
  your PATH (in VS Code: "Shell Command: Install 'code' command in PATH").

## Works with

- Worktrees Claude Code makes itself (`claude --worktree`, the desktop app's Worktree
  switch), in `.claude/worktrees/`.
- A `WorktreeCreate` hook that puts several repos in one folder under a `worktrees/` or
  `.worktrees/` directory: each repo on a branch is listed.
- Plain checkouts, where it simply shows the branch and its state.

## Install

```
/plugin install worktree-band --marketplace Shahrozjd/shahroz-plugins
```

On Claude Code older than 2.1.275, add the marketplace first:

```
/plugin marketplace add Shahrozjd/shahroz-plugins
/plugin install worktree-band@shahroz-plugins
```

Needs a Claude Code version that runs plugin hooks modules (mods). It draws in the
terminal and in the desktop app.

## Limits

- "Behind main" uses what git last fetched. It does not fetch for you.
- The branch names it protects are `main` and `master`.

## License

MIT. See [LICENSE](LICENSE).
