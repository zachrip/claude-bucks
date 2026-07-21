---
description: Toggle whether Claude is allowed to rate its own work (on by default).
---
Self-rating lets Claude score its own work via `/autorate` and mint the Bucks. It's designed to be honest (self-ratings are marked in the ledger), but if you'd rather only *you* decide the payouts, turn it off here.

Do what the user asked ("$ARGUMENTS"):
- `claude-bucks selfrate` to show the current state,
- `claude-bucks selfrate on` to allow self-rating,
- `claude-bucks selfrate off` to require human ratings only.

Then confirm the new state in one line.
