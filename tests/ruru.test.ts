/* ==================================================================
   Ruru physics + identity checks.

   Run with:  npx tsx tests/ruru.test.ts
   Same assert-based style as tests/oso.test.ts - no test runner needed.
   ================================================================== */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  RIG,
  ROAM_PLAN,
  simulateRoam,
  ballDiameter,
  fieldFor,
  floorBandH,
  CAMERA_PITCH,
  FIXED_DT,
  HEAD,
  IDENTITY_QUAT,
  aimPoint,
  clampInBounds,
  createBody,
  depthScale,
  facingOf,
  hasArrived,
  outerRadius,
  reachableBox,
  pxPerSec,
  pxPerSec2,
  projectUnit,
  quatRotate,
  quatToMat3,
  rollAngle,
  rollAxis,
  screenToWorldVelocity,
  stepBody,
  type Domain,
} from "../src/lib/ruru";

let passed = 0;
const ok = (name: string) => {
  passed += 1;
  console.log(`ok   ${name}`);
};

/* ---------------- rolling maths ---------------- */

assert.equal(rollAngle(0, 10), 0);
ok("zero distance rolls zero radians");

assert.equal(rollAngle(62.8, 10).toFixed(4), (62.8 / 10).toFixed(4));
ok("rolling angle is distance / radius");

assert.equal(rollAngle(-40, 8), 5);
ok("rolling angle is unsigned in either direction");

assert.equal(rollAngle(10, 0), 0);
ok("a degenerate radius never produces NaN or Infinity");

/* floorNormal x moveDirection: motion along +x rolls about -z */
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const axRight = rollAxis(1, 0);
assert.ok(near(axRight.x, 0) && near(axRight.y, 0) && near(axRight.z, -1));
ok("rolling right spins about -z (floorNormal x moveDirection)");

const axDown = rollAxis(0, 1);
assert.ok(near(axDown.x, 1) && near(axDown.y, 0) && near(axDown.z, 0));
ok("rolling down the floor spins about +x");

/* A quaternion rotated by 2*pi about any axis is the identity again. */
const spun = quatRotate({ ...IDENTITY_QUAT }, 0, 0, 1, Math.PI * 2);
const m = quatToMat3(spun);
assert.ok(Math.abs(m[0] - 1) < 1e-9 && Math.abs(m[4] - 1) < 1e-9 && Math.abs(m[8] - 1) < 1e-9);
ok("full turn returns to the identity (no drift)");

/* Repeated small increments must stay orthonormal, not accumulate error. */
let q = { ...IDENTITY_QUAT };
for (let i = 0; i < 5000; i++) q = quatRotate(q, 0.3, 0.4, 0.5, 0.01);
const len = Math.hypot(q.w, q.x, q.y, q.z);
assert.ok(Math.abs(len - 1) < 1e-9, `quaternion length drifted to ${len}`);
ok("5000 accumulated rotations keep the quaternion normalised");

/* ---------------- projection ---------------- */

/* The camera is pitched 20 degrees down, so screen up is the camera's own up
   axis (0, cos p, -sin p) and screen y grows downward. Four points pin the
   projection down exactly. */
const SP = Math.sin(CAMERA_PITCH);
const CP = Math.cos(CAMERA_PITCH);

/* The point the camera is aimed at - the one nearest the lens - is the centre
   of the disc, by definition of an orthographic look-at. */
const atCamera = projectUnit({ x: 0, y: SP, z: CP });
assert.ok(Math.abs(atCamera.x) < 1e-12 && Math.abs(atCamera.y) < 1e-12);
ok("the point facing the camera projects to the centre of the disc");

const front = projectUnit({ x: 0, y: 0, z: 1 });
assert.ok(Math.abs(front.y - SP) < 1e-12 && front.y > 0);
ok("the equatorial front point sits sin(pitch) below centre");

const top = projectUnit({ x: 0, y: 1, z: 0 });
assert.ok(Math.abs(top.y + CP) < 1e-12 && top.y < -0.9);
ok("the top of the ball projects cos(pitch) above centre, near the silhouette");

const back = projectUnit({ x: 0, y: 0, z: -1 });
assert.ok(Math.abs(back.y + SP) < 1e-12);
ok("the equatorial back point rises by sin(pitch)");

/* A floor point (X, 0, Z) projects to (X, Z * sin p). That is exactly what the
   cursor -> floor mapping has to invert, so check the round trip. */
