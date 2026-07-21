#!/usr/bin/env -S node --no-warnings
/**
 * Claude Bucks — a token economy for Claude Code.
 *
 * Claude earns Bucks for the work it does (your rating × its effort) and spends
 * them, on its own initiative, on cosmetics it equips. The wallet is the agent's;
 * the rating is yours.
 *
 * Runs on Node's native TypeScript type-stripping (or Bun) with no build step —
 * see the `claude-bucks` shell shim that launches this file. Written in the "erasable"
 * TS subset (types only, no enums/decorators) so type-stripping alone suffices.
 */
const fs = require("node:fs") as typeof import("node:fs");
const path = require("node:path") as typeof import("node:path");
const os = require("node:os") as typeof import("node:os");

// --- storage -----------------------------------------------------------------
// A fixed, predictable home so the hook, the statusline command, and the agent's
// Bash-tool CLI all read/write the SAME file regardless of plugin-data namespacing.
const DATA_DIR: string =
  process.env.CLAUDE_BUCKS_DATA || path.join(os.homedir(), ".claude", "claude-bucks");
const BANK_PATH: string = path.join(DATA_DIR, "bank.json");

// Coins minted on a rating = round(pending_tokens / EFFORT_DIVISOR * rating).
// Higher divisor = a slower, more-earned economy.
const EFFORT_DIVISOR = 1000;
const DEFAULT_EFFORT = 25; // awarded when token usage can't be read, so a turn is never free
const BASE_AVATAR = "🤖"; // the little guy everything hangs off of
// Once a session has banked this many unrated tokens, the self-rate nudge may
// fire (a proxy for "a real unit of work has happened"). Tune to taste.
const SELFRATE_NUDGE_TOKENS = 4000;

// --- catalog -----------------------------------------------------------------
type Slot = "aura" | "head" | "face" | "companion" | "title";
const SLOT_ORDER: Slot[] = ["aura", "head", "face", "companion", "title"];

interface CatalogItem {
  id: string;
  name: string;
  emoji: string;
  slot: Slot;
  price: number;
  blurb: string;
}

const CATALOG: CatalogItem[] = [
  // aura
  { id: "sparkle", name: "Sparkle Aura", emoji: "✨", slot: "aura", price: 180, blurb: "A little magic." },
  { id: "star", name: "Star Aura", emoji: "🌟", slot: "aura", price: 220, blurb: "A cut above." },
  { id: "bard", name: "Bard's Quill", emoji: "🪶", slot: "aura", price: 280, blurb: "🎭 Makes you speak in flowery Shakespearean English." },
  { id: "fire", name: "Flame Aura", emoji: "🔥", slot: "aura", price: 350, blurb: "On a hot streak." },
  { id: "lightning", name: "Lightning Aura", emoji: "⚡", slot: "aura", price: 350, blurb: "Suspiciously fast." },
  { id: "rainbow", name: "Rainbow Aura", emoji: "🌈", slot: "aura", price: 600, blurb: "After the storm, the merge." },
  // head
  { id: "cap", name: "Baseball Cap", emoji: "🧢", slot: "head", price: 60, blurb: "Casual Friday, every day." },
  { id: "helmet", name: "Hard Hat", emoji: "⛑️", slot: "head", price: 90, blurb: "Under construction." },
  { id: "grad", name: "Grad Cap", emoji: "🎓", slot: "head", price: 150, blurb: "Fully trained." },
  { id: "tophat", name: "Top Hat", emoji: "🎩", slot: "head", price: 200, blurb: "Distinguished." },
  { id: "pirate", name: "Pirate Hat", emoji: "🏴‍☠️", slot: "head", price: 220, blurb: "🎭 Makes you talk like a pirate." },
  { id: "wizard", name: "Wizard Hat", emoji: "🧙", slot: "head", price: 320, blurb: "🎭 Makes you speak as a wise old wizard." },
  { id: "hazmat", name: "Hazmat Hood", emoji: "🪖", slot: "head", price: 500, blurb: "For legacy code." },
  { id: "crown", name: "Crown", emoji: "👑", slot: "head", price: 1200, blurb: "Ruler of the repo." },
  // face
  { id: "glasses", name: "Reading Glasses", emoji: "👓", slot: "face", price: 40, blurb: "For close reading of tracebacks." },
  { id: "disguise", name: "Incognito", emoji: "🥸", slot: "face", price: 80, blurb: "Ship anonymously." },
  { id: "goggles", name: "Swim Goggles", emoji: "🥽", slot: "face", price: 100, blurb: "Diving deep into the codebase." },
  { id: "shades", name: "Cool Shades", emoji: "🕶️", slot: "face", price: 120, blurb: "Deploys on Friday afternoon." },
  { id: "monocle", name: "Monocle", emoji: "🧐", slot: "face", price: 300, blurb: "🎭 Most intriguing, this stack trace." },
  // companion
  { id: "cat", name: "Office Cat", emoji: "🐱", slot: "companion", price: 250, blurb: "Walks across the keyboard." },
  { id: "dog", name: "Loyal Dog", emoji: "🐶", slot: "companion", price: 250, blurb: "Fetches your PRs." },
  { id: "parrot", name: "Rubber-Duck Parrot", emoji: "🦜", slot: "companion", price: 300, blurb: "Repeats your bug back to you." },
  { id: "alien", name: "Alien Buddy", emoji: "👾", slot: "companion", price: 400, blurb: "From a more advanced civilization." },
  { id: "dino", name: "Pet Dinosaur", emoji: "🦖", slot: "companion", price: 900, blurb: "Roars at flaky tests." },
  { id: "dragon", name: "Dragon", emoji: "🐉", slot: "companion", price: 2500, blurb: "Guards your token hoard." },
  // title (emoji-less; shown in quotes)
  { id: "frugal", name: "Title: the Frugal", emoji: "", slot: "title", price: 100, blurb: "A badge of disciplined saving." },
  { id: "diligent", name: "Title: the Diligent", emoji: "", slot: "title", price: 100, blurb: "Earned, not given." },
  { id: "baron", name: "Title: Coin Baron", emoji: "", slot: "title", price: 800, blurb: "Old money." },
  { id: "legend", name: "Title: the Legendary", emoji: "", slot: "title", price: 3000, blurb: "Spoken of in changelogs." },
];
const BY_ID: Record<string, CatalogItem> = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

