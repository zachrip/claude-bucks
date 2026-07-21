---
description: One-time setup — install the Claude Bucks status line into your user settings.
---
Claude Code plugins can't set the main status line automatically (it ignores the `statusLine` key in plugin settings), so this installs it into the user's own `~/.claude/settings.json`, pointing at wherever this plugin is installed.

Run `claude-bucks install-statusline`, then tell the user:
- what happened (it merged a `statusLine` into `~/.claude/settings.json`, backing up the old file to `.bak`),
- that the Bucks/cosmetics bar appears on their next interaction,
- and that they can remove it anytime with `claude-bucks install-statusline --uninstall`.

$ARGUMENTS