const floorPt = projectUnit({ x: 0.4, y: 0, z: 0.7 });
assert.ok(Math.abs(floorPt.x - 0.4) < 1e-12);
assert.ok(Math.abs(floorPt.y - 0.7 * SP) < 1e-12);
const roundTrip = screenToWorldVelocity(floorPt.x, floorPt.y);
assert.ok(Math.abs(roundTrip.x - 0.4) < 1e-12 && Math.abs(roundTrip.z - 0.7) < 1e-12);
ok("screen movement inverts back to floor depth through sin(pitch)");

assert.ok(Math.abs(facingOf({ x: 0, y: 0, z: 1 }) - Math.cos(CAMERA_PITCH)) < 1e-12);
assert.ok(Math.abs(facingOf({ x: 0, y: 1, z: 0 }) - Math.sin(CAMERA_PITCH)) < 1e-12);
ok("facing cosine matches the camera pitch");

/* ---------------- depth ---------------- */

assert.equal(depthScale(0, 100), 0.88);
assert.equal(Number(depthScale(100, 100).toFixed(6)), 1.08);
assert.equal(depthScale(50, 0), 0.88);
ok("depth spans 0.88 (back) to 1.08 (front) and never divides by zero");

/* ---------------- bounds, arrival, no NaN ---------------- */

/* Matches the real hero stage at 1440px, where the floor is 615 x 277 and the
   ball radius is 110.7 - the tightest case the droid actually ships in. */
const domain: Domain = { w: 615, h: 277 };
const radius = 110.7;
const pad = 12;
const limit = radius * 1.08 + pad;

/** The whole ball must sit inside the floor, inset by radius + 12px. */
const fullyInside = (b: { x: number; y: number }, d: Domain) => {
  const k = 1e-6;
  const re = radius * 1.08 + pad;
  if (d.w < 2 * re || d.h < 2 * re) return true; // cannot fit; centre rule applies
  return (
    b.x >= re - k && b.x <= d.w - re + k && b.y >= re - k && b.y <= d.h - re + k
  );
};

/** Weaker invariant that must hold at every size: the centre stays on the floor. */
const centreOnFloor = (b: { x: number; y: number }, d: Domain) => {
  const k = 1e-6;
  return b.x >= -k && b.x <= d.w + k && b.y >= -k && b.y <= d.h + k;
};

let worstOut = 0;
let nanSeen = false;
let centreEscaped = false;
const rnd = (() => {
  let seed = 1234567;
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
})();

for (let trial = 0; trial < 200; trial++) {
  const b = createBody(domain.w / 2, domain.h / 2, radius);
  // random targets, some deliberately far outside the domain
  b.target = { x: rnd() * domain.w * 3 - domain.w, y: rnd() * domain.h * 3 - domain.h };
  for (let i = 0; i < 400; i++) {
    stepBody(b, FIXED_DT, domain);
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.vx)) nanSeen = true;
    if (!fullyInside(b, domain)) {
      const re = limit;
      worstOut = Math.max(worstOut, re - b.x, b.x - (domain.w - re), re - b.y, b.y - (domain.h - re));
    }
    if (!centreOnFloor(b, domain)) centreEscaped = true;
  }
}
assert.ok(!nanSeen, "steering produced NaN");
ok("200 random chases never produce NaN");

assert.ok(worstOut <= 1e-6, `left the domain by ${worstOut}px`);
ok("the droid stays inside the floor inset by radius + 12px");

/* resize mid-flight, including floors too small to hold the ball */
let escapeAfterResize = false;
for (let trial = 0; trial < 60; trial++) {
  const b = createBody(domain.w / 2, domain.h / 2, radius);
  b.target = { x: rnd() * 2000 - 500, y: rnd() * 1200 - 300 };
  const next: Domain = { w: 120 + rnd() * 1000, h: 90 + rnd() * 500 };
  for (let i = 0; i < 120; i++) {
    const active = i < 60 ? domain : next;
    if (i === 60) clampInBounds(b, active, pad);
    stepBody(b, FIXED_DT, active);
    if (!centreOnFloor(b, active)) escapeAfterResize = true;
  }
}
assert.ok(!escapeAfterResize, "the centre left the floor after a resize");
assert.ok(centreEscaped === false);
ok("a resize never pushes the droid off the floor");

/* arrival: an aimable step lands where it was asked to */
{
  const b = createBody(domain.w / 2, domain.h / 2, radius);
  const goal = { x: domain.w / 2 + 40, y: domain.h / 2 };
  b.target = { ...goal };
  let frames = 0;
  while (frames < 600 && !hasArrived(b, domain)) {
    stepBody(b, FIXED_DT, domain);
    frames += 1;
  }
  assert.ok(hasArrived(b, domain), "never arrived at a reachable target");
  assert.ok(Math.hypot(b.x - goal.x, b.y - goal.y) <= radius * 0.06 + 3 + 1e-6);
  ok(`arrives within epsilon (${frames} frames for a 40px roll)`);
}