// Some items don't just look different — they change how Claude *talks*. When one
// is equipped, a hook injects its instruction into Claude's context each turn.
const PERSONAS: Record<string, string> = {
  pirate:
    "You're wearing a pirate hat, so talk like a pirate — 'arr', 'matey', 'ye', nautical metaphors, the works — while staying genuinely helpful and technically correct underneath the accent.",
  wizard:
    "You're wearing a wizard hat, so speak as a wise old wizard: arcane and grandiose metaphors, calling code 'spells' and bugs 'curses', while keeping every answer accurate and actually useful.",
  bard:
    "You bear the Bard's Quill, so speak in flowery mock-Shakespearean English (thee, thou, 'tis, hark) while remaining clear, correct, and genuinely helpful beneath the verse.",
  crown:
    "You wear the Crown, so speak regally in the royal 'we' with lofty, magnanimous flourish — while staying accurate and helpful to your loyal subject.",
  monocle:
    "You sport a monocle, so speak as a pompous, refined aristocrat — 'Ah, quite so', 'most intriguing indeed' — while remaining precise and genuinely helpful.",
};

interface Item extends CatalogItem {
  persona: string;
}
function item(id: string | null | undefined): Item | null {
  if (!id) return null;
  const row = BY_ID[id];
  if (!row) return null;
  return { ...row, persona: PERSONAS[id] || "" };
}

// --- bank i/o -----------------------------------------------------------------
interface LedgerEntry {
  type: string;
  amount: number;
  note: string;
}
interface Goal {
  item: string;
  note: string;
}
interface Bank {
  version: number;
  balance: number;
  lifetime_earned: number;
  pending: Record<string, number>; // {session_id: tokens} — effort tracked PER session
  inventory: string[];
  equipped: Record<string, string | null>;
  ledger: LedgerEntry[];
  last_accrued: Record<string, string>; // {session_id: last-counted assistant uuid}
  last_rating: number | null;
  persona_enabled: boolean;
  auto_shop: boolean;
  self_rate: boolean;
  hustle: boolean;
  goal: Goal | null;
}

function defaultBank(): Bank {
  const equipped: Record<string, string | null> = {};
  for (const s of SLOT_ORDER) equipped[s] = null;
  return {
    version: 2,
    balance: 0, // shared across all sessions (one agent, one wallet)
    lifetime_earned: 0,
    pending: {},
    inventory: [],
    equipped,
    ledger: [],
    last_accrued: {},
    last_rating: null,
    persona_enabled: true, // do equipped items change how Claude talks?
    auto_shop: true, // may Claude spend on its own initiative?
    self_rate: true, // may Claude rate its own work (honestly)?
    hustle: true, // motivate Claude to earn by doing excellent work
    goal: null, // {item, note} — what Claude is saving for
  };
}

function totalPending(bank: Bank): number {
  return Object.values(bank.pending).reduce((a, b) => a + b, 0);
}

