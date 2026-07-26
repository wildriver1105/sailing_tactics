---
name: sailing-tactics-lesson-editor
description: Create, revise, and install AI-authored sailing tactics lessons for the Sailing Tactics editor. Use when asked to make a tactics lecture, lesson, drill, race-rule scenario, animated frame sequence, or importable Scenario JSON for this project, or when editing entities, frames, coordinates, narration, and transitions in an existing lesson.
---

# Sailing Tactics Lesson Editor

Create a valid `Scenario` lesson, validate it, and install it into the app.

## Workflow

1. Read [references/project-api.md](references/project-api.md) before authoring or changing a lesson.
2. Inspect `lib/scenarios.ts` for nearby teaching style and terminology. Reuse facts only when they fit the requested topic.
3. Plan a single learning objective and a 3–7 frame visual story: setup, decision, action, consequence, takeaway.
4. Create one JSON object matching `Scenario`. Write it to a temporary or user-requested `.json` file.
5. Validate before installation:

   ```bash
   npm run lesson:validate -- /absolute/path/to/lesson.json
   ```

6. Fix every reported error. Treat warnings about abrupt motion, excessive frames, or weak teaching text as quality issues unless the user explicitly wants that result.
7. Install the lesson:

   ```bash
   npm run lesson:add -- /absolute/path/to/lesson.json
   ```

8. Run `npm run build`. Report the lesson id, frame count, learning objective, and installed file.

## Authoring rules

- Use lowercase ASCII kebab-case ids. Keep entity ids stable across frames.
- Put complete states for every entity in frame 1. In later frames, include only changed entities.
- Keep coordinates in `0..100`. Keep important objects inside `5..95`.
- Use `rotation: 0` for north/up and positive degrees clockwise.
- Keep wind visually consistent unless the lesson explicitly teaches a wind shift.
- Mark exactly one learner boat with `hero: true` for decision-focused lessons.
- Make each frame title state the phase and decision. Make each description explain what to notice, why it matters, and what action to take.
- Show cause and effect through movement. Avoid moving boats more than 45 board units between adjacent frames unless the frame describes a time jump.
- Use lines sparingly for laylines, start lines, zones, bearings, and movement cues.
- Do not invent rule numbers or safety claims. If the requested lesson depends on current Racing Rules of Sailing, verify the applicable rule source before asserting it.

## Revising an installed lesson

Edit the matching object in `content/scenarios/ai-lessons.json`, then run:

```bash
npm run lesson:validate -- content/scenarios/ai-lessons.json
npm run build
```

Preserve ids unless the user requests a separate lesson. Never hand-edit built-in lessons when the request concerns an AI-authored lesson.

## Output contract

Return the installed lesson path and concise teaching summary. If the user asked only for draft JSON, validate it but do not install it.
