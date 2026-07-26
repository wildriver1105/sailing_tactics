# Project API

## Contents

1. Connection surface
2. Scenario schema
3. Rendering semantics
4. Entity conventions
5. Validation and installation

## Connection surface

The editor has no HTTP API. Its project API is the TypeScript model in
`lib/types.ts`, the collection exported by `lib/scenarios.ts`, and the storage
functions in `lib/storage.ts`.

AI-authored lessons connect through `content/scenarios/ai-lessons.json`.
`lib/scenarios.ts` appends that array to the built-in scenarios, so installed
lessons appear in the sidebar after a development reload or build.

```bash
npm run lesson:validate -- /absolute/path/to/lesson.json
npm run lesson:add -- /absolute/path/to/lesson.json
```

`lesson:add` validates and upserts by scenario id. The validator accepts one
`Scenario` object or an array; `lesson:add` accepts exactly one object.

## Scenario schema

```ts
type EntityType =
  | "boat" | "mark" | "committee" | "pin"
  | "wind" | "note" | "line";
type LineStyle = "solid" | "divider" | "arrow" | "darrow";

interface Entity {
  id: string;
  type: EntityType;
  label?: string;
  color?: string;
  hero?: boolean;
  lineStyle?: LineStyle;
}

interface EntityState {
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  rotation?: number;
  visible?: boolean;
  scale?: number;
}

interface Frame {
  id: string;
  title: string;
  description: string;
  states: Record<string, EntityState>;
}

interface Scenario {
  id: string;
  name: string;
  blurb: string;
  group?: string;
  entities: Entity[];
  frames: Frame[];
}
```

## Rendering semantics

- Coordinates use `x=0` at left, `x=100` at right, `y=0` at top/upwind, and
  `y=100` at bottom/downwind.
- Rotation uses degrees: `0` points up and positive values rotate clockwise.
  Typical close-hauled headings are `45` on starboard tack and `-45` on port.
- Frame state is cumulative. An omitted entity inherits its last state.
- An entity is hidden until a frame first supplies its state. Use
  `visible: false` to hide it again.
- A line uses `(x,y)` as endpoint A and `(x2,y2)` as endpoint B.
- Stable entity ids produce animated transitions. Never replace an id merely
  because the entity moved or turned.

## Entity conventions

Suggested chalk colors:

- learner/hero: `#ffd54a`
- primary rival: `#7fd1ff`
- second rival/danger: `#ff9a8b`
- annotation line: `#eaf3ec`
- guidance/safe line: `#9be7b0`

Use `committee` and `pin` for start-line endpoints, `mark` for course marks,
and `note` for short board callouts. Put full instruction in frame descriptions.

Line styles:

- `solid`: neutral course or boundary
- `divider`: dotted layline or reference
- `arrow`: one-way direction
- `darrow`: two-way distance or relationship

## Validation and installation

The command rejects malformed data, duplicate ids, unsupported types, unknown
state ids, invalid coordinates, missing line endpoints, and incomplete first
frames. It warns about weak descriptions, excessive frames, hero selection, and
abrupt boat movement. Warnings do not cause a nonzero exit status.

Installation upserts by `Scenario.id` into
`content/scenarios/ai-lessons.json`. Validate the aggregate after manual edits
and run `npm run build` before handing off.