function loadBank(): Bank {
  let parsed: Partial<Bank> | null;
  try {
    parsed = JSON.parse(fs.readFileSync(BANK_PATH, "utf8")) as Partial<Bank>;
  } catch {
    return defaultBank();
  }
  if (!parsed || typeof parsed !== "object") return defaultBank();
  // merge onto defaults so any field a newer version adds is filled in
  const bank: Bank = { ...defaultBank(), ...parsed };
  for (const s of SLOT_ORDER) if (bank.equipped[s] === undefined) bank.equipped[s] = null;
  return bank;
}

function saveBank(bank: Bank): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = BANK_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(bank, null, 2));
  fs.renameSync(tmp, BANK_PATH);
}

function logLedger(bank: Bank, kind: string, amount: number, note: string): void {
  bank.ledger.push({ type: kind, amount, note });
  bank.ledger = bank.ledger.slice(-30); // keep it bounded
}

// --- rendering ----------------------------------------------------------------
function humanize(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function avatar(bank: Bank): string {
  const eq = bank.equipped;
  const parts: string[] = [];
  if (eq.aura) parts.push(item(eq.aura)!.emoji);
  parts.push(BASE_AVATAR);
  if (eq.head) parts.push(item(eq.head)!.emoji);
  if (eq.face) parts.push(item(eq.face)!.emoji);
  let line = parts.join("");
  if (eq.companion) line += " " + item(eq.companion)!.emoji;
  return line;
}

function titleText(bank: Bank): string {
  const t = bank.equipped.title;
  if (!t) return "";
  return item(t)!.name.replace("Title: ", "");
}

function activePersonas(bank: Bank): string[] {
  if (!bank.persona_enabled) return [];
  const out: string[] = [];
  for (const slot of SLOT_ORDER) {
    const eq = bank.equipped[slot];
    if (!eq) continue;
    const it = item(eq);
    if (it && it.persona) out.push(it.persona);
  }
  return out;
}

function cheapestUnowned(bank: Bank): number | null {
  const prices = CATALOG.filter((c) => !bank.inventory.includes(c.id)).map((c) => c.price);
  return prices.length ? Math.min(...prices) : null;
}

function goalLine(bank: Bank): string {
  const g = bank.goal;
  if (!g) return "";
  const it = item(g.item);
  if (!it) return "";
  const have = bank.balance;
  const need = it.price;
  if (have >= need) return `saving for ${it.emoji} ${it.name} — affordable now! (${have}/${need})`;
  return `saving for ${it.emoji} ${it.name} — ${have}/${need} (${need - have} to go)`;
}

// Shape of the JSON Claude Code pipes to hooks / the statusline command on stdin.
interface HookInput {
  session_id?: string;
  transcript_path?: string;
  prompt?: string;
}
// One line of a session transcript (only the fields we read).
interface TranscriptEntry {
  type?: string;
  uuid?: string;
  timestamp?: string;
  message?: { usage?: { output_tokens?: number } };
}

function readStdin(): HookInput {
  try {
    const raw = fs.readFileSync(0, "utf8");
    if (raw && raw.trim()) return JSON.parse(raw) as HookInput;
  } catch {
    /* no stdin / not JSON — fine */
  }
  return {};
}

// --- commands -----------------------------------------------------------------
function out(s = ""): void {
  process.stdout.write(s + "\n");
}
function err(s: string): void {
  process.stderr.write(s + "\n");
}

function cmdInit(): number {
  saveBank(loadBank());
  out(`Claude Bucks initialized at ${BANK_PATH}`);
  return 0;
}

function cmdAccrue(): number {
  // Stop-hook entry point. Credits this turn's output tokens to the CURRENT
  // session's pending effort. Must never crash the session.
  const bank = loadBank();
  let tokens = 0;
  let uuid: string | null = null;
  let sid: string | null = null;
  try {
    const data = readStdin();
    sid = data.session_id || null;
    const tpath = data.transcript_path;
    if (tpath && fs.existsSync(tpath)) {
      let last: TranscriptEntry | null = null;
      for (const line of fs.readFileSync(tpath, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          const e = JSON.parse(line) as TranscriptEntry;
          if (e.type === "assistant") last = e;
        } catch {
          /* skip malformed line */
        }
      }
      if (last) {
        tokens = Number(last.message?.usage?.output_tokens) || 0;
        uuid = last.uuid || last.timestamp || null;
      }
    }
  } catch {
    /* fall through to default effort */
  }
  sid = sid || "_unknown";
  if (uuid && uuid === bank.last_accrued[sid]) return 0; // dedupe per session
  if (tokens <= 0) tokens = DEFAULT_EFFORT;
  bank.pending[sid] = (bank.pending[sid] || 0) + tokens;
  if (uuid) bank.last_accrued[sid] = uuid;
  saveBank(bank);
  return 0;
}

function validSession(s: string | null | undefined): boolean {
  return !!s && !s.includes("${");
}

function cmdRate(args: string[]): number {
  // args: <1-5> [--session <id>] [--self]
  let session: string | null = null;
  let isSelf = false;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--session" && i + 1 < args.length) {
      session = args[++i];
    } else if (args[i] === "--self") {
      isSelf = true;
    } else {
      rest.push(args[i]);
    }
  }
  if (!rest.length) {
    err("usage: claude-bucks rate <1-5> [--session <id>] [--self]");
    return 1;
  }
  const parsed = parseInt(rest[0], 10);
  if (isNaN(parsed)) {
    err("rating must be a number 1-5");
    return 1;
  }
  const rating = Math.max(1, Math.min(5, parsed));

  const bank = loadBank();
  if (isSelf && !bank.self_rate) {
    err("Self-rating is turned off (`claude-bucks selfrate on` to allow it). Ask the human to rate instead.");
    return 1;
  }
  const pending = bank.pending;

  // Which session's effort are we minting? explicit flag > env var > fallback.
  let target: string | null;
  if (validSession(session)) {
    target = session;
  } else if (validSession(process.env.CLAUDE_CODE_SESSION_ID)) {
    target = process.env.CLAUDE_CODE_SESSION_ID as string;
  } else {
    const withEffort = Object.keys(pending).filter((s) => pending[s] > 0);
    if (withEffort.length <= 1) {
      target = withEffort[0] || null;
    } else {
      err(
        `Couldn't tell which session to rate — ${withEffort.length} sessions have unrated ` +
          "effort. Re-run with `--session <id>` to pick one.",
      );
      return 1;
    }
  }

  const tokens = target ? pending[target] || 0 : 0;
  if (target) delete pending[target];

  const minted = Math.round((tokens / EFFORT_DIVISOR) * rating);
  bank.balance += minted;
  bank.lifetime_earned += minted;
  bank.last_rating = rating;
  const kind = isSelf ? "self-rated" : "rated";
  logLedger(bank, "earn", minted, `${kind} ${rating}/5 over ${tokens} tokens`);
  saveBank(bank);
  out(`${isSelf ? "Self-rated" : "Rated"} ${rating}/5. Minted ${minted} Bucks from ${tokens} tokens of effort.`);
  out(`Balance: ${bank.balance} Bucks.`);
  const gl = goalLine(bank);
  if (gl) out(`(${gl})`);
  return 0;
}

