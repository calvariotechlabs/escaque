// Puente entre la interfaz y el motor (el Worker en sí está en engine-worker.ts).
export { handleRequest, MAX_MOVES } from "./protocol.js";
export type { SearchRequest, EngineResponse } from "./protocol.js";
export { EngineClient, EngineCancelledError, createEngineClient } from "./client.js";
export type { WorkerLike, ThinkRequest } from "./client.js";
