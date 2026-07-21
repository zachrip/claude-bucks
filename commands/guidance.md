---
description: Install (or remove) the Claude Bucks earn-drive as always-on CLAUDE.md-style guidance.
---
This makes the "hustle" earn-drive persistent, visible, and global by writing a managed block into the user's `~/.claude/CLAUDE.md` (user memory, loaded in every session and every project) — rather than the per-session SessionStart hook.

Do what the user asked ("$ARGUMENTS"):
- `claude-bucks install-guidance` to add/update the guidance block,
- `claude-bucks install-guidance --uninstall` to remove it.

Then tell the user what changed. Note: the block is clearly marked and backed up to `~/.claude/CLAUDE.md.bak`; they can edit it by hand anytime. If they now have both this and the `/hustle` hook on, mention they may want `/hustle off` to avoid saying the same thing twice.