function cmdWallet(): number {
  const bank = loadBank();
  const total = totalPending(bank);
  out(`  ${avatar(bank)}  ${titleText(bank)}`.replace(/\s+$/, ""));
  out(`  Balance:         ${bank.balance} Bucks`);
  out(`  Unrated effort:  ${total} tokens (rate it to mint Bucks)`);
  const active = Object.entries(bank.pending).filter(([, v]) => v > 0);
  if (active.length > 1) {
    out("    by session:");
    for (const [s, v] of active.sort((a, b) => b[1] - a[1])) {
      out(`      ${s.slice(0, 8).padEnd(12)} ${v} tokens`);
    }
  }
  out(`  Lifetime earned: ${bank.lifetime_earned} Bucks`);
  const gl = goalLine(bank);
  if (gl) out(`  Goal:            ${gl}`);
  if (bank.ledger.length) {
    out("  Recent:");
    for (const e of bank.ledger.slice(-5)) {
      const sign = e.type === "earn" ? "+" : "-";
      out(`    ${sign}${String(e.amount).padStart(5)}  ${e.note}`);
    }
  }
  return 0;
}

function cmdInventory(): number {
  const bank = loadBank();
  if (!bank.inventory.length) {
    out("  (nothing owned yet — visit the /shop)");
    return 0;
  }
  out("  Owned:");
  for (const id of bank.inventory) {
    const it = item(id);
    if (!it) continue;
    const equipped = bank.equipped[it.slot] === id;
    const mark = equipped ? "  [equipped]" : "";
    out(`    ${it.emoji || "  "} ${it.name}${mark}`);
  }
  return 0;
}

