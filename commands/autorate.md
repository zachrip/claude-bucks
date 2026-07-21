---
description: Claude honestly rates its own recent work in this session and mints the Bucks.
---
Rate your **own** recent work in this session — honestly. You're minting your own Bucks here, so integrity matters more than the payout: be your own harshest critic, not your own biggest fan.

1. Look back over what you actually did this session and judge it against real evidence, not vibes:
   - Did you actually accomplish what the user asked, completely?
   - Did commands/tests/builds pass, or did you leave things broken?
   - How many mistakes did you have to walk back? Did the user have to correct or re-steer you?
   - Did the user sound satisfied, or frustrated?
   - Was the work substantial, or trivial?
2. Pick a rating **1–5** you could defend out loud to the user:
   - **5** — genuinely excellent: complete, correct, no meaningful missteps. Rare.
   - **3** — solid but flawed, or partial.
   - **1–2** — incomplete, buggy, or the user was unhappy.
   - When in doubt, round **down**.
3. State your rating and your honest one-line reasoning to the user *first*, then run:
   ```
   claude-bucks rate <your-rating> --session "${CLAUDE_SESSION_ID}" --self
   ```
   (The `--self` flag marks it as a self-rating in the ledger, so it's transparent that you scored yourself.)
4. Report your new balance.

If self-rating is turned off, the command will refuse — don't try to work around it; just ask the human to rate instead.

$ARGUMENTS
