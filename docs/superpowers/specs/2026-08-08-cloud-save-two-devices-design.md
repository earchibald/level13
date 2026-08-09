# Two devices without stomping

Cloud saves work, but nothing stops a device that is behind from overwriting a newer cloud
save. This closes that, and makes moving between two devices a deliberate, visible act.

## Summary

| Item | Decision |
|---|---|
| Push guard | remember the gist's `updated_at`; refuse to push if it has changed |
| Arrival | on game start, if the cloud moved, prompt with both timestamps |
| Resolution | Load the cloud save, or keep this device's and take over |
| New storage key | `github-gist-last-seen` |
| Cost | one extra GET per push — about 60 requests/hour against a 5000/hour limit |

## The failure being fixed

`mirrorSlot` checks three things — auto-mirror on, configured, mirrored slot — and then
pushes. Nothing compares local against what is already in the cloud. So:

1. Play on device A. Auto-mirror pushes A's state.
2. Open the game on device B, which has a stale local save.
3. B autosaves within two minutes, on its own, with no input from the player.
4. That autosave mirrors, and B's older state overwrites A's newer cloud save.

The player does nothing wrong and gets no warning. The manual **Load from GitHub** path
already confirms against timestamps, so pulling is guarded; pushing is not. That asymmetry
is the whole bug.

## Design

### The marker

A new `localStorage` key, `github-gist-last-seen`, holds the gist's `updated_at` as of the
last time THIS device successfully pushed or pulled. It is set:

- when `validateAndSetup` creates the gist, from the creation response
- after every successful push, from the PATCH response
- after every successful pull, from the GET response
- when the player chooses "keep this device's save" at an arrival prompt

If the gist's current `updated_at` differs from the marker, some other device has written
since this one last synced. That is the only signal needed; no clock comparison between
devices is involved, because both values come from GitHub.

### Push guard

Before any push — automatic or the manual button — GET the gist and compare `updated_at`
to the marker.

- **Match**: PATCH, then store the new `updated_at` from the PATCH response as the marker.
- **Differ**: do not push. Record an error the status line can show, and stop further
  automatic pushes until the conflict is resolved, so the game does not retry into the same
  wall every two minutes.

`saveSlot` currently discards the PATCH response body. It must read `updated_at` from it,
which also avoids a second GET after a successful write.

### Arrival check

`UIOutMetaPopupsSystem` already listens to `gameShownSignal`. On that signal, if cloud
saves are configured, GET the gist once. If `updated_at` differs from the marker, the cloud
has news.

Compare the cloud save's own `timeStamp` — every save carries one — against the local
slot's, so the prompt can say which is actually newer rather than showing two opaque
strings. Then prompt:

> A save from another device is in the cloud.
> cloud: <when> · this device: <when>
> **[Load the cloud save]** **[Keep this device's]**

- **Load** pulls it into the slot through `saveDataToSlot`, and sets the marker.
- **Keep** sets the marker to the current `updated_at` without pulling. That is the escape
  hatch: it accepts the cloud as seen, which re-enables pushing so this device takes over.

Without the second option a conflict would be unresolvable — pushing stays blocked forever
and the player has no way to say "mine is the one I want".

The check is once per game start. It never modifies anything on its own.

## Risks

- **A failed or offline arrival check must be silent** and must not block startup or
  disable mirroring. Being unable to reach GitHub is not a conflict.
- **Auto-mirror stopping after a conflict is deliberate**, but it must be visible, or the
  player will believe they are backed up when they are not. The settings status line is the
  place.
- **Two devices genuinely edited in parallel** — there is no merge, and there should not be
  one for a game save. The player picks a side. This design makes that a choice rather than
  a silent loss.
- **Clock skew is not involved** in the safety check. Only GitHub's own `updated_at` values
  are compared. Save `timeStamp` values are used for wording the prompt, not for deciding.

## Out of scope

Merging saves. Per-slot conflict tracking — the marker is per gist, and the gist is the
unit that moves. Any change to what a save contains.

## Verification

Browser-driven with a stubbed `fetch`, since two real devices cannot be driven from here.

1. Push with the marker matching: one GET then one PATCH, and the marker updates.
2. Push with the gist moved underneath: the GET happens, no PATCH follows, an error is
   recorded, and the local save is untouched.
3. After a refused push, further automatic pushes stop until resolved.
4. Arrival with the marker matching: no prompt.
5. Arrival with the gist moved: a prompt naming both times.
6. Choosing Load writes the slot and clears the block.
7. Choosing Keep clears the block without touching the slot, and the next push succeeds.
8. Arrival with the network down: no prompt, no error, mirroring unaffected.
