// Types for the generated bespoke viz registry: one entry per bundle of the
// bespoke component registry, with the variants and config keys its
// src/index.tsx declares (VARIANTS, CONFIG_SPEC) and the prose and examples
// of its optional docs.md. Produced by
// devTools/gdocs/generate-gdocs-references.ts (committed to
// ./bespoke-viz.registry.generated.json).

import type { SidecarExample, SidecarProse } from "./ComponentReference.js"

export interface BespokeVizRegistry {
    /** One per key of BESPOKE_COMPONENT_REGISTRY, in key order */
    bundles: BundleReference[]
}

export interface BundleReference {
    /** Registry key, e.g. "causes-of-death" */
    id: string
    /** Repo-relative path of the file declaring VARIANTS and CONFIG_SPEC */
    entryFile: string
    /** Repo-relative path of the bundle's docs.md, only if it exists */
    sidecarFile?: string
    /** The split docs.md prose (intro + notes); `{ intro: "" }` without it */
    prose: SidecarProse
    /** The fenced examples of docs.md, each one validated */
    examples: SidecarExample[]
    /** In VARIANTS order; the first one is the primary variant */
    variants: BundleVariantReference[]
    /** In CONFIG_SPEC key order */
    config: BundleConfigField[]
}

export type BundleVariantSize = "narrow" | "wide" | "widest"

export interface BundleVariantReference {
    name: string
    description: string
    /** The variant's defaultSize, else "wide" */
    defaultSize: BundleVariantSize
    /** A full, validated {.bespoke-component} block for this variant */
    archie: string
}

export type BundleConfigFieldType =
    | "string"
    | "boolean"
    | "number"
    | "integer"
    | "enum"
    | "custom"

export interface BundleConfigField {
    name: string
    type: BundleConfigFieldType
    /** The allowed values (enum only) */
    values?: string[]
    /** What a value looks like (custom only) */
    format?: string
    description: string
    /** Applied when the key is unset, never when it is invalid */
    default?: string
}
