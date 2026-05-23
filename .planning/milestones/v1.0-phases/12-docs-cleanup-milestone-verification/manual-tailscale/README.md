# Manual Tailscale + Cursor + Phone Scenario — Evidence Directory

This directory holds screenshot evidence for the Phase 12 SC#5 manual end-to-end scenario (D-05 / D-06).
**Naming convention:** `step-NN-slug.png` (or `.txt` for terminal captures, e.g. `step-06-hub-killed.txt`).
**Size cap:** ≤ 1 MB per file. Compress oversized PNGs with `oxipng` or `pngquant` before committing.

## What the operator must do

On the dev machine (with Tailscale running) and a phone (or tablet) on the same Tailnet, execute the 9-step scenario below in order. After each step, capture the required screenshot, record ✅/❌, and note the timestamp. The step-6 kill mechanism (`SIGINT` / `SIGTERM` / `pkill -9` / Ctrl-C) **must** be written in the Notes column.

| # | Step                                                                                                  | Screenshot                       |
| - | ----------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1 | On dev machine: `hapi runner` is running (per `cli/README.md`)                                        | `step-01-runner-up.png`          |
| 2 | On dev machine: `hapi hub` is running and reachable on the Tailnet                                    | `step-02-hub-up.png`             |
| 3 | On phone (same Tailnet): open the Web PWA at the Tailscale hostname URL                               | `step-03-pwa-loaded.png`         |
| 4 | In the PWA: create a new Cursor session                                                               | `step-04-session-created.png`    |
| 5 | Complete one round of interaction (send a user message; observe a Cursor agent response)              | `step-05-first-round.png`        |
| 6 | On dev machine: kill the `hapi hub` process. **Note the exact kill mechanism in the table.**          | `step-06-hub-killed.txt` (or `.png`) |
| 7 | On dev machine: restart `hapi hub`                                                                    | `step-07-hub-restarted.png`      |
| 8 | On phone: confirm session state recovered (message history visible + machine list intact)             | `step-08-state-recovered.png`    |
| 9 | Complete a second round of interaction (send another user message; observe a response)                | `step-09-second-round.png`       |

## How to record the result

Once all 9 screenshots are in this directory, fill the `## Manual Tailscale scenario` section of [`../12-VERIFICATION.md`](../12-VERIFICATION.md) with this exact table format:

```markdown
### Manual Tailscale + Cursor + Phone scenario

Executed by: <operator name>
Date / time: <ISO timestamp at start>
Dev machine: <hostname / OS>
Phone: <device / OS / Tailscale client version>

| # | Step                                          | Result | Timestamp | Notes / Screenshot                                  |
|---|-----------------------------------------------|--------|-----------|------------------------------------------------------|
| 1 | hapi runner up                                | ✅/❌  | hh:mm:ss  | manual-tailscale/step-01-runner-up.png               |
| 2 | hapi hub up (reachable on Tailnet)            | ✅/❌  | hh:mm:ss  | manual-tailscale/step-02-hub-up.png                  |
| 3 | Phone opens PWA at Tailscale URL              | ✅/❌  | hh:mm:ss  | manual-tailscale/step-03-pwa-loaded.png              |
| 4 | New Cursor session created                    | ✅/❌  | hh:mm:ss  | manual-tailscale/step-04-session-created.png         |
| 5 | First round of interaction                    | ✅/❌  | hh:mm:ss  | manual-tailscale/step-05-first-round.png             |
| 6 | hub killed (mechanism: ___________)           | ✅/❌  | hh:mm:ss  | manual-tailscale/step-06-hub-killed.txt              |
| 7 | hub restarted                                 | ✅/❌  | hh:mm:ss  | manual-tailscale/step-07-hub-restarted.png           |
| 8 | Session state recovered                       | ✅/❌  | hh:mm:ss  | manual-tailscale/step-08-state-recovered.png         |
| 9 | Second round of interaction                   | ✅/❌  | hh:mm:ss  | manual-tailscale/step-09-second-round.png            |

Overall: PASS / FAIL
Rationale: <one-line summary referencing observed behavior>
```

Then `git add manual-tailscale/ ../12-VERIFICATION.md && git commit -m "docs(12-04): record manual Tailscale scenario result"`.

After the commit, the 12-04 executor resumes and writes the Milestone 1 Sign-off (Task 5) + flips milestone state (Task 6).