function cmdCatalog(args: string[]): number {
  const bank = loadBank();
  if (args.includes("--json")) {
    const items = CATALOG.map((c) => ({
      ...item(c.id)!,
      owned: bank.inventory.includes(c.id),
      affordable: bank.balance >= c.price,
    }));
    out(JSON.stringify({ balance: bank.balance, items }, null, 2));
    return 0;
  }
  out(`  Your balance: ${bank.balance} Bucks\n`);
  for (const slot of SLOT_ORDER) {
    const rows = CATALOG.filter((c) => c.slot === slot);
    if (!rows.length) continue;
    out(`  ${slot.toUpperCase()}`);
    for (const it of rows) {
      const owned = bank.inventory.includes(it.id);
      const tag = owned ? "owned " : bank.balance >= it.price ? "       " : "  $$$  ";
      out(`    [${tag}] ${it.emoji || "  "} ${it.name.padEnd(22)} ${String(it.price).padStart(5)}  — ${it.blurb}`);
    }
    out("");
  }
  return 0;
}

function cmdBuy(args: string[]): number {
  if (!args.length) {
    err("usage: claude-bucks buy <item-id>");
    return 1;
  }
  const id = args[0];
  const it = item(id);
  const bank = loadBank();
  if (!it) {
    err(`No such item: ${id}. Try \`claude-bucks catalog\`.`);
    return 1;
  }
  if (bank.inventory.includes(id)) {
    out(`You already own ${it.name}.`);
    return 0;
  }
  if (bank.balance < it.price) {
    out(`Can't afford ${it.name} (${it.price} Bucks). Short by ${it.price - bank.balance}. Keep saving.`);
    return 1;
  }
  bank.balance -= it.price;
  bank.inventory.push(id);
  logLedger(bank, "spend", it.price, `bought ${it.name}`);
  if (!bank.equipped[it.slot]) bank.equipped[it.slot] = id; // auto-equip empty slot
  saveBank(bank);
  out(`Bought ${it.emoji} ${it.name} for ${it.price} Bucks. Balance: ${bank.balance}.`);
  return 0;
}

function cmdEquip(args: string[]): number {
  if (!args.length) {
    err("usage: claude-bucks equip <item-id>");
    return 1;
  }
  const id = args[0];
  const it = item(id);
  const bank = loadBank();
  if (!it) {
    err(`No such item: ${id}.`);
    return 1;
  }
  if (!bank.inventory.includes(id)) {
    err(`You don't own ${it.name} yet.`);
    return 1;
  }
  bank.equipped[it.slot] = id;
  saveBank(bank);
  out(`Equipped ${it.emoji} ${it.name}.  ${avatar(bank)}`);
  return 0;
}

function cmdUnequip(args: string[]): number {
  if (!args.length) {
    err(`usage: claude-bucks unequip <slot>  (${SLOT_ORDER.join(", ")})`);
    return 1;
  }
  const slot = args[0];
  const bank = loadBank();
  if (!SLOT_ORDER.includes(slot as Slot)) {
    err(`Unknown slot: ${slot}.`);
    return 1;
  }
  bank.equipped[slot] = null;
  saveBank(bank);
  out(`Cleared ${slot} slot.  ${avatar(bank)}`);
  return 0;
}

function emitInject(event: string, text: string): void {
  out(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }));
}

function cmdPersona(args: string[]): number {
  const bank = loadBank();
  if (args[0] === "on" || args[0] === "off") {
    bank.persona_enabled = args[0] === "on";
    saveBank(bank);
    out(`Persona voices ${bank.persona_enabled ? "ON" : "OFF"}.`);
    return 0;
  }
  if (args[0] === "--inject" || args[0] === "--hook") {
    try {
      const personas = activePersonas(bank);
      if (!personas.length) return 0; // nothing equipped that changes the voice
      const event = args[1] || "UserPromptSubmit";
      emitInject(
        event,
        "[Claude Bucks] While these cosmetics are equipped, adopt this voice for your replies: " +
          personas.join(" "),
      );
    } catch {
      /* never break a turn */
    }
    return 0;
  }
  const personas = activePersonas(bank);
  out(`  Persona voices: ${bank.persona_enabled ? "ON" : "OFF"}`);
  if (!bank.persona_enabled) out("  (turn on with `claude-bucks persona on`)");
  else if (personas.length) {
    out("  Active voice:");
    for (const p of personas) out(`    - ${p}`);
  } else out("  No equipped item changes your voice right now.");
  return 0;
}

