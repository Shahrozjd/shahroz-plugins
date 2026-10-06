# shahroz-plugins

My Claude Code plugins (terminal and the desktop Code tab).

| Plugin | What it does |
| --- | --- |
| [pitch-black](plugins/pitch-black) | Pitch Black VS Code theme for the chat |

Add the marketplace once, then install any plugin from it:

```
/plugin marketplace add /Users/shahroz/Development/shahroz-plugins
```

## Pitch Black

Black panels, white text, blue `#0178FF` accents and a blue VS Code status bar
above the prompt (git branch, folder, working state, last turn's time).

### Install

```
/plugin install pitch-black@shahroz-plugins
```

From GitHub, once this folder is pushed: `/plugin marketplace add <owner>/shahroz-plugins`.

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
