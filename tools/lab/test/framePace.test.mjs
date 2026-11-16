// The game's step a frame paced by the frames' mean (src/core/framePace.ts, #552): a 60 Hz screen whose browser times
// its frames on a 145 Hz screen's ticks steps evenly, game time keeps the browser's, a hitch and a move to another
// monitor are taken as they come, and an even clock (the lab's) is stepped by exactly its interval.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FramePace } from '../../../src/core/framePace.ts';

const SIXTY = 1 / 60;
const TICK = 1 / 145;

/** The intervals of `count` frames shown every `shownEvery` s, each timed at the next tick of `tick` s. */
function ticked(count, shownEvery, tick) {
  const intervals = [];
  let last = 0;
  for (let frame = 1; frame <= count; frame++) {
    const timed = Math.ceil((frame * shownEvery) / tick - 1e-9) * tick;
    intervals.push(timed - last);
    last = timed;
  }
  return intervals;
}

/** Each step `pace` gives the intervals. */
function stepsOf(pace, intervals) {
  return intervals.map((interval) => pace.next(interval));
}

/** The most a step strays from `mean`, as a share of it. */
function strayOf(steps, mean) {
  return Math.max(...steps.map((step) => Math.abs(step - mean) / mean));
}

const sum = (values) => values.reduce((total, value) => total + value, 0);

test('a 60 Hz screen timed on 145 Hz ticks steps evenly', () => {
  const intervals = ticked(600, SIXTY, TICK);
  // (the browser's own: a half more in one frame than the next, the judder)
  assert.ok(strayOf(intervals.slice(60), SIXTY) > 0.2);
  const steps = stepsOf(new FramePace(), intervals);
  const stray = strayOf(steps.slice(60), SIXTY);
  assert.ok(stray < 0.05, `the paced steps stray ${(stray * 100).toFixed(1)}% from a 60th`);
  // (game time keeps the browser's within a frame)
  assert.ok(Math.abs(sum(steps) - sum(intervals)) < SIXTY);
});

test('a hitch is paid at once, and the pace comes back', () => {
  const intervals = ticked(300, SIXTY, TICK);
  intervals[150] += 0.1;
  const steps = stepsOf(new FramePace(), intervals);
  assert.ok(steps[150] > 0.1, `the hitch's frame stepped ${steps[150]}`);
  assert.ok(strayOf(steps.slice(160), SIXTY) < 0.05);
  assert.ok(Math.abs(sum(steps) - sum(intervals)) < SIXTY);
});

test('a window moved from a 144 Hz screen to a 60 Hz one takes the new rate', () => {
  const fast = ticked(300, 1 / 144, 1 / 144);
  const slow = ticked(300, SIXTY, TICK);
  const pace = new FramePace();
  stepsOf(pace, fast);
  const steps = stepsOf(pace, slow);
  assert.ok(strayOf(steps.slice(60), SIXTY) < 0.05);
  // (and back)
  const back = stepsOf(pace, ticked(300, 1 / 144, 1 / 144));
  assert.ok(strayOf(back.slice(60), 1 / 144) < 0.05);
});

test('an even clock is stepped by exactly its interval', () => {
  const frame = 17 / 1024;
  const pace = new FramePace();
  stepsOf(pace, [0.021, 0.013, 0.019]);
  const steps = stepsOf(pace, new Array(100).fill(frame));
  // (its fourth frame pays what was owed before it, every frame after steps exactly)
  assert.ok(steps.slice(4).every((step) => step === frame));
});
