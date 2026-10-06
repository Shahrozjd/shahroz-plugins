import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

// Stands in for the engine beneath the mod: its own drawing, and a store in
// memory holding what the mod saved.
const engine = (on: On, store: Record<string, unknown> = {}) => {
  on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'engine row' }))
  mock.store(on, store)
}

// The input a person typing `/pitch-black <args>` raises.
const typed = (args = '') => ({
  command: 'pitch-black',
  args,
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 80 },
}) as const

const SURFACES = ['terminal', 'desktop'] as const

const BAND = {
  plugin: 'pitch-black',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: true,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const

const toolRow = (isRunning: boolean, isErrored: boolean) =>
  ({
    plugin: 'pitch-black',
    component: 'ToolUse',
    props: {
      tool_use_id: 'toolu_1',
      tool: 'Bash',
      input: { command: 'ls' },
      isRunning,
      isErrored,
      isInterrupted: false,
    },
  }) as const

test('status bar shows the working state in the accent blue', async ($, on) => {
  engine(on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const state = await ui.find({ type: 'Text', text: /Working/ })
    const bar = await ui.find({ key: 'status-bar' })

    expect(state).toBeDefined()
    expect(bar?.props.backgroundColor).toBe('#0178FF')
    await ui.unmount()
  }
})

test('status bar steps aside for a survey', async ($, on) => {
  engine(on)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      ...BAND,
      surface,
      props: { ...BAND.props, hasSurvey: true },
    })

    expect(await ui.find({ type: 'Text', text: /Working|Ready/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('tool card border follows the call state', async ($, on) => {
  engine(on)
  const cases = [
    { isRunning: true, isErrored: false, color: '#0178FF' },
    { isRunning: false, isErrored: true, color: '#EA3323' },
    { isRunning: false, isErrored: false, color: '#333333' },
  ]

  for (const surface of SURFACES) {
    for (const { isRunning, isErrored, color } of cases) {
      const ui = await $.ui.mount({ ...toolRow(isRunning, isErrored), surface })
      const card = await ui.find({ type: 'Box' })

      expect(card?.props.borderColor).toBe(color)
      await ui.unmount()
    }
  }
})

test('/pitch-black off removes the theme and on brings it back', async ($, on) => {
  engine(on)

  const off = await $.command.run(typed('off'))
  expect(off.text).toContain('off')

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ key: 'status-bar' })).toBeUndefined()
    await ui.unmount()

    const tool = await $.ui.mount({ ...toolRow(true, false), surface })
    expect(await tool.find({ type: 'Box' })).toBeUndefined()
    await tool.unmount()
  }

  await $.command.run(typed('on'))

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ key: 'status-bar' })).toBeDefined()
    await ui.unmount()
  }
})

test('/pitch-black with no argument toggles, and rejects anything else', async ($, on) => {
  engine(on, { enabled: false })

  expect((await $.command.run(typed())).text).toContain('on')
  expect((await $.command.run(typed())).text).toContain('off')
  expect((await $.command.run(typed('blue'))).text).toContain(
    'Usage',
  )
})

test('grouped tool rows get the same card as single tool rows', async ($, on) => {
  engine(on)
  const group = (isActive: boolean) =>
    ({
      plugin: 'pitch-black',
      component: 'ToolGroup',
      props: {
        calls: [
          { tool: 'Bash', input: { command: 'ls' }, isRunning: isActive, isErrored: false, isInterrupted: false },
        ],
        isActive,
        isExpanded: false,
      },
    }) as const

  for (const surface of SURFACES) {
    for (const [isActive, color] of [[true, '#0178FF'], [false, '#333333']] as const) {
      const ui = await $.ui.mount({ ...group(isActive), surface })
      expect((await ui.find({ type: 'Box' }))?.props.borderColor).toBe(color)
      await ui.unmount()
    }
  }
})

test('status bar leaves room for the terminal band collapse mark', async ($, on) => {
  engine(on)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ key: 'status-bar' }))?.props.width).toBe(BAND.props.bodyColumns - 4)
  await ui.unmount()
})

test('status bar counts only the tool calls made inside a turn', async ($, on) => {
  engine(on)
  on('tool.call', () => ({ result: {} }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  const done = { answer: '', isAborted: false, reason: 'answer' } as const

  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.turn.complete({ ...done, turnId: 't1', durationMs: 4200 })
  // A background model call between turns.
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  // A subagent's turn ending does not replace the main turn's numbers.
  await $.turn.complete({ ...done, turnId: 'sub', durationMs: 99000, agentId: 'a1' })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /4s · 1 tools/ })).toBeDefined()
  await ui.unmount()
})