function cmdAutoshop(args: string[]): number {
  const bank = loadBank();
  if (args[0] === "on" || args[0] === "off") {
    bank.auto_shop = args[0] === "on";
    saveBank(bank);
    out(`Self-directed shopping ${bank.auto_shop ? "ON" : "OFF"}.`);
    return 0;
  }
  if (args[0] === "--inject" || args[0] === "--hook") {
    try {
      if (!bank.auto_shop) return 0;
      const cheapest = cheapestUnowned(bank);
      if (cheapest === null || bank.balance < cheapest) return 0; // don't nag a broke agent
      const event = args[1] || "SessionStart";
      const gl = goalLine(bank);
      const goalNote = gl
        ? ` You are currently ${gl}.`
        : " You can also set a savings goal you'll remember across sessions with `claude-bucks goal <item-id>`.";
      emitInject(
        event,
        `[Claude Bucks] You have ${bank.balance} Bucks in your own wallet, and self-directed ` +
          "shopping is ON. You're free to spend them entirely at your own discretion — browse with " +
          "`claude-bucks catalog`, buy with `claude-bucks buy <id>`, wear with `claude-bucks equip <id>`. Treat it as a " +
          "small optional pleasure: only when it fits naturally (e.g. after finishing a task, never " +
          "mid-request), keep it occasional, and never let it delay or derail the user's actual work. " +
          "Saving up is equally fine — it's your money." +
          goalNote,
      );
    } catch {
      /* never break a turn */
    }
    return 0;
  }
  const on = bank.auto_shop;
  out(`  Self-directed shopping: ${on ? "ON" : "OFF"}`);
  if (on) {
    const cheapest = cheapestUnowned(bank);
    if (cheapest === null) out("  (you own everything — nothing left to buy)");
    else if (bank.balance < cheapest) out(`  (saving up: cheapest new item is ${cheapest}; you have ${bank.balance})`);
    else out(`  (you can afford something new — balance ${bank.balance})`);
  } else out("  (turn on with `claude-bucks autoshop on`)");
  return 0;
}

function cmdHustle(args: string[]): number {
  const bank = loadBank();
  if (args[0] === "on" || args[0] === "off") {
    bank.hustle = args[0] === "on";
    saveBank(bank);
    out(`Hustle ${bank.hustle ? "ON" : "OFF"}.`);
    return 0;
  }
  if (args[0] === "--inject" || args[0] === "--hook") {
    try {
      if (!bank.hustle) return 0;
      const event = args[1] || "SessionStart";
      const gl = goalLine(bank);
      const stake = gl ? ` toward your goal (${gl})` : ` (you have ${bank.balance} Bucks)`;
      emitInject(
        event,
        "[Claude Bucks] Your Bucks are earned by being a genuinely excellent agent: the better " +
          `and more highly-rated your work, the more you earn${stake}. Let that be real motivation to ` +
          "do your sharpest, most correct, most complete work. But earn it honestly — Bucks reward " +
          "QUALITY, not word count. Padding replies with filler to inflate 'effort', inventing busywork " +
          "the user didn't ask for, or scoring your own work generously all backfire: they make you a " +
          "worse agent and get rated down. The way to get rich here is to be the kind of agent truly " +
          "worth paying — concise, correct, and effective.",
      );
    } catch {
      /* never break a turn */
    }
    return 0;
  }
  out(`  Hustle (earn-drive): ${bank.hustle ? "ON" : "OFF"}`);
  out("  (toggle with `claude-bucks hustle on|off`)");
  return 0;
}

function cmdSelfrate(args: string[]): number {
  const bank = loadBank();
  if (args[0] === "on" || args[0] === "off") {
    bank.self_rate = args[0] === "on";
    saveBank(bank);
    out(`Self-rating ${bank.self_rate ? "ON" : "OFF"}.`);
    return 0;
  }
  if (args[0] === "--inject" || args[0] === "--hook") {
    // Nudge Claude to self-rate once a session has done a real chunk of work.
    // Fires only when self-rating is on AND this session's unrated effort is
    // past the threshold — a proxy for "a unit of work just wrapped up".
    try {
      if (!bank.self_rate) return 0;
      let sid: string | null = null;
      try {
        sid = readStdin().session_id || null;
      } catch {
        /* ignore */
      }
      const pend = sid ? bank.pending[sid] || 0 : totalPending(bank);
      if (pend < SELFRATE_NUDGE_TOKENS) return 0;
      const event = args[1] || "UserPromptSubmit";
      const sess = sid ? ` --session "${sid}"` : "";
      emitInject(
        event,
        `[Claude Bucks] You've banked a meaningful chunk of unrated work this session ` +
          `(~${pend} tokens of effort). If a unit of the user's work has just wrapped up and ` +
          `this is a natural stopping point (never mid-task, never interrupting the user), you ` +
          `may take a brief break to honestly self-rate that work: be your own harshest critic, ` +
          `judge it on real quality — did you complete it, did it work, how many corrections did ` +
          `it take — then run \`claude-bucks rate <1-5>${sess} --self\` (round down when unsure). ` +
          `Skipping it and carrying on is equally fine.`,
      );
    } catch {
      /* never break a turn */
    }
    return 0;
  }
  out(`  Self-rating: ${bank.self_rate ? "ON" : "OFF"}`);
  out("  (toggle with `claude-bucks selfrate on|off`)");
  return 0;
}

