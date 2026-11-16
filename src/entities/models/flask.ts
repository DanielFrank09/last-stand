// A healing draught's flask, and the move that drinks it: taken from the belt by the free hand, held by its neck,
// the round body under the fist and the mouth over the thumb, lifted to the lips by arm IK (the flask's mouth to a point at the mouth on
// the head), the head tipping back to drink, then put away. Shared by the heroes; each model hangs the flask on its
// free hand's joint, closes the fist round it (`holdFlask`) and puts a mouth point on its head.
import * as THREE from 'three';
import type { Joints } from './rig';
import { curve, type Keys } from './motion';
import { hold, fistReach, fistTurn, seatHeld, SLANT, type Hand } from './hands';
import { solveArm } from './armIK';
import { GRIPPED_FLEXION, wristTurn, type BodyShape } from './anatomy';
import { tunable } from '../../core/tuning';
import type { MaterialKit } from '../../types';

const _t = new THREE.Vector3(), _f = new THREE.Vector3(), _m = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3();
const _p = new THREE.Vector3(), _up = new THREE.Vector3(), _a = new THREE.Vector3(), _t0 = new THREE.Vector3(), _f0 = new THREE.Vector3(), _p0 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _r = new THREE.Quaternion(), _e = new THREE.Quaternion(), _fist = new THREE.Quaternion(), _sl = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

/**
 * How the heroes drink, the left hand's (a right hand's mirrored), as a man drinks from a flask held by its neck (the
 * owner's reference photographs: the bulb some 35 degrees below the lips at the first sip, some 40 up and forward of
 * them as it's drunk).
 * - `sip`, `tipped`: where the flask's base is from the mouth (the head's frame: x left, y up, z forward; m: its neck
 *   points from there at the lips), as it comes up and as it drinks: above and before the mouth, so the neck points
 *   down into the lips and the bottom is tipped up.
 * - `pole`, `tippedPole`: where the elbow would rather point (the chest's frame). At the sip out to the side and up,
 *   the forearm coming in across to the mouth: a fist holds a neck across its palm, so a neck that points up at the
 *   lips needs the forearm square to it, and the only such places an elbow can be are out to the side (the other is
 *   inside the chest). Straight down before the chest, the forearm ran up along the neck: the wrist was bent 100 to
 *   150 degrees round it and the forearm turned 60 to 75 past its end, #464. As it drinks, up and forward, the upper
 *   arm about level.
 * - `keep`: what the pole is worth against the ranges (armIK.ts `ArmGoal.keep`), `roll`: how far the fist may turn
 *   about the neck from the way the pole has it (rad).
 * - `carry`: the wrist as the fist carries the flask at the hip, out of the pouch and back to it (degrees: the
 *   forearm's turn, the wrist's flexion and its bend to the thumb's side), and `carrySlant` the neck's slant across
 *   that palm (rad), so the neck stands up out of the fist. (Stood up by the wrist alone, it was bent 28 to 44 degrees
 *   to the thumb's side, past its 20.)
 * - `arc`: how far the flask's way from the hip to the lips bows out before the chest (m), `take`: the share of the
 *   lift over which the arm goes from the hip's pose to the one solved for the flask on that way.
 */
const DRINK = tunable('drink', {
  sip: [0.07, -0.16, 0.14], tipped: [0.08, 0.08, 0.19], pole: [1, -0.2, 0.5], tippedPole: [0.6, -0.4, 1], keep: 120, roll: 1.2,
  carry: [30, 0, 10], carrySlant: 0.35, arc: 0.04, take: 0.25,
});

/** the neck's radius where the fist closes round it, and how far the flask's mouth is from there, up its length */
const NECK_R = 0.019, MOUTH_UP = 0.047;

/** where the flask's body's middle is from where the fist holds the neck, the glass's radius and the draught's (inside
 *  it), and how high the draught stands over the body's middle (m: three-quarters full) */
const BODY_Y = -0.085, GLASS_R = 0.05, DRAUGHT_R = 0.046, FILL = 0.024;
/** the bubbles in the draught, from its middle (m), and how big each is */
const BUBBLES: readonly (readonly [number, number, number, number])[] = [
  // (few and small: five, up to 8 mm across, read as polka dots)
  [0.014, -0.012, 0.008, 0.0024], [-0.012, 0.004, -0.012, 0.0018], [0.004, -0.026, 0.014, 0.002],
];

/** a round-bottomed glass flask, two-thirds full of a glowing red draught (its surface kept level by `holdFlask`, a
 *  hot core glowing through it, a few bubbles), its brass-wrapped neck lipped and collared in brass, a cork tied down
 *  with twine; its origin on the neck (where the fist holds it, as a flask is held), its mouth up its +y. Hung on the hand's joint: `holdFlask` seats it in the fist. (Held
 *  by its base, the body out past the fingers, no fist could close round it, and the hand turned to aim the neck at
 *  the lips drank with its palm out; held round its body, the fingers stood up beside the ball. A solid glowing ball,
 *  it read as a red light, not a potion.) */
