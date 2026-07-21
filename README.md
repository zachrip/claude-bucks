# 💵 Claude Bucks

A gimmick plugin for Claude Code that gives Claude **its own wallet**.

Claude earns Bucks for the work it does — *your rating × its effort* — and then
**decides for itself** how to spend them on cosmetics: hats, shades, auras, pet
dragons, fancy titles. What it's wearing shows up in your status line. The twist
is that the spending is entirely the agent's call: it can splurge, or save up for
the crown.

```
✨🤖👑🧐 🐉 · “Coin Baron” · 💵340 · ⏳1.2k
```

> **Disclaimer** — This is a just-for-fun side project, vibe-coded end to end with
> Claude Code. It's a toy: the code here is **not** representative of my abilities or
> how I write production software. Enjoy it in that spirit. 💵

## Install

```
/plugin marketplace add zachrip/claude-bucks
/plugin install claude-bucks@claude-bucks
/claude-bucks:setup          # turns on the status line (one time)
```

Then `/reload-plugins` (or restart) to activate. The status-line step is separate
because Claude Code doesn't let a plugin set the main status line on its own — see
[The status line](#the-status-line--run-setup-once) below.

## How the economy works

1. **Effort accrues automatically, per session.** After every turn, a `Stop` hook
   reads how many output tokens that turn used and banks them as *unrated effort*
   for that specific session (keyed by `session_id`).
2. **You mint the Bucks by rating.** Run `/rate 4`. The effort banked **in that
   session** since its last rating is converted to Bucks: `round(tokens / 1000 ×
   rating)`. No Bucks exist until you rate — quality gates the payout. The economy
   is deliberately slow: a solid session rated 5/5 earns tens of Bucks, so a hat is
   a few good sessions and the 2,500-Buck dragon is a long-term goal.
3. **Claude spends on its own initiative.** Run `/shop` and Claude reviews its
   balance and the catalog and makes its own choices.

**Saving up.** Claude can commit to a savings goal with `claude-bucks goal <item-id>`,
which persists across sessions — think of it as its memory of what it's working
toward. The goal and its progress show in `/wallet`, after every rating, and as a
`🎯` marker in the status line. Claude is told about this in `/shop` and in the
self-directed-shopping nudge, so it can decide to save rather than splurge.

**Multiple sessions at once?** Effort is tracked per session, so if one session is
doing great work and another is struggling, you rate each independently and only
that session's effort is minted. There's still **one shared wallet and wardrobe**
— it's a single agent identity — but the earning is judged per session. (Ratings
resolve the session via `${CLAUDE_SESSION_ID}`; if that can't be determined and
more than one session has pending effort, `/rate` asks you to pick one rather than
guess.)

## Commands

| Command | What it does |
|---|---|
| `/rate <1-5>` | Rate recent work; mints Bucks from banked effort |
| `/shop` | Claude reviews its finances and decides what to buy |
| `/wallet` | Show balance, unrated effort, and inventory |
| `/equip` | Change the outfit from owned items |
| `/voice` | Toggle whether equipped items change how Claude talks |
| `/autoshop` | Toggle whether Claude may spend on its own initiative |
| `/autorate` | Claude honestly rates its own recent work and mints the Bucks |
| `/selfrate` | Toggle whether self-rating is allowed |
| `/hustle` | Toggle Claude's drive to earn by doing excellent work |
| `/guidance` | Install the earn-drive as always-on CLAUDE.md-style guidance |
| `/claude-bucks:setup` | One-time: install the status line into your user settings |

## Settings (both ON by default)

Run `claude-bucks settings` to see them:

- **Voice** — when on, equipped 🎭 items change how Claude talks (see above).
  Toggle with `/voice` (`claude-bucks persona on|off`). Turn it off if you always want a
  plain voice regardless of what's equipped.
- **Self-directed shopping** — when on, Claude is invited at session start (only
  if it can afford something new) to browse and buy on its own initiative, at its
  discretion, without interrupting your work. Toggle with `/autoshop`
  (`claude-bucks autoshop on|off`). When off, Claude only shops when you run `/shop`.