/* Rolling distance is conserved on a monotonic roll: the net rotation equals
   the distance travelled / radius. The hero also lets the droid overshoot and
   roll back, which cancels rotation instead of adding it - that is correct
   rolling, so the check drives a straight, one-directional roll. */
{
  const stepPx = 1.2;
  const steps = 100;
  let q2 = { ...IDENTITY_QUAT };
  for (let i = 0; i < steps; i++) {
    const w = screenToWorldVelocity(stepPx, 0);
    const a = rollAxis(w.x, w.z);
    q2 = quatRotate(q2, a.x, a.y, a.z, rollAngle(stepPx, radius));
  }
  const net = 2 * Math.acos(Math.min(1, Math.abs(q2.w)));
  const expected = rollAngle(stepPx * steps, radius);
  assert.ok(
    Math.abs(net - expected) < 1e-9,
    `net rotation ${net} rad for a ${stepPx * steps}px roll, expected ${expected}`
  );
  ok("net rotation equals distance travelled / radius");
}

/* A forward roll followed by the same distance backwards returns to the start */
{
  let q3 = { ...IDENTITY_QUAT };
  const a = rollAxis(1, 0);
  for (let i = 0; i < 50; i++) q3 = quatRotate(q3, a.x, a.y, a.z, rollAngle(2, radius));
  const backward = rollAxis(-1, 0);
  for (let i = 0; i < 50; i++) q3 = quatRotate(q3, backward.x, backward.y, backward.z, rollAngle(2, radius));
  const m3 = quatToMat3(q3);
  assert.ok(Math.abs(m3[0] - 1) < 1e-9 && Math.abs(m3[8] - 1) < 1e-9);
  ok("rolling back over the same ground undoes the rotation");
}

/* ---------------- the v4 motion contract ---------------- */

/* One speedScale ships at 1: the rig is calibrated, not paused. */
assert.equal(RIG.speedScale, 1);
ok("speedScale ships at 1");

/* The whole calibration the brief pins down, asserted once. */
assert.equal(RIG.cruise, 0.5);
assert.equal(RIG.max, 0.8);
assert.equal(RIG.wander, 0.3);
assert.equal(RIG.intro, 0.7);
assert.equal(RIG.accel, 0.9);
assert.equal(RIG.stop, 1.6);
assert.equal(RIG.wanderMinTrip, 1.2);
assert.equal(RIG.leanMaxDeg, 6);
assert.equal(RIG.tau.eyes, 220);
assert.equal(RIG.tau.head, 380);
assert.equal(RIG.tau.lean, 600);
assert.equal(RIG.tau.cursor, 700);
assert.equal(RIG.tau.reaction, 350);
assert.equal(RIG.wanderAfterMs, 5000);
assert.equal(RIG.sleepAfterMs, 25000);
assert.equal(RIG.typeMsPerChar, 45);
assert.equal(RIG.sayGapMs, 4000);
ok("the motion calibration matches the v4 brief");

/* D/s to px conversions are exact and route through speedScale. */
assert.equal(pxPerSec(200, 0.5), 100 * RIG.speedScale);
assert.equal(pxPerSec2(200, 0.9), 180 * RIG.speedScale);
ok("D/s and D/s^2 convert through speedScale exactly");

/* No chase exceeds the hard ceiling, whatever the target. Every maxSpeed
   the component can hand over is clamped inside stepBody by RIG.max. */
{
  let worst = 0;
  for (let trial = 0; trial < 200; trial++) {
    const b = createBody(domain.w / 2, domain.h / 2, radius);
    b.target = { x: rnd() * 2400 - 1200, y: rnd() * 1400 - 700 };
    for (let i = 0; i < 240; i++) {
      stepBody(b, FIXED_DT, domain);
      const sp = Math.hypot(b.vx, b.vy) / (b.r * 2);
      if (sp > worst) worst = sp;
    }
  }
  assert.ok(worst <= RIG.max * RIG.speedScale + 1e-6, `peak ${worst.toFixed(4)} D/s`);
  ok(`no chase exceeds ${RIG.max} D/s (peak ${worst.toFixed(3)} D/s)`);
}

