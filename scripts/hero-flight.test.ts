import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleHeroFlight } from '../components/basalt-marketing/hero-flight';

const cycleSeconds = 48;
const openingPose = .18;

test('the hero starts at its composed flight pose and travels without scrolling', () => {
    const opening = sampleHeroFlight(0, openingPose);
    const later = sampleHeroFlight(2, openingPose);

    assert.ok(Math.abs(opening.progress - openingPose) < 1e-12);
    assert.equal(opening.opacity, 1);
    assert.ok(later.progress > opening.progress + .02, 'elapsed time must visibly advance the route');
    assert.equal(later.opacity, 1);
});

test('flight travels forward across several loops and only resets while concealed', () => {
    let previous = sampleHeroFlight(0, openingPose);
    let resets = 0;
    for (let frame = 1; frame <= 45 * cycleSeconds * 4; frame++) {
        const current = sampleHeroFlight(frame / 45, openingPose);
        if (current.progress < previous.progress) {
            resets++;
            assert.ok(previous.progress > .99 && current.progress < .01);
            assert.ok(previous.opacity < .002 && current.opacity < .002, 'the return to launch must be hidden');
        } else {
            assert.ok(current.progress > previous.progress, 'the flight must never reverse or stall its clock');
        }
        previous = current;
    }
    assert.equal(resets, 4);
});

test('the loop boundary is invisible and fades to full visibility on either side', () => {
    const resetAt = cycleSeconds * (1 - openingPose);
    const before = sampleHeroFlight(resetAt - .001, openingPose);
    const reset = sampleHeroFlight(resetAt, openingPose);
    const after = sampleHeroFlight(resetAt + .001, openingPose);

    assert.ok(before.progress > .999);
    assert.equal(reset.progress, 0);
    assert.equal(reset.opacity, 0);
    assert.ok(after.progress < .001);
    assert.ok(before.opacity < .00001 && after.opacity < .00001);
    assert.equal(sampleHeroFlight(resetAt - 2, openingPose).opacity, 1);
    assert.equal(sampleHeroFlight(resetAt + 2, openingPose).opacity, 1);
});

test('progress and opacity stay finite and bounded for every supported opening pose', () => {
    for (const pose of [0, .18, .5, .999, 1]) {
        for (const elapsed of [0, .001, 1.2, 24, 47.999, 48, 48.001, 96, 86400, 1e9]) {
            const sample = sampleHeroFlight(elapsed, pose);
            assert.ok(Number.isFinite(sample.progress) && sample.progress >= 0 && sample.progress < 1);
            assert.ok(Number.isFinite(sample.opacity) && sample.opacity >= 0 && sample.opacity <= 1);
        }
    }
});

test('holding the animation clock gives the same frame and resuming advances from it', () => {
    const paused = sampleHeroFlight(7.5, openingPose);
    assert.deepEqual(sampleHeroFlight(7.5, openingPose), paused);
    const resumed = sampleHeroFlight(7.5 + 1 / 45, openingPose);
    assert.ok(resumed.progress > paused.progress && resumed.progress - paused.progress < .001);
    assert.equal(resumed.opacity, paused.opacity);
});
