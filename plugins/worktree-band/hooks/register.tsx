import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Band, RepoRow } from '../types'

const band = atom({ plugin: 'worktree-band', key: 'band' } as const, null)
const PROTECTED = ['main', 'master']

// Shared shell helper: one tab-separated line per repo on a branch.
// name, branch, changed files, commits to push (-1 = no upstream), commits behind the default branch, its name.
const ROW = `row() { b=$(git -C "$1" branch --show-current); [ -n "$b" ] || return 0
  c=$(git -C "$1" status --porcelain | wc -l | tr -d ' ')
  if git -C "$1" rev-parse -q --verify '@{u}' >/dev/null; then a=$(git -C "$1" rev-list --count '@{u}..HEAD'); else a=-1; fi
  d=$(git -C "$1" symbolic-ref -q --short refs/remotes/origin/HEAD); n=0
  [ -n "$d" ] && [ "$b" != "\${d#origin/}" ] && n=$(git -C "$1" rev-list --count "HEAD..$d")
  printf '%s\\t%s\\t%s\\t%s\\t%s\\t%s\\n' "$2" "$b" "$c" "$a" "$n" "\${d#origin/}"; }`

// First line: where the session is and the folder to open. Then a row per repo.
const PROBE = `${ROW}
if top=$(git rev-parse --show-toplevel 2>/dev/null); then
  common=$(git rev-parse --path-format=absolute --git-common-dir); repo=$(basename "$(dirname "$common")")
  if [ "$(git rev-parse --absolute-git-dir)" = "$common" ]; then w=main; else w=worktree; fi
  printf '%s\\t%s\\t%s\\n' "$w" "$top" "\${top##*/}"; row "$top" "$repo"
else
  set -- */.git; [ -e "$1" ] || exit 0
  case "$PWD" in */worktrees/*|*/.worktrees/*) w=folder ;; *) w=parent ;; esac
  printf '%s\\t%s\\t%s\\n' "$w" "$PWD" "\${PWD##*/}"
  for g in "$@"; do r=\${g%/.git}; row "$r" "$r"; done
fi`

// Every worktree of the session's repo, or of each repo in the folder, with its state.
const LIST = `${ROW}
list() { git -C "$1" worktree list --porcelain | sed -n 's/^worktree //p' | while read -r p; do
  row "$p" "\${p/#$HOME/~}"; done; }
if top=$(git rev-parse --show-toplevel 2>/dev/null); then list "$top"
else for g in */.git; do [ -e "$g" ] && list "\${g%/.git}"; done; fi`

function toRows(lines: string[]): RepoRow[] {
  return lines.map(line => {
    const [repo = '', branch = '', changed = '0', ahead = '0', behind = '0', base = ''] = line.split('\t')
    return { repo, branch, changed: Number(changed), ahead: Number(ahead), behind: Number(behind), base }
  })
}

async function refresh($: EngineInterface) {
  const { stdout } = await $.process.run(['bash', '-c', PROBE], { timeoutMs: 5000 })
  const [head = '', ...lines] = stdout.split('\n').filter(Boolean)
  const [where = '', path = '', name = ''] = head.split('\t')
  const next: Band | null =
    where === 'worktree' || where === 'main' || where === 'folder' || where === 'parent'
      ? { where, path, name, rows: toRows(lines) }
      : null
  await update($, band, () => next)
}

function state(row: RepoRow): { text: string; color: 'success' | 'warning' } {
  if (row.changed > 0) return { text: `${row.changed} changed`, color: 'warning' }
  if (row.ahead < 0) return { text: 'not pushed', color: 'warning' }
  if (row.ahead > 0) return { text: `${row.ahead} to push`, color: 'warning' }
  return { text: 'synced', color: 'success' }
}