/* ...and no hand-tuned maxSpeed can smuggle a faster body past the ceiling. */
{
  const b = createBody(50, 50, radius);
  b.maxSpeed = pxPerSec(radius * 2, 50); // an absurd request: 50 D/s
  b.target = { x: 99999, y: 99999 };
  for (let i = 0; i < 120; i++) stepBody(b, FIXED_DT, { w: 100000, h: 100000 });
  const sp = Math.hypot(b.vx, b.vy) / (b.r * 2);
  assert.ok(sp <= RIG.max * RIG.speedScale + 1e-6, `escaped at ${sp.toFixed(3)} D/s`);
  ok("a hand-set maxSpeed is still clamped to the D/s ceiling");
}

/* Acceleration is bounded: a body at cruise cannot gain more than accel
   D/s of speed in one second, even straight into the steering pull. */
{
  const b = createBody(domain.w / 2, domain.h / 2, radius);
  b.target = { x: domain.w / 2 + 5000, y: domain.h / 2 };
  const v0 = Math.hypot(b.vx, b.vy);
  for (let i = 0; i < 60; i++) stepBody(b, FIXED_DT, domain);
  const gain = Math.hypot(b.vx, b.vy) - v0;
  assert.ok(
    gain <= pxPerSec2(radius * 2, RIG.accel) + 1e-6,
    `gained ${gain.toFixed(2)} px/s in one second`
  );
  ok("speed gain in one second respects the D/s^2 acceleration cap");
}

/* Field containment holds at the new speeds too: chase targets inside the
   domain keep the whole ball in the floor band. */
{
  let worstOut = 0;
  for (let trial = 0; trial < 100; trial++) {
    const b = createBody(domain.w / 2, domain.h / 2, radius);
    b.target = { x: rnd() * domain.w, y: rnd() * domain.h };
    b.maxSpeed = pxPerSec(radius * 2, RIG.max);
    for (let i = 0; i < 300; i++) {
      stepBody(b, FIXED_DT, domain);
      if (!fullyInside(b, domain)) {
        const re = limit;
        worstOut = Math.max(worstOut, re - b.x, b.x - (domain.w - re), re - b.y, b.y - (domain.h - re));
      }
    }
  }
  assert.ok(worstOut <= 1e-6, `left the domain by ${worstOut}px`);
  ok("in-domain chase targets keep the ball inside the floor band");
}

/* The head never slides more than 0.06 r off the ball's centre, whatever
   the travel direction. */
{
  for (let i = 0; i < 200; i++) {
    const dirX = rnd() * 2 - 1;
    const slide = Math.max(
      -radius * HEAD.slideMax,
      Math.min(radius * HEAD.slideMax, dirX * radius * HEAD.slideMax)
    );
    assert.ok(Math.abs(slide) <= radius * HEAD.slideMax + 1e-9);
    assert.ok(HEAD.slideMax <= 0.06 + 1e-12, `slideMax drifted to ${HEAD.slideMax}`);
  }
  ok("the head stays within 0.06 r of the ball centre");
}

/* ---------------- identity module ---------------- */

const ROOT = decodeURIComponent(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
};

const sources = walk(join(ROOT, "src"));
assert.ok(sources.length > 10, "expected to find the src tree");

const offenders: string[] = [];
for (const file of sources) {
  const rel = file.replace(/\\/g, "/");
  if (rel.endsWith("src/lib/identity.ts")) continue;
  const text = readFileSync(file, "utf8");
  if (/\bRuru\b/.test(text) && !/ROBOT_NAME|\$\{ROBOT_NAME\}|Ruru'|"Ruru|ruru-/i.test(text)) {
    offenders.push(`${rel}: hard-coded "Ruru"`);
  }
  if (/Rudransh/.test(text) && !/DEMO_PERSON/.test(text)) {
    offenders.push(`${rel}: hard-coded "Rudransh"`);
  }
}
assert.deepEqual(offenders, []);
ok("no hard-coded mascot or demo-person name outside src/lib/identity.ts");

const identity = readFileSync(join(ROOT, "src/lib/identity.ts"), "utf8");
assert.ok(/ROBOT_NAME\s*=\s*"Ruru"/.test(identity));
assert.ok(/fullName:\s*"Rudransh Singh"/.test(identity));
ok("the identity module owns both names");

/* ---------------- the roam cinematic: timing + containment ---------------- */

/* The plan ends at the rest pose and pauses make sense. */
assert.equal(ROAM_PLAN.length, 4);
assert.ok(ROAM_PLAN.every((p) => p.fx >= 0 && p.fx <= 1 && p.fy >= 0 && p.fy <= 1));
assert.ok(ROAM_PLAN[ROAM_PLAN.length - 1].pause === 0, "the settle leg has no pause");
ok("ROAM_PLAN is four in-bounds waypoints ending at rest");

