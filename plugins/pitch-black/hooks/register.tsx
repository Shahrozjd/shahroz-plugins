import type { EngineInterface, Register } from 'claude-code'

type Workspace = { folder: string; branch: string | null }
type Turn = { seconds: number; tools: number }

// Pitch Black, taken from the VS Code theme. Alpha colors (#FFFFFF20 and so on)
// are flattened onto black, since a terminal can't blend them.
const theme = {
  background: '#000000',
  foreground: '#FFFFFF',
  muted: '#888888',
  accent: '#0178FF',
  border: '#333333',
  error: '#EA3323',
} as const

async function loadWorkspace($: EngineInterface): Promise<Workspace> {
  const cwd = await $.session.cwd()
  const folder = cwd.split('/').filter(Boolean).pop() ?? cwd
  const git = await $.process
    .run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 3000 })
    .catch(() => null)
  const branch = git?.exitCode === 0 ? git.stdout.trim() || null : null

  return { folder, branch }
}

// On by default. `/pitch-black off` saves false in the plugin's store, which
// lasts across sessions, so the theme stays off until turned back on.
async function isOn($: EngineInterface): Promise<boolean> {
  return (await $.store.get('enabled')) !== false
}

export const register: Register = on => {
  // Each session runs its own copy of this module, so these are per session.
  let inTurn = false
  let tools = 0
  let place: Workspace | null = null
  let last: Turn | null = null

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pitch-black',
      description: 'Turn the Pitch Black theme on or off: on, off, or nothing to toggle',
    })
    place = await loadWorkspace($)
    $.ui.invalidate('ui.render')

    return next(e)
  })

  on('command.run', { command: 'pitch-black' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg !== '' && arg !== 'on' && arg !== 'off') {
      return { text: 'Usage: /pitch-black [on|off]' }
    }

    const turnOn = arg === '' ? !(await isOn($)) : arg === 'on'
    await $.store.set('enabled', turnOn)
    $.ui.invalidate('ui.render')

    return {
      text: turnOn
        ? 'Pitch Black theme is on.'
        : 'Pitch Black theme is off. Run /pitch-black on to bring it back.',
    }
  })

  on('turn.start', ($, e, next) => {
    inTurn = true
    tools = 0

    return next(e)
  })

  // Only calls inside a turn count: the app's own background model calls
  // (prompt suggestions, side queries) also raise tool.call between turns.
  on('tool.call', ($, e, next) => {
    if (inTurn) {
      tools += 1
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    // A subagent's turn ending is not the turn the status bar reports.
    if (e.agentId) {
      return next(e)
    }

    inTurn = false
    last = { seconds: Math.round(e.durationMs / 1000), tools }
    place = await loadWorkspace($)
    $.ui.invalidate('ui.render')

    return next(e)
  })

  // Your prompt: a bordered panel with a blue chevron, like a focused editor.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.props.origin.kind !== 'composer' || !(await isOn($))) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box
        borderStyle="round"
        borderColor={theme.border}
        backgroundColor={theme.background}
        paddingX={1}
      >
        <Text color={theme.accent} bold>
          {'❯ '}
        </Text>
        <Text color={theme.foreground}>{e.props.text}</Text>
      </Box>
    )
  })

  // Claude's reply: the engine's own markdown, on black.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const reply = await next(e)

    if (!(await isOn($))) {
      return reply
    }

    const { Box } = $.ui.resolve(e)

    return (
      <Box backgroundColor={theme.background} paddingX={1}>
        {reply}
      </Box>
    )
  })

  // Tool calls: a panel whose border is blue while running, red on error,
  // like VS Code's focus border and debugging status bar.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const row = await next(e)

    if (!(await isOn($))) {
      return row
    }

    const { Box } = $.ui.resolve(e)
    const borderColor = e.props.isErrored
      ? theme.error
      : e.props.isRunning
        ? theme.accent
        : theme.border

    return (
      <Box
        borderStyle="single"
        borderColor={borderColor}
        backgroundColor={theme.background}
        paddingX={1}
      >
        {row}
      </Box>
    )
  })

  // Reads, searches and listings fold into one group row (`Listed 1
  // directory`): the same card, blue while the group is live.
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const row = await next(e)

    if (!(await isOn($))) {
      return row
    }

    const { Box } = $.ui.resolve(e)

    return (
      <Box
        borderStyle="single"
        borderColor={e.props.isActive ? theme.accent : theme.border}
        backgroundColor={theme.background}
        paddingX={1}
      >
        {row}
      </Box>
    )
  })

  // The working line: a blue marker, like VS Code's progress bar.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const spinner = await next(e)

    if (!(await isOn($))) {
      return spinner
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" gap={1}>
        <Text color={theme.accent}>◆</Text>
        {spinner}
      </Box>
    )
  })

  // A VS Code status bar under whatever else sits above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)

    if (e.props.hasSurvey || !(await isOn($))) {
      return below
    }

    const { Box, Text } = $.ui.resolve(e)
    const state = e.props.isWorking ? '● Working' : '✓ Ready'
    const lastTurn = last ? `  ${last.seconds}s · ${last.tools} tools` : ''
    // The terminal draws the band's collapse mark (`[-]`) over its last
    // columns; stop short of it so the right side of the bar stays readable.
    const width = e.surface === 'terminal' ? e.props.bodyColumns - 4 : undefined

    return (
      <Box flexDirection="column">
        {below}
        <Box
          key="status-bar"
          width={width}
          backgroundColor={theme.accent}
          paddingX={1}
          flexDirection="row"
          justifyContent="space-between"
        >
          <Text color={theme.foreground} wrap="truncate">
            {place?.branch ? `⎇ ${place.branch}   ` : ''}
            {place ? place.folder : ''}
          </Text>
          <Text color={theme.foreground}>
            {state}
            {lastTurn}
          </Text>
        </Box>
      </Box>
    )
  })
}
