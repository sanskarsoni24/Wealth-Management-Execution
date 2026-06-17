/**
 * Rail entry point. Seeds the in-memory state at module load, then re-exports the
 * consumer-shaped client + the dev/bus surfaces. The app imports the client from
 * here; the dev panel imports dev + bus.
 *
 * ⚠️ NO NSE. NO CREDENTIALS. NO PERSISTENCE. Everything resets on reload.
 */
import { seed } from "./seed";

seed();

export * from "./client";
export * as dev from "./dev";
export { subscribe, getLog, type TransitionEvent } from "./bus";
export { PERSONAS } from "./seed";
