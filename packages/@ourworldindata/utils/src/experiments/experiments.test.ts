import { expect, it, describe } from "vitest"

import { Experiment } from "./Experiment.js"
import { experiments, isDataPageMetadataRedesignActive } from "./config.js"
import {
    DATA_PAGE_METADATA_EXPERIMENT_ID,
    DATA_PAGE_METADATA_V2_EXPERIMENT_ID,
    EXPERIMENT_PREFIX,
} from "./constants.js"

// Look experiments up in the raw registry, not via the active-only helpers:
// those filter out expired experiments, so fixture lookups through them would
// start returning undefined on the expiry date and crash this file at
// collection time — failing CI for every PR repo-wide with no code change.
const byId = (rawId: string): Experiment => {
    const exp = experiments.find(
        (e) => e.id === `${EXPERIMENT_PREFIX}-${rawId}`
    )
    if (!exp) throw new Error(`experiment ${rawId} not registered`)
    return exp
}

// A few of the 165 pre-registered CONTROL pages (the full list lives in the
// analytics repo, assignment_v2_165T165C.json). Listing them here guards the
// one mistake that would silently corrupt the experiment: a control page
// creeping into the treatment paths.
const SAMPLE_CONTROL_PATHS = [
    "/grapher/academic-freedom-index",
    "/grapher/annual-area-burnt-by-wildfires-gwis",
    "/grapher/annual-co-emissions-by-region",
    "/grapher/annual-co-emissions-from-aviation",
    "/grapher/annual-industrial-robots-installed",
    "/grapher/annual-number-of-births-by-world-region",
    "/grapher/annual-number-of-fires",
    "/grapher/annual-share-of-co2-emissions",
]

// The v2 treatment list is pre-registered: it was fixed, with a recorded seed,
// before any outcome was observed. Editing it mid-flight would silently
// invalidate the experiment, so its shape is asserted here rather than trusted.
describe("data-page-metadata-v2 pre-registered treatment list", () => {
    const v2 = byId(DATA_PAGE_METADATA_V2_EXPERIMENT_ID)
    const v1 = byId(DATA_PAGE_METADATA_EXPERIMENT_ID)

    it("lists exactly 165 treatment pages, each once", () => {
        expect(v2.paths).toHaveLength(165)
        expect(new Set(v2.paths).size).toBe(165)
    })

    it("runs at 100% treatment, like v1", () => {
        const treatment = v2.arms.find((a) => a.id === "treatment")
        expect(treatment?.fraction).toBe(1)
    })

    it("enrols only grapher pages", () => {
        for (const path of v2.paths) {
            expect(path).toMatch(/^\/grapher\/[a-z0-9-]+$/)
        }
    })

    it("does not overlap v1, whose pages already have the new design", () => {
        expect(v2.paths.filter((p) => v1.paths.includes(p))).toEqual([])
    })

    it("contains none of the pre-registered control pages", () => {
        expect(
            SAMPLE_CONTROL_PATHS.filter((p) => v2.paths.includes(p))
        ).toEqual([])
    })
})

// These assert live behaviour, so they only hold while the experiments are
// active; once expired they are skipped rather than failing unrelated PRs.
describe.runIf(
    !byId(DATA_PAGE_METADATA_V2_EXPERIMENT_ID).isExpired() &&
        !byId(DATA_PAGE_METADATA_EXPERIMENT_ID).isExpired()
)("the redesign gate", () => {
    it("is true for v1 pages", () => {
        const v1 = byId(DATA_PAGE_METADATA_EXPERIMENT_ID)
        expect(isDataPageMetadataRedesignActive(v1.paths[0])).toBe(true)
    })

    it("is true for v2 treatment pages", () => {
        const v2 = byId(DATA_PAGE_METADATA_V2_EXPERIMENT_ID)
        expect(isDataPageMetadataRedesignActive(v2.paths[0])).toBe(true)
        expect(isDataPageMetadataRedesignActive(v2.paths[164])).toBe(true)
    })

    it("is false for v2 control pages and for pages in no experiment", () => {
        for (const p of SAMPLE_CONTROL_PATHS) {
            expect(isDataPageMetadataRedesignActive(p)).toBe(false)
        }
        expect(
            isDataPageMetadataRedesignActive("/grapher/not-in-any-experiment")
        ).toBe(false)
    })
})

describe("experiment config integrity", () => {
    it("has unique ids", () => {
        const ids = experiments.map((e) => e.id)
        expect(new Set(ids).size).toBe(ids.length)
    })
})
