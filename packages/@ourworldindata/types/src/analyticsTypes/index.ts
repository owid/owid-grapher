// Analytics Type System
//
// This is the complete contract between frontend and analytics backend (GA4).
// All event categories, parameter types, and type mappings are defined here.

export * from "./events"
export type * from "./params"
export type { EventParamsMap, GAEvent } from "./mapping.js"
