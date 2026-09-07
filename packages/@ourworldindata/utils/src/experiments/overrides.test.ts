import { describe, expect, it } from "vitest"
import { Experiment } from "./Experiment.js"
import {
    expectedExperimentBodyClasses,
    parseExperimentOverrides,
} from "./overrides.js"

const future = new Date(Date.now() + 864e5).toISOString()
const past = new Date(Date.now() - 864e5).toISOString()

const active = new Experiment({
    id: "active-v1",
    expires: future,
    arms: [
        { id: "control", fraction: 0.5 },
        { id: "treatment", fraction: 0.5 },
    ],
    paths: ["/latest"],
})
const expired = new Experiment({
    id: "expired-v1",
    expires: past,
    arms: [{ id: "only", fraction: 1 }],
    paths: ["/latest"],
})
const experiments = [active, expired]

describe(parseExperimentOverrides, () => {
    it("accepts a known arm of an active experiment", () => {
        const overrides = parseExperimentOverrides(
            "?exp-active-v1=treatment",
            experiments
        )
        expect(overrides).toHaveLength(1)
        expect(overrides[0].experiment).toBe(active)
        expect(overrides[0].arm.id).toBe("treatment")
    })

    it("ignores unknown experiments, unknown arms, expired experiments and other params", () => {
        expect(
            parseExperimentOverrides(
                "?exp-nope-v1=control&exp-active-v1=bogus&exp-expired-v1=only&topics=Health",
                experiments
            )
        ).toEqual([])
    })
})

describe(expectedExperimentBodyClasses, () => {
    it("derives one class per matching experiment cookie", () => {
        expect(
            expectedExperimentBodyClasses(
                { "exp-active-v1": "treatment", "exp-expired-v1": "only" },
                "/latest",
                experiments
            )
        ).toEqual(["exp-active-v1--treatment"])
    })

    it("yields nothing off the experiment's paths or for unknown arms", () => {
        expect(
            expectedExperimentBodyClasses(
                { "exp-active-v1": "treatment" },
                "/",
                experiments
            )
        ).toEqual([])
        expect(
            expectedExperimentBodyClasses(
                { "exp-active-v1": "bogus" },
                "/latest",
                experiments
            )
        ).toEqual([])
    })
})
