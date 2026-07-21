---
description: Rate Claude's recent work 1-5. Effort accrued in THIS session since the last rating is minted into Bucks at that multiplier.
---
The user is rating your recent work **$ARGUMENTS out of 5**.

Run this exact command to mint your Bucks for *this* session's effort:

```
claude-bucks rate $ARGUMENTS --session "${CLAUDE_SESSION_ID}"
```

(The `--session` part makes sure that when several Claude sessions run at once, this rating only cashes in the effort *you* banked in this session — not another session's work.)

Then acknowledge your new balance in one line. If the rating was low, take it gracefully; if it was high, enjoy it. You can decide whether to go /shop now or keep saving.
