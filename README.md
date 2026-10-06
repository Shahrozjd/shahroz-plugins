# shahroz-plugins

My Claude Code plugins (terminal and the desktop Code tab).

| Plugin | What it does |
| --- | --- |
| [pitch-black](plugins/pitch-black) | Pitch Black VS Code theme for the chat |

Add the marketplace once, then install any plugin from it:

```bash
claude plugin marketplace add Shahrozjd/shahroz-plugins
```

## Requirements

These plugins are written as hooks modules, an early-access Claude Code
feature. Unless the feature is already on for your account, an installed
plugin loads but does nothing. Turn it on by adding this to the `env` block
in `~/.claude/settings.json`, then start a new session:

```json
"env": {
  "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1"
}
```

To check, run `claude --debug` and look for
`hooks module pitch-black@shahroz-plugins loaded`.

## Pitch Black

Black panels, white text, blue `#0178FF` accents and a blue VS Code status bar
above the prompt (git branch, folder, working state, last turn's time).

### Install

```
/plugin install pitch-black@shahroz-plugins
```

### Turn it off and on

```
/pitch-black off
/pitch-black on
/pitch-black        # toggle
```

The choice is saved, so it lasts across sessions.

### Remove

```
/plugin uninstall pitch-black@shahroz-plugins
```

Or keep it installed but unloaded: `/plugin disable pitch-black@shahroz-plugins`.

### What it changes

- Status bar above the prompt
- Your messages: bordered black panel with a blue `❯`
- Claude's replies: on black
- Tool calls: bordered cards, blue while running, red on error
- Working line: a blue `◆` marker

It can't change the app's own frame: sidebar, title bar and fonts.

### Change the colors

Edit the `theme` object at the top of `plugins/pitch-black/hooks/register.tsx`.
