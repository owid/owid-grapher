import { expect, it, describe } from "vitest"

import { Experiment } from "./Experiment.js"
import {
    experiments,
    getActiveExperimentArmForUrl,
    isDataPageMetadataRedesignActive,
} from "./config.js"
import {
    DATA_PAGE_METADATA_EXPERIMENT_ID,
    DATA_PAGE_METADATA_EXPERIMENT_TREATMENT_ARM,
    DATA_PAGE_METADATA_V2_EXPERIMENT_ID,
    EXPERIMENT_PREFIX,
} from "./constants.js"

// Look experiments up in the raw registry, NOT via findActiveExperiment: that
// helper filters out expired experiments, so fixture lookups through it would
// start returning undefined on the expiry date and crash this file at
// collection time — failing CI for every PR repo-wide with no code change.
const byId = (rawId: string): Experiment => {
    const exp = experiments.find(
        (e) => e.id === `${EXPERIMENT_PREFIX}-${rawId}`
    )
    if (!exp) throw new Error(`experiment ${rawId} not registered`)
    return exp
}

describe("page-assigned experiments", () => {
    const build = (pathArms: Record<string, string>) =>
        new Experiment({
            id: "test-page-assigned",
            expires: "2099-01-01T00:00:00.000Z",
            unitOfAssignment: "page",
            arms: [
                { id: "control", fraction: 0.5 },
                { id: "treatment", fraction: 0.5 },
            ],
            pathArms,
        })

    it("derives paths from the assignment map", () => {
        const exp = build({
            "/grapher/a": "treatment",
            "/grapher/b": "control",
        })
        expect(exp.paths).toEqual(["/grapher/a", "/grapher/b"])
        expect(exp.isUrlInPaths("/grapher/a")).toBe(true)
        expect(exp.isUrlInPaths("/grapher/c")).toBe(false)
    })

    it("resolves the arm from the path, with no cookie involved", () => {
        const exp = build({
            "/grapher/a": "treatment",
            "/grapher/b": "control",
        })
        expect(exp.getArmForUrl("/grapher/a")).toBe("treatment")
        expect(exp.getArmForUrl("/grapher/b")).toBe("control")
        expect(exp.getArmForUrl("/grapher/c")).toBeUndefined()
    })

    it("rejects an assignment naming an arm that does not exist", () => {
        expect(() => build({ "/grapher/a": "nonexistent" })).toThrow(
            /arm that does not exist/
        )
    })

    it("requires an assignment map when assigning by page", () => {
        expect(
            () =>
                new Experiment({
                    id: "test-missing-path-arms",
                    expires: "2099-01-01T00:00:00.000Z",
                    unitOfAssignment: "page",
                    arms: [{ id: "only", fraction: 1 }],
                    paths: ["/grapher/a"],
                })
        ).toThrow(/must supply "pathArms"/)
    })

    it("rejects pathArms on a visitor-assigned experiment", () => {
        expect(
            () =>
                new Experiment({
                    id: "test-patharms-without-page",
                    expires: "2099-01-01T00:00:00.000Z",
                    arms: [
                        { id: "control", fraction: 0.5 },
                        { id: "treatment", fraction: 0.5 },
                    ],
                    pathArms: { "/grapher/a": "treatment" },
                })
        ).toThrow(/visitor-assigned/)
    })

    it("rejects supplying both paths and pathArms", () => {
        expect(
            () =>
                new Experiment({
                    id: "test-paths-and-patharms",
                    expires: "2099-01-01T00:00:00.000Z",
                    unitOfAssignment: "page",
                    arms: [{ id: "treatment", fraction: 1 }],
                    paths: ["/grapher/a"],
                    pathArms: { "/grapher/a": "treatment" },
                })
        ).toThrow(/not both/)
    })

    it("rejects an experiment with neither paths nor pathArms", () => {
        expect(
            () =>
                new Experiment({
                    id: "test-no-paths",
                    expires: "2099-01-01T00:00:00.000Z",
                    arms: [{ id: "only", fraction: 1 }],
                })
        ).toThrow(/must supply "paths"/)
    })

    it("returns no arm for visitor-assigned experiments", () => {
        const exp = new Experiment({
            id: "test-visitor-assigned",
            expires: "2099-01-01T00:00:00.000Z",
            arms: [{ id: "only", fraction: 1 }],
            paths: ["/grapher/a"],
        })
        expect(exp.unitOfAssignment).toBe("visitor")
        expect(exp.getArmForUrl("/grapher/a")).toBeUndefined()
    })
})

