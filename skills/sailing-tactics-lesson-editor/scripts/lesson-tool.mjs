#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ENTITY_TYPES = new Set(["boat", "mark", "committee", "pin", "wind", "note", "line"]);
const LINE_STYLES = new Set(["solid", "divider", "arrow", "darrow"]);
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../../..");
const lessonStore = path.join(projectRoot, "content", "scenarios", "ai-lessons.json");

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireText(object, key, at, errors) {
  if (typeof object[key] !== "string" || object[key].trim() === "") {
    errors.push(`${at}.${key} must be a non-empty string.`);
  }
}

function checkCoordinate(value, at, errors) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    errors.push(`${at} must be a finite number from 0 to 100.`);
  }
}

function rejectForbiddenKeys(object, at, errors) {
  for (const key of Object.keys(object)) {
    if (FORBIDDEN_KEYS.has(key)) errors.push(`${at} contains forbidden key "${key}".`);
  }
}

function validate(input) {
  const errors = [];
  const warnings = [];
  const scenarios = Array.isArray(input) ? input : [input];
  if (!input || typeof input !== "object") {
    return { errors: ["Top level must be a Scenario object or array."], warnings };
  }
  if (scenarios.length === 0) errors.push("Scenario array must not be empty.");
  const scenarioIds = new Set();

  scenarios.forEach((scenario, si) => {
    const root = Array.isArray(input) ? `[${si}]` : "scenario";
    if (!isRecord(scenario)) {
      errors.push(`${root} must be an object.`);
      return;
    }
    rejectForbiddenKeys(scenario, root, errors);
    requireText(scenario, "id", root, errors);
    requireText(scenario, "name", root, errors);
    requireText(scenario, "blurb", root, errors);
    if (scenario.id && !SAFE_ID.test(scenario.id)) errors.push(`${root}.id must use lowercase kebab-case.`);
    if (scenarioIds.has(scenario.id)) errors.push(`${root}.id is duplicated.`);
    scenarioIds.add(scenario.id);

    if (!Array.isArray(scenario.entities) || scenario.entities.length === 0) {
      errors.push(`${root}.entities must be a non-empty array.`);
      return;
    }
    if (!Array.isArray(scenario.frames) || scenario.frames.length === 0) {
      errors.push(`${root}.frames must be a non-empty array.`);
      return;
    }
    if (scenario.frames.length > 10) warnings.push(`${root} has ${scenario.frames.length} frames; prefer 3–7.`);

    const entityIds = new Set();
    const lineIds = new Set();
    let heroCount = 0;
    scenario.entities.forEach((entity, ei) => {
      const at = `${root}.entities[${ei}]`;
      if (!isRecord(entity)) {
        errors.push(`${at} must be an object.`);
        return;
      }
      requireText(entity, "id", at, errors);
      if (entity.id && !SAFE_ID.test(entity.id)) errors.push(`${at}.id must use lowercase kebab-case.`);
      if (entityIds.has(entity.id)) errors.push(`${at}.id is duplicated.`);
      entityIds.add(entity.id);
      if (!ENTITY_TYPES.has(entity.type)) errors.push(`${at}.type is unsupported.`);
      if (entity.type === "line") {
        lineIds.add(entity.id);
        if (entity.lineStyle && !LINE_STYLES.has(entity.lineStyle)) errors.push(`${at}.lineStyle is unsupported.`);
      } else if (entity.lineStyle !== undefined) {
        errors.push(`${at}.lineStyle is only valid for line entities.`);
      }
      if (entity.hero === true) heroCount += 1;
    });
    if (heroCount === 0) warnings.push(`${root} has no hero entity.`);
    if (heroCount > 1) warnings.push(`${root} has ${heroCount} hero entities.`);

    const frameIds = new Set();
    const lastBoatPosition = new Map();
    scenario.frames.forEach((frame, fi) => {
      const at = `${root}.frames[${fi}]`;
      if (!isRecord(frame)) {
        errors.push(`${at} must be an object.`);
        return;
      }
      requireText(frame, "id", at, errors);
      requireText(frame, "title", at, errors);
      requireText(frame, "description", at, errors);
      if (frame.id && !SAFE_ID.test(frame.id)) errors.push(`${at}.id must use lowercase kebab-case.`);
      if (frameIds.has(frame.id)) errors.push(`${at}.id is duplicated.`);
      frameIds.add(frame.id);
      if (typeof frame.description === "string" && frame.description.length < 35) {
        warnings.push(`${at}.description is short; explain cue, reason, and action.`);
      }
      if (!isRecord(frame.states)) {
        errors.push(`${at}.states must be an object.`);
        return;
      }
      rejectForbiddenKeys(frame.states, `${at}.states`, errors);

      for (const [id, state] of Object.entries(frame.states)) {
        const stateAt = `${at}.states.${id}`;
        if (!entityIds.has(id)) {
          errors.push(`${stateAt} references an undeclared entity.`);
          continue;
        }
        if (!isRecord(state)) {
          errors.push(`${stateAt} must be an object.`);
          continue;
        }
        checkCoordinate(state.x, `${stateAt}.x`, errors);
        checkCoordinate(state.y, `${stateAt}.y`, errors);
        if (lineIds.has(id)) {
          checkCoordinate(state.x2, `${stateAt}.x2`, errors);
          checkCoordinate(state.y2, `${stateAt}.y2`, errors);
        } else if (state.x2 !== undefined || state.y2 !== undefined) {
          errors.push(`${stateAt} uses line endpoints for a non-line entity.`);
        }
        if (state.rotation !== undefined && !Number.isFinite(state.rotation)) errors.push(`${stateAt}.rotation must be finite.`);
        if (state.visible !== undefined && typeof state.visible !== "boolean") errors.push(`${stateAt}.visible must be boolean.`);
        if (state.scale !== undefined && (!Number.isFinite(state.scale) || state.scale <= 0)) errors.push(`${stateAt}.scale must be a positive number.`);

        const entity = scenario.entities.find((item) => item.id === id);
        if (entity?.type === "boat" && Number.isFinite(state.x) && Number.isFinite(state.y)) {
          const previous = lastBoatPosition.get(id);
          if (previous) {
            const distance = Math.hypot(state.x - previous.x, state.y - previous.y);
            if (distance > 45) warnings.push(`${stateAt} moves ${distance.toFixed(1)} board units from its prior explicit state.`);
          }
          lastBoatPosition.set(id, { x: state.x, y: state.y });
        }
      }
      if (fi === 0) {
        for (const id of entityIds) {
          if (!Object.hasOwn(frame.states, id)) errors.push(`${at}.states must initialize entity "${id}".`);
        }
      }
    });
  });
  return { errors, warnings };
}

