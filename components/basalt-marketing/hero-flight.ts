const FLIGHT_SECONDS = 48;
const TRANSITION_SECONDS = 1.2;

/** A forward-only flight with a short dissolve concealing the return to launch. */
export function sampleHeroFlight(elapsed: number, initialProgress: number) {
    const cycle = ((initialProgress * FLIGHT_SECONDS + elapsed) % FLIGHT_SECONDS + FLIGHT_SECONDS) % FLIGHT_SECONDS;
    const edge = Math.min(cycle, FLIGHT_SECONDS - cycle);
    const blend = Math.min(1, edge / TRANSITION_SECONDS);
    return {
        progress: cycle / FLIGHT_SECONDS,
        opacity: blend * blend * (3 - 2 * blend),
    };
}