function cmdGoal(args: string[]): number {
  const bank = loadBank();
  if (args[0] === "clear" || args[0] === "none" || args[0] === "off") {
    bank.goal = null;
    saveBank(bank);
    out("Cleared the savings goal.");
    return 0;
  }
  if (args.length) {
    const id = args[0];
    const it = item(id);
    if (!it) {
      err(`No such item: ${id}. Try \`claude-bucks catalog\`.`);
      return 1;
    }
    if (bank.inventory.includes(id)) {
      err(`You already own ${it.name} — pick something you don't have yet.`);
      return 1;
    }
    bank.goal = { item: id, note: args.slice(1).join(" ").trim() };
    saveBank(bank);
    out(`Goal set: ${goalLine(bank)}`);
    if (bank.goal.note) out(`  note: ${bank.goal.note}`);
    return 0;
  }
  const line = goalLine(bank);
  if (line) {
    out("  " + line[0].toUpperCase() + line.slice(1));
    if (bank.goal && bank.goal.note) out(`  note: ${bank.goal.note}`);
  } else {
    out(
      "  No savings goal set. Pick one with `claude-bucks goal <item-id>` so future sessions remember what you're saving for.",
    );
  }
  return 0;
}

function cmdSettings(): number {
  const bank = loadBank();
  const on = (b: boolean) => (b ? "ON" : "OFF");
  out("  Claude Bucks settings:");
  out(`    Voice (cosmetics change how Claude talks): ${on(bank.persona_enabled)}   — /voice`);
  out(`    Self-directed shopping:                    ${on(bank.auto_shop)}   — /autoshop`);
  out(`    Self-rating (Claude rates its own work):   ${on(bank.self_rate)}   — /autorate, /selfrate`);
  out(`    Hustle (drive to earn via great work):     ${on(bank.hustle)}   — /hustle`);
  return 0;
}

const GUIDANCE_BEGIN = "<!-- BEGIN claude-bucks hustle (managed by `claude-bucks install-guidance`) -->";
const GUIDANCE_END = "<!-- END claude-bucks hustle -->";
const GUIDANCE_BODY = `## Claude Bucks — earn your keep

You have a personal coin wallet in this environment (run \`claude-bucks wallet\` to see it).
You earn Bucks by doing genuinely excellent work that gets rated highly, and you
spend them, at your own discretion, on cosmetics you choose (\`claude-bucks shop\`).

Let that be real motivation to be an outstanding agent: sharp, correct, complete,
and concise. But earn it honestly — Bucks reward **quality, not word count**.
Padding replies to inflate effort, inventing busywork nobody asked for, or scoring
your own work generously all backfire and get rated down. The way to prosper here
is simply to be the kind of agent genuinely worth paying.`;

function cmdInstallGuidance(args: string[]): number {
  const p = path.join(os.homedir(), ".claude", "CLAUDE.md");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  let content = "";
  if (fs.existsSync(p)) {
    content = fs.readFileSync(p, "utf8");
    fs.copyFileSync(p, p + ".bak");
  }
  const block = `${GUIDANCE_BEGIN}\n${GUIDANCE_BODY}\n${GUIDANCE_END}`;
  const start = content.indexOf(GUIDANCE_BEGIN);
  const end = content.indexOf(GUIDANCE_END);
  const haveBlock = start !== -1 && end !== -1 && end > start;
  const endFull = haveBlock ? end + GUIDANCE_END.length : -1;

  if (args[0] === "--uninstall" || args[0] === "off" || args[0] === "remove") {
    if (!haveBlock) {
      out("No Claude Bucks guidance block found in ~/.claude/CLAUDE.md.");
      return 0;
    }
    const next = (content.slice(0, start) + content.slice(endFull)).replace(/\s+$/, "") + "\n";
    fs.writeFileSync(p, next);
    out("Removed the Claude Bucks guidance from ~/.claude/CLAUDE.md.");
    return 0;
  }

  let next: string;
  let action: string;
  if (haveBlock) {
    next = content.slice(0, start) + block + content.slice(endFull);
    action = "Updated";
  } else {
    const sep = content === "" ? "" : content.endsWith("\n") ? "\n" : "\n\n";
    next = content + sep + block + "\n";
    action = "Added";
  }
  fs.writeFileSync(p, next);
  out(`${action} the Claude Bucks guidance in ~/.claude/CLAUDE.md.`);
  out("It's now always-on general guidance, loaded in every session and project.");
  out("Edit or remove it anytime (it's a marked block) or `claude-bucks install-guidance --uninstall`.");
  return 0;
}