export function buildFlask(kit: MaterialKit): THREE.Group {
  // (its own bright brass and a pale cork: in the heroes' own metal and leather, the neck read dark brown)
  const cap = kit.std({ color: 0xc8963c, metalness: 1, roughness: 0.32 });
  const stopper = kit.std({ color: 0xa47c52, roughness: 0.85 });
  const twine = kit.std({ color: 0xd2c29a, roughness: 0.9 });
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, to: THREE.Object3D = g) => {
    const o = new THREE.Mesh(geo, m);
    o.position.y = y;
    to.add(o);
    return o;
  };
  // the draught: the lower part of a ball to its level, a flat surface over it, in a group of its own about the body's
  // middle that `holdFlask` turns to keep that surface level as the flask tips
  const draught = new THREE.Group();
  draught.name = 'draught';
  draught.position.y = BODY_Y;
  g.add(draught);
  const top = Math.asin(FILL / DRAUGHT_R), steps = 12;
  const outline = Array.from({ length: steps + 1 }, (_, i) => {
    const a = -Math.PI / 2 + (top + Math.PI / 2) * i / steps;
    return new THREE.Vector2(DRAUGHT_R * Math.cos(a), DRAUGHT_R * Math.sin(a));
  });
  outline.push(new THREE.Vector2(0, FILL));
  // (solid: seen through, it went a pale salmon over the forest behind)
  const deep = kit.std({ color: 0x420006, emissive: 0x7a0008, emissiveIntensity: 0.45, roughness: 0.06 });
  add(new THREE.LatheGeometry(outline, 20), deep, 0, draught);
  // (its surface lit, as light pools under a liquid's skin; a hot core lit through it read as a ball in a ball)
  const skin = kit.glow(0xb0141a, 0.8, false);
  add(new THREE.CircleGeometry(Math.sqrt(DRAUGHT_R * DRAUGHT_R - FILL * FILL) * 0.98, 20).rotateX(-Math.PI / 2), skin, FILL + 0.0005, draught);
  const fizz = kit.glow(0xff6050, 1.2, false);
  for (const [x, y, z, r] of BUBBLES) add(new THREE.SphereGeometry(r, 6, 4), fizz, y, draught).position.set(x, y, z);
  // the glass round it: a dark tint carrying its highlights and a rim of light round its edge, the draught seen
  // through it (pale, it laid a milky white over the draught, which read pink; without the rim its empty dome
  // vanished against the sky, the flask a red goblet)
  const glass = kit.rim({ color: 0x000000, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false }, 0xffffff, 1.4);
  add(new THREE.SphereGeometry(GLASS_R, 24, 16), glass, BODY_Y).renderOrder = 1;
  // the neck, wrapped in brass where the fist holds it, a little longer than the fist so it shows between the thumb
  // and the lips (as long as the fist, the fist covered the mouth), collared where it leaves the body and lipped at
  // its mouth
  add(new THREE.CylinderGeometry(0.016, 0.021, 0.085, 14), cap, 0.0025);
  add(new THREE.TorusGeometry(0.022, 0.0035, 6, 18).rotateX(Math.PI / 2), cap, -0.036);
  add(new THREE.TorusGeometry(0.0172, 0.003, 6, 18).rotateX(Math.PI / 2), cap, 0.044);
  // the cork, and the twine tying it down over its top: off while it's drunk (`holdFlask`)
  const cork = new THREE.Group();
  cork.name = 'cork';
  g.add(cork);
  add(new THREE.CylinderGeometry(0.0145, 0.0125, 0.024, 10), stopper, 0.055, cork);
  add(new THREE.TorusGeometry(0.0128, 0.0016, 4, 14).rotateX(Math.PI / 2), twine, 0.049, cork);
  for (const a of [0, Math.PI / 2]) add(new THREE.TorusGeometry(0.0145, 0.0012, 4, 12, Math.PI).rotateY(a), twine, 0.055, cork);
  g.userData.slant = 0;
  g.userData.lift = 0;
  g.userData.lifted = 0;
  g.userData.wrist = new THREE.Vector3();
  g.userData.grip = new THREE.Vector3();
  g.userData.draught = draught;
  // (the flask's mouth, which `drink` puts at the lips: the lab measures how far off them it lands)
  const lip = new THREE.Object3D();
  lip.name = 'flaskLip';
  lip.position.y = MOUTH_UP;
  g.add(lip);
  g.userData.cork = cork;
  g.visible = false;
  return g;
}