// The v2 assignment is pre-registered: it was fixed, with a recorded seed,
// before any outcome was observed. Editing it mid-flight would silently
// invalidate the experiment, so its shape is asserted here rather than trusted.
describe("data-page-metadata-v2 pre-registered assignment", () => {
    const v2 = byId(DATA_PAGE_METADATA_V2_EXPERIMENT_ID)
    const v1 = byId(DATA_PAGE_METADATA_EXPERIMENT_ID)

    it("is registered and assigned by page", () => {
        expect(v2.unitOfAssignment).toBe("page")
    })

    it("enrols 330 pages, split 165 treatment / 165 control", () => {
        const arms = Object.values(v2.pathArms!)
        expect(arms).toHaveLength(330)
        expect(
            arms.filter(
                (a) => a === DATA_PAGE_METADATA_EXPERIMENT_TREATMENT_ARM
            )
        ).toHaveLength(165)
        expect(arms.filter((a) => a === "control")).toHaveLength(165)
    })

    it("enrols only grapher pages", () => {
        for (const path of Object.keys(v2.pathArms!)) {
            expect(path).toMatch(/^\/grapher\/[a-z0-9-]+$/)
        }
    })

    it("does not overlap v1, whose pages already have the new design", () => {
        const overlap = Object.keys(v2.pathArms!).filter((p) =>
            v1.paths.includes(p)
        )
        expect(overlap).toEqual([])
    })
})

// These assert live behaviour, so they only hold while the experiments are
// active; once expired they are skipped rather than failing unrelated PRs.
describe.runIf(
    !byId(DATA_PAGE_METADATA_V2_EXPERIMENT_ID).isExpired() &&
        !byId(DATA_PAGE_METADATA_EXPERIMENT_ID).isExpired()
)("isDataPageMetadataRedesignActive", () => {
    const v2 = byId(DATA_PAGE_METADATA_V2_EXPERIMENT_ID)
    const entries = Object.entries(v2.pathArms!)
    const treatmentPath = entries.find(
        ([, arm]) => arm === DATA_PAGE_METADATA_EXPERIMENT_TREATMENT_ARM
    )![0]
    const controlPath = entries.find(([, arm]) => arm === "control")![0]

    it("is true for v1 pages, which run at 100% treatment", () => {
        const v1 = byId(DATA_PAGE_METADATA_EXPERIMENT_ID)
        expect(isDataPageMetadataRedesignActive(v1.paths[0])).toBe(true)
    })

    it("is true for v2 treatment pages and false for v2 control pages", () => {
        expect(isDataPageMetadataRedesignActive(treatmentPath)).toBe(true)
        expect(isDataPageMetadataRedesignActive(controlPath)).toBe(false)
    })

    it("is false for a page in no experiment", () => {
        expect(
            isDataPageMetadataRedesignActive("/grapher/not-in-any-experiment")
        ).toBe(false)
    })

    it("still reports control pages as enrolled, so they can be identified", () => {
        expect(
            getActiveExperimentArmForUrl(
                DATA_PAGE_METADATA_V2_EXPERIMENT_ID,
                controlPath
            )
        ).toBe("control")
    })
})

describe("experiment config integrity", () => {
    it("has unique ids", () => {
        const ids = experiments.map((e) => e.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it("has no page enrolled in both metadata experiments", () => {
        const v1 = byId(DATA_PAGE_METADATA_EXPERIMENT_ID)
        const v2 = byId(DATA_PAGE_METADATA_V2_EXPERIMENT_ID)
        for (const path of v2.paths) {
            expect(v1.isUrlInPaths(path)).toBe(false)
        }
    })
})