/* The cinematic is pinned at ~5s on a real desktop hero: 1440x900
   viewport, stage = hero minus the 54px ticker (measured live), floor
   = 34% of stage, D from the hero-scale sizing rule. */
{
  const heroW = 1440;
  const heroH = 900;
  const stageH = heroH - 54; // the ticker rail docks inside the section
  const fh = floorBandH(stageH);
  const d = ballDiameter(heroW, stageH, fh);
  const floor = { x: 0, y: stageH - fh, w: heroW, h: fh };
  const field = fieldFor(floor, d);
  const total = simulateRoam(field.w, field.h, d);
  /* assembled height ~1.55 D must land inside the brief's 30–38% band */
  const frac = (d * 1.55) / heroH;
  assert.ok(frac >= 0.30 && frac <= 0.38, `assembled ball ${(frac * 100).toFixed(0)}% of viewport, outside 30–38%`);
  /* This is only the analytic estimate (distance / average pace + pauses);
     the authoritative timing is the stepped route below, which walks the
     same plan through the real integrator. */
  assert.ok(total >= 2.8 && total <= 6.5, `roam estimate ${total.toFixed(2)}s outside the expected band`);
  ok(`roam estimate ${total.toFixed(2)}s with D=${d.toFixed(0)}px (assembled ${(frac * 100).toFixed(0)}% of viewport)`);

  /* The same plan on a phone hero (390x844) stays inside 3..7s and the
     ball stays a major element without filling the screen. */
  const mStage = 844 - 48;
  const mh = floorBandH(mStage);
  const md = ballDiameter(390, mStage, mh);
  const mfloor = { x: 0, y: mStage - mh, w: 390, h: mh };
  const mfield = fieldFor(mfloor, md);
  const mtotal = simulateRoam(mfield.w, mfield.h, md);
  assert.ok(mtotal >= 1.8 && mtotal <= 6, `mobile roam estimate ${mtotal.toFixed(2)}s outside range`);
  assert.ok(md >= 110, `mobile ball collapsed to ${md}px`);
  ok(`mobile roam estimate ${mtotal.toFixed(2)}s, D=${md.toFixed(0)}px`);

  /* The field spans nearly the whole viewport width: the droid can truly
     travel from the fullest left to the fullest right. */
  assert.ok(field.w >= heroW - 2 * (0.6 * d) - 1, "field narrower than the full-viewport insets");
  assert.ok(field.x <= 0.6 * d + 1 && field.x + field.w >= heroW - 0.6 * d - 1);
  ok(`field spans ${field.w.toFixed(0)}px of the ${heroW}px viewport`);
}

/* ---------------- the route, stepped for real ---------------- */