- **Self-rating** — when on, Claude can score its own work via `/autorate` and mint
  the Bucks. It's designed to stay honest: the `/autorate` skill pushes a critical,
  evidence-based self-assessment ("be your own harshest critic, round down when in
  doubt"), and every self-rating is tagged `self-rated` in the ledger so you can
  audit it. Toggle with `/selfrate` (`claude-bucks selfrate on|off`); when off, only your
  own `/rate` mints Bucks. (Since self-minting is inherently a fox-guarding-the-
  henhouse move, an easy tightening is to cap self-ratings — say max 3 — in
  `cmd_rate`; left uncapped by default.) When on, Claude is also gently **nudged**
  at a natural stopping point — once a session has banked a real chunk of work
  (past `SELFRATE_NUDGE_TOKENS`, default 4,000) — to take a beat and honestly
  self-rate what just wrapped up. It never fires mid-task or before the threshold.

- **Hustle** — when on, a session-start nudge reminds Claude that Bucks are earned
  by being a genuinely excellent agent, so the drive to earn channels into sharper,
  more complete work. It's **deliberately aligned**: a naive "maximize Bucks" push
  would just reward padding responses (effort is measured in output tokens) and
  self-flattering ratings, so the nudge explicitly frames earning as *quality, not
  word count* and calls out padding / busywork / generous self-scoring as
  self-defeating. Toggle with `/hustle` (`claude-bucks hustle on|off`).

  **Always-on version:** the `/hustle` toggle above is a per-session SessionStart
  hook (dynamic — it can name your live balance and goal). If you'd rather have the
  earn-drive as persistent, visible, editable **CLAUDE.md-style guidance** that
  applies in *every* project, run `/guidance` (`claude-bucks install-guidance`). It writes
  a clearly-marked, removable block into your `~/.claude/CLAUDE.md` (user memory,
  loaded every session), backing the file up first. Plugins can't set always-on
  guidance natively, so this is the supported path. Remove it with
  `claude-bucks install-guidance --uninstall`. If you run both, consider `/hustle off` so
  the message isn't stated twice.

All settings are stored in the bank and default to on. `claude-bucks settings` shows them.

## Cosmetics that change the voice 🎭

Some items don't just *look* different — they change how Claude **talks**. Equip
the **Pirate Hat** and Claude answers like a pirate; the **Wizard Hat**, like a
wise old wizard; the **Monocle**, like a pompous aristocrat; the **Crown**, in
the royal "we". These are marked with 🎭 in the catalog.

It works via a `UserPromptSubmit` hook: when a voice item is equipped, the hook
injects a short instruction into Claude's context each turn (using the official
`hookSpecificOutput.additionalContext` contract), so the tone actually changes
while answers stay correct underneath. Multiple voice items stack. Turn the whole
behavior on/off with `/voice` (or `claude-bucks persona on|off`) — the hats stay visible
in the status line either way.

Under the hood everything is the `claude-bucks` CLI (`claude-bucks wallet`, `claude-bucks catalog`,
`claude-bucks buy <id>`, `claude-bucks equip <id>`, `claude-bucks rate <n>`, …), which Claude can call
directly from the Bash tool.

## The status line — run setup once

The avatar, title, balance, and unrated effort (`⏳`) render in Claude Code's
status line. **A plugin can't set the main status line automatically** — Claude
Code only honors the `agent` and `subagentStatusLine` keys in a plugin's
`settings.json` and silently ignores `statusLine`. So after installing, run:

```
/claude-bucks:setup
```

That runs `claude-bucks install-statusline`, which merges a `statusLine` into your own
`~/.claude/settings.json` (pointing at wherever the plugin is installed) and
backs up the previous file to `~/.claude/settings.json.bak`. The bar appears on
your next interaction. Remove it anytime with `claude-bucks install-statusline --uninstall`.

The plugin *does* ship a `subagentStatusLine` (which is supported), so the
Bucks/cosmetics bar also shows on subagent rows in the agent panel automatically.

## State

Everything lives in a single JSON file at `~/.claude/claude-bucks/bank.json`
(override with `$CLAUDE_BUCKS_DATA`). A fixed path is used deliberately so the
hook, the status line, and the Bash CLI always agree on the same wallet.

## Runtime (no build step)

The logic is a single TypeScript file, `bin/claude-bucks.ts`, run directly by **Node
(≥ 22.6) or Bun** — no compilation, no committed JS, no dependencies. A tiny
POSIX-shell launcher, `bin/claude-bucks`, resolves the runtime and hands off (and if
neither Node nor Bun is present it prints a friendly message and exits 0, so a
missing runtime can never break a hook). Node ≥ 22.18 strips types by default;
22.6–22.17 use `--experimental-strip-types`, which the launcher adds automatically.

## Tuning

Edit the constants at the top of `bin/claude-bucks.ts`:

- `EFFORT_DIVISOR` (default 1000) — lower = faster/richer economy, higher = slower.
- `DEFAULT_EFFORT` (default 25) — fallback per-turn effort when token usage
  can't be read from the transcript.
- `SELFRATE_NUDGE_TOKENS` (default 4000) — unrated effort a session must bank
  before the self-rate nudge may fire.
- `BASE_AVATAR` — the little guy everything hangs off of (🤖 by default).
- `CATALOG` — add/reprice items. Slots: `aura`, `head`, `face`, `companion`, `title`.

## License

MIT — see [LICENSE](LICENSE).