/** the drink's beats over the cast (k): the off-hand weapon goes onto the hip, the flask comes out, up to the lips, drunk (the heal lands at 0.5), lowered and stowed, the weapon drawn again */
export const DRINK_SHEATHED: readonly [number, number] = [0.12, 0.88];
// (smooth keyed curves: every beat eases in and out, so the arm never starts or stops at speed)
/** the hand at the left hip (the weapon hung there and the flask taken, then stowed and the weapon drawn) */
const HIP: Keys = [[0, 0], [0.12, 1], [0.15, 1], [0.25, 0], [0.72, 0], [0.85, 1], [0.89, 1], [1, 0]];
/** up at the lips */
const LIFT: Keys = [[0, 0], [0.13, 0], [0.33, 1], [0.6, 1], [0.86, 0]];
/** the flask tipped up, drinking (a sip at the lips before it: tipped as it reached them, it came up level) */
const TIP: Keys = [[0, 0], [0.36, 0], [0.45, 1], [0.54, 1], [0.66, 0]];
/** the flask out of the pouch */
const OUT: Keys = [[0, 0], [0.13, 0], [0.18, 1], [0.81, 1], [0.86, 0]];

/** the hand in the fist that carries the flask (0: its own pose's turn), over the cast: turned to it as it goes to the belt, and back as it leaves it */
const FIST: Keys = [[0, 0], [0.12, 1], [0.89, 1], [1, 0]];

/**
 * The drinking move on the free arm (`h`'s; `k` 0..1 of the cast) over the pose so far: the hand to its hip (to hang a
 * weapon there and take the flask from the pouch), up to the lips, the head tipping back as it drinks, down to the hip
 * again (the flask stowed, a weapon drawn). `mouth` is a point just before the lips on the head, `h` the hand that
 * holds `flask`, `body` the body the arm keeps out of (none through the eyes). Returns how far the flask is out
 * (0..1) for the model to show it.
 *
 * The arm at the lips is solved within a body's ranges (armIK.ts) for the fist it ends in: the flask's neck is a
 * handle fixed at the lips, the fist free to turn about it and to hold it diagonally across the palm, as a two-hander's
 * lower hand is solved. The hand joint is given the fist's turn (so the model's own fitting of the arm after it keeps
 * it), which `holdFlask` draws. (Reached with a pole alone and the fist turned round the neck after, nothing held the
 * forearm's turn or the wrist to their ranges, #464.)
 */