// shortcut: finds the repo from `git -C <dir>` or a leading `cd <dir> &&` only; other shapes use the session folder.
async function guard($: EngineInterface, command: string): Promise<string | undefined> {
  const call = /(?:^|&&|;|\|\|)\s*(?:cd\s+(\S+)\s*&&\s*)?git\s+(?:-C\s+(\S+)\s+)?(commit|push)\b([^;&|]*)/g
  for (const m of command.matchAll(call)) {
    const [, cdDir, cDir, action = '', rest = ''] = m
    const dir = (cDir ?? cdDir ?? '.').replace(/^["']|["']$/g, '')
    const { stdout } = await $.process.run(['bash', '-c', 'cd "${1/#\\~/$HOME}" && git branch --show-current', '_', dir])
    const branch = stdout.trim()
    const target = action === 'push' ? PROTECTED.find(p => new RegExp(`(^|[\\s:])${p}(\\s|$)`).test(rest)) : undefined
    const hit = PROTECTED.includes(branch) ? branch : target
    if (hit) {
      return `${$.plugin.name}: git ${action} to ${hit} is blocked. Make a branch first (git switch -c feature/<topic>), or run it yourself if you really mean it.`
    }
  }
  return undefined
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'open-worktree', description: 'Open the folder this session works in, in VS Code' })
    await $.command.register({ name: 'worktrees', description: 'List every worktree of this repo with its branch and state' })
    await refresh($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const deny = await guard($, e.command)
    return deny ? { deny } : next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'open-worktree' }, async $ => {
    const view = await read($, band)
    if (!view) return { text: 'This session is not in a git folder.' }
    const { exitCode } = await $.process.run(['code', view.path]).catch(() => ({ exitCode: 1 }))
    return {
      text: exitCode === 0
        ? `Opened ${view.path} in VS Code.`
        : 'VS Code\'s "code" command was not found. In VS Code, run "Shell Command: Install \'code\' command in PATH".',
    }
  })

  on('command.run', { command: 'worktrees' }, async $ => {
    const { stdout } = await $.process.run(['bash', '-c', LIST], { timeoutMs: 15000 })
    const rows = toRows(stdout.split('\n').filter(Boolean))
    if (rows.length === 0) return { text: 'No worktrees on a branch here.' }
    return {
      text: rows
        .map(r => `${r.repo}  ${r.branch}  ${state(r).text}${r.behind > 0 ? `, ${r.behind} behind ${r.base}` : ''}`)
        .join('\n'),
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const view = await read($, band)
    if (!view || e.props.hasSurvey) return below
    const { Box, Text } = $.ui.resolve(e)

    // One line that never wraps: where you are, then each repo, its branch and its state.
    // Only the branch shrinks (ellipsis in the middle) when the window is narrow; colour carries only the state.
    const line =
      view.where === 'parent' ? (
        <Text wrap="truncate-end">
          <Text color="warning">⎇ no worktree</Text>
          <Text dimColor>  {view.name} · edits change the main checkouts</Text>
        </Text>
      ) : (
        <Box flexDirection="row" flexWrap="nowrap" columnGap={2}>
          <Box flexShrink={0}>
            <Text>
              <Text dimColor>⎇ </Text>
              {view.where === 'main' ? <Text dimColor>main checkout</Text> : <Text bold>{view.name}</Text>}
            </Text>
          </Box>
          {view.rows.length === 0 && (
            <Box flexShrink={0}>
              <Text dimColor>no branch yet</Text>
            </Box>
          )}
          {view.rows.map(row => {
            const s = state(row)
            return (
              <Box key={row.repo} flexDirection="row" flexWrap="nowrap" columnGap={1} flexShrink={1} minWidth={0}>
                <Box flexShrink={0}>
                  <Text dimColor>{row.repo}</Text>
                </Box>
                <Box flexShrink={1} minWidth={6}>
                  <Text color="suggestion" wrap="truncate-middle">{row.branch}</Text>
                </Box>
                <Box flexShrink={0}>
                  <Text>
                    <Text color={s.color}>● {s.text}</Text>
                    {row.behind > 0 && <Text color="warning">  ↓{row.behind} behind {row.base}</Text>}
                  </Text>
                </Box>
              </Box>
            )
          })}
        </Box>
      )

    return (
      <Box flexDirection="column">
        {below}
        {line}
      </Box>
    )
  })
}
