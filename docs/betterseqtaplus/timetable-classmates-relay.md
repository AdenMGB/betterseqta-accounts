# Timetable classmates relay (implementation)

Extension spec: [BetterSEQTA-Plus `TIMETABLE_CLASSMATES_RELAY_API.md`](https://github.com/AdenMGB/BetterSEQTA-Plus/blob/main/docs/TIMETABLE_CLASSMATES_RELAY_API.md) (mirror in this repo’s sibling checkout).

## Code map

| Piece | Path |
|-------|------|
| REST phonebook | `worker/src/routes/timetable-classmates-bsplus.ts` |
| Relay session + WS upgrade | same file (`handleTimetableClassmatesRelaySession`, `handleTimetableClassmatesRelayWs`) |
| Durable Object | `worker/src/durable-objects/timetable-classmates-relay.ts` |
| Relay JWT | `worker/src/lib/timetable-classmates-relay-token.ts` |

## Local dev

1. `pnpm cf:dev` with D1 + DO bindings.
2. Opt in via `PUT .../opt-in`.
3. `GET .../relay-session?instance_host=...` then connect WebSocket from extension or `wscat`.

`sync-hint` remains in the worker for backwards compatibility but is unused by current BetterSEQTA+.