export function drink(j: Joints, k: number, mouth: THREE.Object3D, h: Hand, flask: THREE.Object3D, body?: BodyShape): number {
  const left = h.s > 0, sh = left ? j.shoulderL : j.shoulderR, el = left ? j.elbowL : j.elbowR, hd = left ? j.handL : j.handR;
  const hip = curve(HIP, k), e = curve(LIFT, k), tip = curve(TIP, k);
  // to the belt on the hip
  sh.rotation.x += 0.35 * hip; sh.rotation.z += 0.12 * hip; el.rotation.x += -0.6 * hip;
  // the head and shoulders tip back as it drinks
  j.neck.rotation.x += -0.3 * tip; j.head.rotation.x += -0.2 * tip; j.spine.rotation.x += -0.08 * tip;
  flask.userData.lift = e;
  // (kept for the lab: `lift` is spent by `holdFlask` each frame)
  flask.userData.lifted = e;
  // the fist as it carries the flask by the hip: the forearm half turned, the wrist near straight, the neck slanted
  // across the palm to stand up out of it; the hand turned to it as it goes to the belt, and back as it leaves it
  const [pron, flex, rad] = DRINK.carry, fist = curve(FIST, k);
  hd.quaternion.slerp(wristTurn(pron, flex, rad, left, _fist), fist);
  let slant = h.s * DRINK.carrySlant * fist;
  if (e > 0) {
    const sc = j.root.scale.x;
    j.root.updateMatrixWorld(true);
    // from the hip: where that fist has the neck, the way it points, and where the elbow is
    hd.getWorldQuaternion(_q).multiply(_sl.setFromAxisAngle(Z, -slant));
    _f0.set(-h.s, 0, 0).applyQuaternion(_q);
    fistReach(h, _f0, _up.set(0, 1, 0).applyQuaternion(_q), NECK_R, _d, slant);
    hd.getWorldPosition(_t0).add(_d);
    el.getWorldPosition(_p0).sub(sh.getWorldPosition(_a)).normalize();
    // to the lips: the flask's base where it's held from, below them as it comes up and over them as it drinks, its
    // neck pointing from there at the lips and its mouth on them
    mouth.getWorldPosition(_m);
    j.head.getWorldQuaternion(_q);
    _w.fromArray(DRINK.sip).lerp(_p.fromArray(DRINK.tipped), tip);
    _w.x *= h.s;
    _f.copy(_w).negate().applyQuaternion(_q).normalize();
    _t.copy(_m).addScaledVector(_f, -MOUTH_UP * sc);
    _p.fromArray(DRINK.pole).lerp(_w.fromArray(DRINK.tippedPole), tip);
    _p.x *= h.s;
    j.chest.getWorldQuaternion(_q);
    _p.applyQuaternion(_q).normalize();
    // the hand leads the flask up a line from the one to the other, bowed out before the chest, the neck turning
    // from the one way to the other and the elbow following it out (the arm turned joint by joint from the hip's to
    // the lips', the elbow went up and out first and the hand hung from it)
    _t.lerpVectors(_t0, _t, e).addScaledVector(_w.set(0, 0, 1).applyQuaternion(_q), DRINK.arc * sc * Math.sin(Math.PI * e));
    _f.lerpVectors(_f0, _f, e).normalize();
    _p.lerpVectors(_p0, _p, e).normalize();
    // the fist round the neck there with the hand's length towards where the elbow would rather be, and the arm that
    // holds it so within its ranges
    _up.copy(_a).addScaledVector(_p, j.P.upperL * sc).sub(_t).normalize();
    fistReach(h, _f, _up, NECK_R, _d);
    fistTurn(h, _f, _up, _q);
    _r.copy(sh.quaternion); _e.copy(el.quaternion); _fist.copy(hd.quaternion);
    const fit = solveArm(j, left, { wrist: _w.copy(_t).sub(_d), hand: _q, roll: { axis: _f, range: DRINK.roll, at: _t }, pole: _p, keep: DRINK.keep, body, slant: SLANT, slantOnHandle: true, glide: 1, flexion: GRIPPED_FLEXION });
    // (where it has the wrist and the grip, world: the lab reads how far from them they land)
    j.root.updateMatrixWorld(true);
    hd.getWorldPosition(flask.userData.wrist as THREE.Vector3);
    (flask.userData.grip as THREE.Vector3).copy(_t);
    // (taken up from the hip's arm and fist over the lift's first part: the solver holds the neck its own way of the
    // ranges' many. It leaves the hand joint under the slanted fist: the fist's own turn here)
    const w = smooth(e / DRINK.take);
    sh.quaternion.copy(_r.slerp(sh.quaternion, w));
    el.quaternion.copy(_e.slerp(el.quaternion, w));
    hd.quaternion.copy(_fist.slerp(hd.quaternion.multiply(_sl.setFromAxisAngle(Z, fit.slant)), w));
    slant += (fit.slant - slant) * w;
  }
  flask.userData.slant = slant;
  return curve(OUT, k);
}
const smooth = (x: number): number => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/**
 * The fist closed round the flask's neck (`out` how far it's out, its scale), as the hand joint is turned (`drink`
 * turns it: the neck across the palm, slanted on it by as much as the drink has it), the mouth over the thumb. Call
 * while the flask is out, after the arm is posed, in place of the hand's own pose.
 */
export function holdFlask(h: Hand, flask: THREE.Object3D, out: number): void {
  const joint = h.vis.parent!, slant = flask.userData.slant as number;
  joint.updateWorldMatrix(true, false);
  joint.getWorldQuaternion(_q);
  // (the neck and the hand's length from the joint's turn, the slant taken back out of it: `hold` turns the fist by it)
  _r.copy(_q).multiply(_sl.setFromAxisAngle(Z, -slant));
  _d.set(-h.s, 0, 0).applyQuaternion(_r);
  _a.set(0, 1, 0).applyQuaternion(_r);
  const r = NECK_R * out;
  hold(h, _d, r, _a, slant);
  seatHeld(h, flask, r);
  flask.quaternion.setFromUnitVectors(Y, _d.applyQuaternion(_q.invert()));
  // (the draught's surface level, however the flask is tipped: the draught turned back from the flask's own turn)
  flask.updateWorldMatrix(true, false);
  (flask.userData.draught as THREE.Object3D).quaternion.copy(flask.getWorldQuaternion(_q).invert());
  // (the cork out as it reaches the lips: drunk through, it read as a stoppered bottle pressed to the mouth)
  (flask.userData.cork as THREE.Object3D).visible = (flask.userData.lift as number) < 0.95;
  // (a drink not posed this frame leaves the fist the hand joint's own way, the neck square across it)
  flask.userData.slant = 0; flask.userData.lift = 0;
}

/** how far the flask is up at the lips (0..1) at `k`: a model eases what it moves out of the way by it */
export const drinkUp = (k: number): number => curve(LIFT, k);
