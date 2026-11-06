export type RepoRow = { repo: string; branch: string; changed: number; ahead: number; behind: number; base: string }
// worktree: a linked git worktree. main: a repo's main checkout. folder: a folder of repo worktrees. parent: a plain folder of repos.
export type Band = { where: 'worktree' | 'main' | 'folder' | 'parent'; path: string; name: string; rows: RepoRow[] }

declare module 'claude-code' {
  interface PluginState {
    'worktree-band': { band: Band | null }
  }
}
