# KATALY REWORK V1

## Product scope

- 6-max and 9-max tournament tables.
- Regular and bounty tournament modes.
- Local Hero-versus-bots gameplay; network multiplayer remains a later integration with PokerSwipe.
- Original portraits, table art and card art are preserved unchanged.

## Stabilized in this build

- A player all-in from an ante or blind still receives two hole cards.
- Engine delays can be disabled in deterministic tests.
- Engine waits are cancellable when the table is closed.
- Contribution layers without an eligible winner are returned rather than deleting chips.
- Invalid raise sizes are rejected by the engine instead of silently changed.
- VPIP/PFR/3-bet training metrics are calculated per hand.
- Bounty tournaments track Hero knockouts and bounty rewards.
- One canonical module boot path replaces duplicated probe imports.
- Desktop layout keeps the same table hierarchy as mobile instead of stretching it edge to edge.
- Reduced-motion mode is supported.

## Run locally

Serve the directory with any static HTTP server and open `index.html`.
ES modules will not work reliably when opened directly as a `file://` URL.

## Automated check

```bash
node js/poker/tests/core-vnext.mjs
```

The test covers deck integrity, evaluator sanity, 6-max, 9-max, chip conservation,
short-stack blind all-in dealing and cancellation of a running hand.

## Next engineering blocks

1. Replace nickname identity with stable player IDs.
2. Expand the side-pot matrix and deterministic action-sequence tests.
3. Consolidate historical CSS patches into one component stylesheet.
4. Add server-authoritative rooms and reconnect for human opponents.
5. Replace heuristic Poker Brain scores with range-aware decision analysis.