function printResult(result, jsonOutput) {
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
  if (result.errors.length === 0) console.log(`Valid (${result.warnings.length} warning(s)).`);
}

const [, , command, file, ...flags] = process.argv;
if (!["validate", "add"].includes(command) || !file) {
  console.error("Usage: lesson-tool.mjs <validate|add> <scenario.json> [--json]");
  process.exit(2);
}

try {
  const absolute = path.resolve(process.cwd(), file);
  const value = JSON.parse(fs.readFileSync(absolute, "utf8"));
  const result = validate(value);
  printResult(result, flags.includes("--json"));
  if (result.errors.length > 0) process.exit(1);

  if (command === "add") {
    if (Array.isArray(value)) throw new Error("The add command accepts exactly one Scenario object.");
    const installed = JSON.parse(fs.readFileSync(lessonStore, "utf8"));
    if (!Array.isArray(installed)) throw new Error(`${lessonStore} must contain an array.`);
    const next = installed.some((item) => item.id === value.id)
      ? installed.map((item) => (item.id === value.id ? value : item))
      : [...installed, value];
    const aggregate = validate(next);
    if (aggregate.errors.length > 0) throw new Error(`Installed lesson set is invalid:\n${aggregate.errors.join("\n")}`);
    fs.writeFileSync(lessonStore, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Installed "${value.id}" in ${lessonStore}`);
  }
} catch (error) {
  console.error(`ERROR ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
