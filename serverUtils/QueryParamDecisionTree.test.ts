import { expect, test, describe } from "vitest"
import {
    buildQueryParamDecisionTree,
    matchQueryParamDecisionTree,
    serializeDecisionTree,
    deserializeDecisionTree,
    QueryParamMatchRule,
} from "./QueryParamDecisionTree.js"

describe("QueryParamDecisionTree", () => {
    test("basic exact matching", () => {
        const rules: QueryParamMatchRule<string>[] = [
            { condition: { country: "USA", tab: "chart" }, target: "targetA" },
            { condition: { country: "USA", tab: "map" }, target: "targetB" },
            { condition: { country: "CAN", tab: null }, target: "targetC" },
            { condition: {}, target: "defaultTarget" },
        ]

        const tree = buildQueryParamDecisionTree(rules)

        expect(
            matchQueryParamDecisionTree(tree, {
                country: "USA",
                tab: "chart",
            })
        ).toBe("targetA")
        expect(
            matchQueryParamDecisionTree(tree, { country: "USA", tab: "map" })
        ).toBe("targetB")
        expect(
            matchQueryParamDecisionTree(tree, {
                country: "USA",
                tab: "other",
            })
        ).toBe("defaultTarget")
        expect(matchQueryParamDecisionTree(tree, { country: "CAN" })).toBe(
            "targetC"
        )
        expect(
            matchQueryParamDecisionTree(tree, {
                country: "CAN",
                tab: "chart",
            })
        ).toBe("targetC")
        expect(matchQueryParamDecisionTree(tree, { country: "MEX" })).toBe(
            "defaultTarget"
        )
        expect(matchQueryParamDecisionTree(tree, {})).toBe("defaultTarget")
    })

    test("matching with null parameter values as wildcards", () => {
        const rules: QueryParamMatchRule<string>[] = [
            {
                condition: { country: "USA", tab: "chart" },
                target: "targetSpecific",
            },
            {
                condition: { country: "USA", tab: null },
                target: "targetWildcard",
            },
            { condition: {}, target: "ultimateFallback" },
        ]

        const tree = buildQueryParamDecisionTree(rules)

        // Matches specific rule (chart)
        expect(
            matchQueryParamDecisionTree(tree, {
                country: "USA",
                tab: "chart",
            })
        ).toBe("targetSpecific")

        // Matches wildcard rule because tab is "map" and tab is wildcard in rule 2
        expect(
            matchQueryParamDecisionTree(tree, {
                country: "USA",
                tab: "map",
            })
        ).toBe("targetWildcard")

        // Matches wildcard rule when tab is missing/undefined
        expect(
            matchQueryParamDecisionTree(tree, {
                country: "USA",
            })
        ).toBe("targetWildcard")

        // Matches wildcard rule when tab is explicitly null
        expect(
            matchQueryParamDecisionTree(tree, {
                country: "USA",
                tab: null,
            })
        ).toBe("targetWildcard")

        // Fallback because country doesn't match
        expect(
            matchQueryParamDecisionTree(tree, {
                country: "CAN",
                tab: "chart",
            })
        ).toBe("ultimateFallback")
    })

    test("specificity priority resolution", () => {
        // More specific rules should win over less specific rules
        const rules: QueryParamMatchRule<string>[] = [
            { condition: { country: "USA" }, target: "lowSpecificity" },
            {
                condition: { country: "USA", tab: "chart" },
                target: "highSpecificity",
            },
            { condition: { tab: "chart" }, target: "mediumSpecificity" },
        ]

        const tree = buildQueryParamDecisionTree(rules)

        // Both USA and chart match: high specificity (USA + chart) wins.
        expect(
            matchQueryParamDecisionTree(tree, {
                country: "USA",
                tab: "chart",
            })
        ).toBe("highSpecificity")

        // Only USA matches
        expect(
            matchQueryParamDecisionTree(tree, { country: "USA", tab: "map" })
        ).toBe("lowSpecificity")

        // Only chart matches
        expect(
            matchQueryParamDecisionTree(tree, {
                country: "CAN",
                tab: "chart",
            })
        ).toBe("mediumSpecificity")
    })

    test("resolves overall specificity even across different branch keys", () => {
        // R1 is the most specific rule (3 conditions), but it shares no single key
        // with R2 that would let a naive branch-then-concatenate strategy keep R1
        // ahead of R2 once both rules become simultaneous fallbacks deeper in the tree.
        const rules: QueryParamMatchRule<string>[] = [
            { condition: { a: "1", b: "2", c: "3" }, target: "mostSpecific" },
            { condition: { b: "2", d: "4" }, target: "lessSpecific" },
            { condition: { a: "1" }, target: "leastSpecific" },
        ]

        const tree = buildQueryParamDecisionTree(rules)

        // Matches all three rules: the most specific one should win.
        expect(
            matchQueryParamDecisionTree(tree, {
                a: "1",
                b: "2",
                c: "3",
                d: "4",
            })
        ).toBe("mostSpecific")

        // Only matches rule 2 (b + d).
        expect(
            matchQueryParamDecisionTree(tree, { a: "9", b: "2", d: "4" })
        ).toBe("lessSpecific")

        // Only matches rule 3 (a).
        expect(matchQueryParamDecisionTree(tree, { a: "1", b: "9" })).toBe(
            "leastSpecific"
        )
    })

    test("does not treat Object.prototype property names as matching branch values", () => {
        const rules: QueryParamMatchRule<string>[] = [
            { condition: { country: "USA" }, target: "targetUSA" },
            { condition: {}, target: "defaultTarget" },
        ]

        const tree = buildQueryParamDecisionTree(rules)

        for (const value of [
            "constructor",
            "toString",
            "__proto__",
            "hasOwnProperty",
            "valueOf",
        ]) {
            expect(matchQueryParamDecisionTree(tree, { country: value })).toBe(
                "defaultTarget"
            )
        }

        // Sanity check: a real value still matches as expected.
        expect(matchQueryParamDecisionTree(tree, { country: "USA" })).toBe(
            "targetUSA"
        )
    })

    test("serialization and deserialization", () => {
        const rules: QueryParamMatchRule<string>[] = [
            { condition: { country: "USA", tab: "chart" }, target: "targetA" },
            { condition: {}, target: "defaultTarget" },
        ]

        const tree = buildQueryParamDecisionTree(rules)
        const serialized = serializeDecisionTree(tree)
        const deserialized = deserializeDecisionTree<string>(serialized)

        expect(
            matchQueryParamDecisionTree(deserialized, {
                country: "USA",
                tab: "chart",
            })
        ).toBe("targetA")
        expect(matchQueryParamDecisionTree(deserialized, {})).toBe(
            "defaultTarget"
        )
    })

    test("scaling to 1000 rules", () => {
        const rules: QueryParamMatchRule<string>[] = []

        // Generate 1000 rules testing different combinations of parameters
        // parameters: country, tab, year, type
        const countries = ["USA", "CAN", "GBR", "FRA", "DEU", "IND", "CHN"]
        const tabs = ["chart", "map", "table"]
        const types = ["line", "bar", "scatter"]

        for (let i = 0; i < 1000; i++) {
            const country = countries[i % countries.length]
            const tab = tabs[(i >> 1) % tabs.length]
            const type = types[(i >> 2) % types.length]
            const year = i.toString()

            rules.push({
                condition: { country, tab, type, year },
                target: `target-${i}`,
            })
        }

        // Add a few generic fallback rules
        rules.push({ condition: { country: "USA" }, target: "fallback-usa" })
        rules.push({ condition: {}, target: "ultimate-fallback" })

        const tree = buildQueryParamDecisionTree(rules)

        const serialized = serializeDecisionTree(tree)

        const deserialized = deserializeDecisionTree<string>(serialized)

        // Matches one of the generated 1000 rules exactly (first rule: i=0)
        const matchResultExact = matchQueryParamDecisionTree(deserialized, {
            country: "USA",
            tab: "chart",
            type: "line",
            year: "0",
            otherParam: "ignoredValue",
        })

        expect(matchResultExact).toBe("target-0")

        // Matches i=999
        // country = countries[999 % 7] = countries[5] = IND
        // tab = tabs[(999 >> 1) % 3] = tabs[499 % 3] = tabs[1] = map
        // type = types[(999 >> 2) % 3] = types[249 % 3] = types[0] = line
        // year = 999
        const matchResult999 = matchQueryParamDecisionTree(deserialized, {
            country: "IND",
            tab: "map",
            type: "line",
            year: "999",
        })
        expect(matchResult999).toBe("target-999")

        // Matches USA fallback
        const matchResultFallbackUsa = matchQueryParamDecisionTree(
            deserialized,
            {
                country: "USA",
                tab: "unrelated",
            }
        )
        expect(matchResultFallbackUsa).toBe("fallback-usa")

        // Matches ultimate fallback
        const matchResultUltimateFallback = matchQueryParamDecisionTree(
            deserialized,
            {
                country: "MEX",
                tab: "unrelated",
            }
        )
        expect(matchResultUltimateFallback).toBe("ultimate-fallback")
    })
})