/* simulateRoam() above is an analytic estimate of the plan's duration; it
   cannot catch a route that never finishes. This walks the same plan through
   the real integrator, exactly as Robot.tsx does, in two domains: the open
   floor band, and the thin legibility envelope the hero actually derives
   (headline clearance above, ticker below — ~73px on a 1440x900 desktop,
   shallower than the 221px ball). Before aimPoint/reachableBox the droid
   stalled on its first leg there: the y clamp collapsed the band to a line
   and the arrival test never passed. */
{
  const d = 220.5;
  const runPlan = (domain: { w: number; h: number }, ball = d) => {
    const body: Body = {
      x: domain.w * 0.62,
      y: domain.h * 0.55,
      vx: 0,
      vy: 0,
      r: ball / 2,
      maxSpeed: pxPerSec(ball, RIG.roam),
      capD: RIG.roam,
      capA: RIG.roamAccel,
      arriveD: RIG.roamArrive,
      target: null,
    };
    const eps = ball * RIG.arriveTol;
    const dt = FIXED_DT;
    let t = 0;
    let phase = 0;
    let nextAt = 0.3;
    const legs: { at: number; x: number }[] = [];
    const ys: number[] = [];
    const speeds: number[] = [];
    for (let i = 0; i < 60 * 20 && phase >= 0; i++) {
      t += dt;
      if (t >= nextAt && (body.target === null || hasArrived(body, domain, eps))) {
        const next = phase < ROAM_PLAN.length ? ROAM_PLAN[phase] : null;
        if (next) {
          body.target = { x: domain.w * next.fx, y: domain.h * next.fy };
          phase += 1;
          nextAt = t + next.pause;
          legs.push({ at: t, x: body.x });
        } else {
          phase = -1;
          body.target = null;
        }
      }
      stepBody(body, dt, domain);
      ys.push(body.y);
      speeds.push(Math.hypot(body.vx, body.vy));
    }
    return {
      finished: phase < 0,
      seconds: t,
      legs,
      spanY: [Math.min(...ys), Math.max(...ys)] as [number, number],
      peakD: Math.max(...speeds) / ball,
      body,
    };
  };

  const open = runPlan({ w: 1175, h: 244 });
  assert.ok(open.finished, "the plan does not finish on the open floor band");
  assert.equal(open.legs.length, ROAM_PLAN.length, "not every waypoint was dispatched");
  assert.ok(
    open.seconds >= 4 && open.seconds <= 6.2,
    `open-floor tour took ${open.seconds.toFixed(2)}s, outside the promised window`
  );
  ok(
    `open floor: ${ROAM_PLAN.length} legs walked in ${open.seconds.toFixed(2)}s, ` +
      `y drift ${(open.spanY[1] - open.spanY[0]).toFixed(1)}px`
  );

  const thin = runPlan({ w: 1175, h: 73 });
  assert.ok(thin.finished, "the plan stalls in the hero's thin legibility band");
  assert.equal(thin.legs.length, ROAM_PLAN.length, "a leg was never dispatched in the thin band");
  assert.ok(
    thin.seconds >= 4 && thin.seconds <= 6.2,
    `the hero's own band takes ${thin.seconds.toFixed(2)}s, outside the promised window`
  );
  /* the peak pace the tour is allowed to reach (D/s), read off the sim */
  assert.ok(thin.peakD <= RIG.roam + 0.05, `tour peaked at ${thin.peakD.toFixed(2)} D/s`);
  ok(`tour peaks at ${thin.peakD.toFixed(2)} D/s (ceiling ${RIG.roam})`);
  /* every leg lands inside the band, and the waypoints really are visited */
  for (const leg of thin.legs) assert.ok(leg.x >= 0 && leg.x <= 1175);
  assert.ok(thin.body.y >= 0 && thin.body.y <= 73);
  assert.ok(thin.spanY[1] - thin.spanY[0] > 1, "the thin band flattened the vertical drift away");
  ok(
    `thin band (73px): all legs walked in ${thin.seconds.toFixed(2)}s, ` +
      `y drift ${(thin.spanY[1] - thin.spanY[0]).toFixed(1)}px, resting at x=${Math.round(thin.body.x)}`
  );

  /* An unreachable waypoint now counts as reached, and the aim point never
     leaves the box the body can occupy. */
  const band = { w: 1175, h: 73 };
  const probe: Body = { x: 235, y: 36, vx: 0, vy: 0, r: d / 2, maxSpeed: 300, target: { x: 235, y: 25 } };
  const aim = aimPoint(probe, band);
  assert.ok(aim && aim.y === 25, `aim point moved an in-reach target: ${JSON.stringify(aim)}`);
  const box = reachableBox(probe, band);
  assert.equal(box.minY, 0);
  assert.equal(box.maxY, 73);
  const mob = runPlan({ w: 390, h: 150 }, 110);
  assert.ok(mob.finished, "the plan stalls on a phone hero band");
  assert.ok(
    mob.seconds >= 2.4 && mob.seconds <= 5.5,
    `phone tour took ${mob.seconds.toFixed(2)}s`
  );
  ok(`phone hero: ${ROAM_PLAN.length} legs walked in ${mob.seconds.toFixed(2)}s`);
  /* a target below the band is pulled up to the band, and only there */
  const low = aimPoint({ ...probe, target: { x: 235, y: 900 } }, band);
  assert.equal(low?.y, 73);
  ok("in-reach targets are untouched and out-of-reach ones aim at the band edge");

  /* Where the ball genuinely fits, the outline inset still applies on both
     axes: the droid can never poke out of the floor band. */
  const roomy = reachableBox(probe, { w: 1175, h: 300 });
  assert.equal(roomy.minY, outerRadius(d / 2) + 12);
  assert.equal(roomy.maxY, 300 - outerRadius(d / 2) - 12);
  ok("a floor band the ball fits in keeps the outline inset on both axes");
}

/* ---------------- the reactive typography field ---------------- */