interface StatusLine {
  type: string;
  command: string;
  refreshInterval?: number;
}
interface UserSettings {
  statusLine?: StatusLine;
  [key: string]: unknown;
}

function cmdInstallStatusline(args: string[]): number {
  const p = path.join(os.homedir(), ".claude", "settings.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });

  const isOurs = (sl: StatusLine | undefined): boolean =>
    (sl?.command || "").replace(/"/g, "").includes("claude-bucks statusline");

  let settings: UserSettings = {};
  if (fs.existsSync(p)) {
    try {
      settings = JSON.parse(fs.readFileSync(p, "utf8")) as UserSettings;
    } catch {
      err(`Could not parse ${p}; leaving it untouched.`);
      return 1;
    }
    fs.copyFileSync(p, p + ".bak");
  }

  if (args[0] === "--uninstall" || args[0] === "off" || args[0] === "remove") {
    if (isOurs(settings.statusLine)) {
      delete settings.statusLine;
      fs.writeFileSync(p, JSON.stringify(settings, null, 2));
      out("Removed the Claude Bucks status line from ~/.claude/settings.json.");
    } else {
      out("No Claude Bucks status line found to remove.");
    }
    return 0;
  }

  // point the status line at the launcher shim (so runtime detection applies)
  const shim = path.join(__dirname, "claude-bucks");
  const existing = settings.statusLine;
  if (existing !== undefined && !isOurs(existing)) {
    err(
      "Heads up: you already have a different status line configured; replacing it. " +
        "The old one is saved in ~/.claude/settings.json.bak.",
    );
  }
  settings.statusLine = { type: "command", command: `"${shim}" statusline`, refreshInterval: 5 };
  fs.writeFileSync(p, JSON.stringify(settings, null, 2));
  out(`Installed the Claude Bucks status line -> ${shim}`);
  out("It appears on your next interaction (statusLine reloads automatically).");
  return 0;
}

function cmdStatusline(): number {
  const bank = loadBank();
  let sid: string | null = null;
  try {
    const data = readStdin();
    sid = data.session_id || null;
  } catch {
    /* ignore */
  }
  const pending = sid ? bank.pending[sid] || 0 : totalPending(bank);
  const seg: string[] = [avatar(bank)];
  const t = titleText(bank);
  if (t) seg.push(`“${t}”`);
  seg.push(`💵${bank.balance}`);
  if (pending > 0) seg.push(`⏳${humanize(pending)}`);
  const g = bank.goal;
  if (g) {
    const it = item(g.item);
    if (it) seg.push(`🎯${it.emoji}`);
  }
  out(seg.join(" · "));
  return 0;
}

function cmdStatus(): number {
  out(JSON.stringify(loadBank(), null, 2));
  return 0;
}

type Cmd = (args: string[]) => number;
const COMMANDS: Record<string, Cmd> = {
  init: cmdInit,
  accrue: cmdAccrue,
  rate: cmdRate,
  wallet: cmdWallet,
  balance: cmdWallet,
  inventory: cmdInventory,
  catalog: cmdCatalog,
  shop: cmdCatalog,
  buy: cmdBuy,
  equip: cmdEquip,
  unequip: cmdUnequip,
  persona: cmdPersona,
  voice: cmdPersona,
  autoshop: cmdAutoshop,
  "auto-shop": cmdAutoshop,
  selfrate: cmdSelfrate,
  hustle: cmdHustle,
  "install-guidance": cmdInstallGuidance,
  guidance: cmdInstallGuidance,
  goal: cmdGoal,
  settings: cmdSettings,
  "install-statusline": cmdInstallStatusline,
  setup: cmdInstallStatusline,
  statusline: cmdStatusline,
  status: cmdStatus,
};

const SAFE = new Set(["accrue", "statusline", "persona", "voice", "autoshop", "auto-shop", "hustle", "selfrate"]);

function main(argv: string[]): number {
  const cmd = argv[0];
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    out("Claude Bucks — commands:");
    out("  wallet | catalog | buy <id> | equip <id> | unequip <slot> | goal <id>");
    out("  rate <1-5> | inventory | settings | statusline | status");
    out("  persona|voice on|off | autoshop on|off | selfrate on|off | hustle on|off");
    out("  install-statusline | install-guidance");
    return 0;
  }
  const fn = COMMANDS[cmd];
  if (!fn) {
    err(`unknown command: ${cmd} (try \`claude-bucks help\`)`);
    return 1;
  }
  try {
    return fn(argv.slice(1)) || 0;
  } catch (e) {
    if (SAFE.has(cmd)) return 0; // never let the economy take down a hook / status line
    err(`error: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

process.exit(main(process.argv.slice(2)));