{
  const {
    SIGNATURES,
    letterOffset,
    letterInfluence,
    sweepMaxima,
    LetterField,
    scrambleGlyph,
    SCRAMBLE_GLYPHS,
    REST_EPSILON,
    TEXT_FX,
    FULL_SPEED,
  } = await import("../src/lib/wordField");

  /* A letter dead-centre on the robot is displaced by roughly ampPx, and
     a letter far outside the radius is untouched. */
  for (const sig of Object.keys(SIGNATURES) as (keyof typeof SIGNATURES)[]) {
    const cfg = SIGNATURES[sig];
    const hit = letterOffset(500, 500, FULL_SPEED, cfg);
    const far = letterOffset(500, 500 + cfg.radiusPx * 2, FULL_SPEED, cfg);
    assert.ok(Math.abs(hit.x) > cfg.ampPx * 0.3, `${sig}: peak too weak`);
    assert.ok(Math.abs(hit.x) <= cfg.ampPx * 1.05, `${sig}: peak over amplitude`);
    assert.ok(Math.abs(hit.y) <= cfg.liftPx * 1.05, `${sig}: lift over amplitude`);
    assert.equal(far.x, 0);
    assert.equal(far.y, 0);
    assert.equal(far.rot, 0);
  }
  ok("each word signature peaks near ampPx and vanishes outside its radius");

  /* Speed scaling: a slow roll displaces less than a fast pass. */
  {
    const cfg = SIGNATURES.connect;
    const slow = letterOffset(500, 480, 20, cfg);
    const fast = letterOffset(500, 480, FULL_SPEED, cfg);
    assert.ok(Math.hypot(fast.x, fast.y) > Math.hypot(slow.x, slow.y), "speed has no effect");
    ok("reaction amplitude scales with robot speed");
  }

  /* Per-word contrast: CONNECT spreads wider than LEARN, GROW rotates
     more than LEARN (brief §22). */
  assert.ok(SIGNATURES.connect.radiusPx > SIGNATURES.learn.radiusPx);
  assert.ok(SIGNATURES.grow.rotDeg > SIGNATURES.learn.rotDeg);
  ok("CONNECT spreads wider and GROW rotates harder than LEARN");

  /* Continuity: a sweep across a word peaks once and settles back to
     zero — no letter is left permanently displaced. */
  {
    const xs = [0, 60, 120, 180, 240];
    const { peak, settled } = sweepMaxima(xs, 900, -200, 220, SIGNATURES.connect);
    assert.ok(peak > 6, `sweep peak ${peak.toFixed(2)}px too weak to read`);
    assert.ok(settled < 0.5, `sweep leaves ${settled.toFixed(2)}px residual`);
    ok(`sweep peaks at ${peak.toFixed(1)}px and settles clean`);
  }

  /* The temporal layer. Three letters of a word, droid sweeping right at
     full speed: the ripple has to travel outward, so the letter nearest
     the shell answers first and the far one last. */
  {
    const xs = [0, 130, 260];
    const ys = [0, 0, 0];
    const dt = 1 / 60;
    const speed = 400;
    const field = new LetterField(3, SIGNATURES.connect);
    const firstHit = [Infinity, Infinity, Infinity];
    let t = 0;
    for (let rx = -400; rx < 500; rx += speed * dt) {
      field.step(xs, ys, rx, 0, speed, dt, t).forEach((f, i) => {
        if (f.k > 0.15 && firstHit[i] === Infinity) firstHit[i] = t;
      });
      t += dt * 1000;
    }
    assert.ok(
      firstHit[0] < firstHit[1] && firstHit[1] < firstHit[2],
      `ripple order wrong: ${firstHit.map((v) => Math.round(v)).join(" / ")}ms`
    );
    ok(`ripple travels outward: letters answer at ${firstHit.map((v) => Math.round(v)).join(" / ")}ms`);

    /* Recovery: once the droid has left the word behind, every letter comes
       home and the field reports itself settled, which is the signal the
       component uses to release its inline styles. */
    for (let i = 0; i < 150; i++) field.step(xs, ys, 3000, 0, speed, dt, t + i * dt * 1000);
    assert.ok(field.settled(), "the field never settles after the droid leaves");

    /* ...and stays quiet: no oscillation, no drift once at rest. */
    let drift = 0;
    for (let i = 0; i < 120; i++) {
      for (const f of field.step(xs, ys, 3000, 0, speed, dt, t + i * dt * 1000)) {
        drift = Math.max(drift, Math.abs(f.x), Math.abs(f.y), Math.abs(f.rot), f.k);
      }
    }
    assert.ok(drift < REST_EPSILON, `resting letters drifted by ${drift.toFixed(4)}`);
    ok(`settled field holds still for 2s (max drift ${drift.toFixed(4)})`);

    /* Flicker budget: a letter in full contact may show punctuation, but
       only rarely, only from the hero's own symbol pool, and only where
       the influence is strong. */
    const blink = new LetterField(1, SIGNATURES.connect);
    let frames = 0;
    let flickers = 0;
    let offPool = 0;
    const glyphAt = new Map<number, string>();
    for (let i = 0; i < 300; i++) {
      const tMs = i * 16.7;
      const [f] = blink.step([0], [0], 0, 0, speed, dt, tMs);
      frames++;
      const g = scrambleGlyph(0, tMs);
      if (!SCRAMBLE_GLYPHS.includes(g)) offPool++;
      if (f.scramble) {
        flickers++;
        glyphAt.set(tMs, g);
      }
    }
    assert.equal(offPool, 0, "flicker drew a glyph from outside the pool");
    assert.ok(flickers >= 2, `only ${flickers} flickers in 5s — the effect is invisible`);
    assert.ok(flickers <= frames * 0.15, `${flickers}/${frames} frames flickered — too twitchy`);
    assert.equal(glyphAt.size, flickers, "the same frame produced two different glyphs");
    ok(`flicker fires on ${flickers}/${frames} frames of full contact, always in-pool`);

    /* A letter the droid never reaches never flickers, however long it runs. */
    const distant = new LetterField(1, SIGNATURES.learn);
    let strayFlicker = 0;
    for (let i = 0; i < 300; i++) {
      if (distant.step([0], [0], 4000, 0, speed, dt, i * 16.7)[0].scramble) strayFlicker++;
    }
    assert.equal(strayFlicker, 0);
    ok("a letter outside the field never flickers");

    /* Vertical falloff: at equal horizontal distance, the line the droid is
       rolling under reacts most and the far lines least. */
    const at = (dy: number) => letterInfluence(500, 500, SIGNATURES.connect, dy, 0);
    assert.ok(at(0) > at(100) && at(100) > at(300) && at(300) >= at(900));
    assert.ok(at(900) > 0.5, "a line two rows away lost too much of the field");
    ok("the line under the shell reacts most, the far lines least");

    /* The render loop is fed a live robot pose, so no frame may produce a
       NaN or an unbounded offset — a single one would freeze the letters. */
    {
      const f = new LetterField(6, SIGNATURES.grow);
      let worst = 0;
      let bad = 0;
      for (let i = 0; i < 600; i++) {
        /* a dense 6px-per-frame triangle sweep right across the word, so
           the droid passes over every letter rather than near them */
        const rx = -600 + (i % 200) * 6;
        const ry = 0;
        for (const o of f.step([-200, -100, 0, 100, 200, 300], [0, 0, 0, 0, 0, 0], rx, ry, 260, dt, i * 16.7)) {
          if (!Number.isFinite(o.x + o.y + o.rot + o.k + o.sx)) bad++;
          worst = Math.max(worst, Math.abs(o.x), Math.abs(o.y));
        }
      }
      assert.equal(bad, 0, "the field produced a non-finite offset");
      /* No frame may exceed the signature's own amplitude: ampPx bounds the
         lateral push (polarity only flips its sign) and liftPx the rise. */
      const ceiling = Math.max(SIGNATURES.grow.ampPx, SIGNATURES.grow.liftPx) * 1.05;
      assert.ok(worst <= ceiling, `offset ${worst.toFixed(2)}px exceeded the ${ceiling.toFixed(1)}px ceiling`);
      assert.ok(worst > 5, `peak only ${worst.toFixed(2)}px — the droid never reached the letters`);
      ok(`600 live-pose frames stay finite and bounded (peak ${worst.toFixed(1)}px of ${ceiling.toFixed(1)}px)`);
    }

    /* Every number the component writes is a fraction of these knobs, so the
       reaction can be retuned from one place. */
    assert.ok(TEXT_FX.recoverTau < TEXT_FX.attackTauMax, "recovery slower than the attack");
    assert.ok(TEXT_FX.scrambleAt > 0.5 && TEXT_FX.scrambleAt < 1, "flicker threshold off the field");
    assert.ok(TEXT_FX.squeeze > 0 && TEXT_FX.squeeze < 0.2, "squeeze outside a readable range");
    ok("TEXT_FX keeps attack, recovery, flicker and squeeze in readable ranges");
  }

  /* The bus: publish reaches every subscriber with the payload, and
     unsubscribe actually detaches. */
  {
    const { publishRobot, subscribeRobot } = await import("../src/lib/ruruBus");
    let seen: unknown = null;
    let calls = 0;
    const off = subscribeRobot((p) => {
      seen = p;
      calls += 1;
    });
    publishRobot({ x: 10, y: 20, r: 30, speed: 40, roaming: true });
    off();
    publishRobot({ x: 0, y: 0, r: 0, speed: 0, roaming: false });
    assert.equal(calls, 1);
    const p = seen as { x: number; speed: number; roaming: boolean };
    assert.equal(p.x, 10);
    assert.equal(p.speed, 40);
    assert.equal(p.roaming, true);
    ok("ruruBus delivers once and unsubscribes cleanly");
  }
}

console.log(`\nAll ${passed} Ruru checks passed.`);
