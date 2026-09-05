import { describe, expect, test } from "vitest"
import {
    buildQueryParamDecisionTree,
    deserializeDecisionTree,
    matchQueryParamDecisionTree,
    type QueryParamMatchRule,
    serializeDecisionTree,
} from "./QueryParamDecisionTree.js"

type ExpectedMatch<T> = {
    query: Record<string, string | null>
    target: T | undefined
}

function expectMatches<T>(
    rules: QueryParamMatchRule<T>[],
    cases: ExpectedMatch<T>[]
): void {
    const tree = buildQueryParamDecisionTree(rules)

    for (const { query, target } of cases) {
        expect(
            matchQueryParamDecisionTree(tree, query),
            JSON.stringify(query)
        ).toBe(target)
    }
}

describe("QueryParamDecisionTree", () => {
    // Consumers provide overlapping rules, so matching must consistently
    // choose the most specific applicable rule. Null values are wildcards and
    // an empty condition is the final fallback.
    describe("matching precedence", () => {
        test("distinguishes exact matches, wildcards, and the default", () => {
            expectMatches(
                [
                    {
                        condition: { country: "USA", tab: "chart" },
                        target: "usaChart",
                    },
                    {
                        condition: { country: "USA", tab: "map" },
                        target: "usaMap",
                    },
                    {
                        condition: { country: "CAN", tab: null },
                        target: "canadaAnyTab",
                    },
                    { condition: {}, target: "default" },
                ],
                [
                    {
                        query: { country: "USA", tab: "chart" },
                        target: "usaChart",
                    },
                    {
                        query: { country: "USA", tab: "map" },
                        target: "usaMap",
                    },
                    {
                        query: { country: "USA", tab: "other" },
                        target: "default",
                    },
                    { query: { country: "CAN" }, target: "canadaAnyTab" },
                    {
                        query: { country: "CAN", tab: "chart" },
                        target: "canadaAnyTab",
                    },
                    { query: { country: "MEX" }, target: "default" },
                    { query: {}, target: "default" },
                ]
            )
        })

        test("treats a null condition as a wildcard", () => {
            expectMatches(
                [
                    {
                        condition: { country: "USA", tab: "chart" },
                        target: "specific",
                    },
                    {
                        condition: { country: "USA", tab: null },
                        target: "anyUsaTab",
                    },
                    { condition: {}, target: "default" },
                ],
                [
                    {
                        query: { country: "USA", tab: "chart" },
                        target: "specific",
                    },
                    {
                        query: { country: "USA", tab: "map" },
                        target: "anyUsaTab",
                    },
                    { query: { country: "USA" }, target: "anyUsaTab" },
                    {
                        query: { country: "USA", tab: null },
                        target: "anyUsaTab",
                    },
                    {
                        query: { country: "CAN", tab: "chart" },
                        target: "default",
                    },
                ]
            )
        })

        test("prefers the rule with more matching conditions", () => {
            expectMatches(
                [
                    { condition: { country: "USA" }, target: "country" },
                    {
                        condition: { country: "USA", tab: "chart" },
                        target: "countryAndTab",
                    },
                    { condition: { tab: "chart" }, target: "tab" },
                ],
                [
                    {
                        query: { country: "USA", tab: "chart" },
                        target: "countryAndTab",
                    },
                    {
                        query: { country: "USA", tab: "map" },
                        target: "country",
                    },
                    {
                        query: { country: "CAN", tab: "chart" },
                        target: "tab",
                    },
                ]
            )
        })

        test("preserves overall specificity across different branch keys", () => {
            expectMatches(
                [
                    {
                        condition: { a: "1", b: "2", c: "3" },
                        target: "mostSpecific",
                    },
                    {
                        condition: { b: "2", d: "4" },
                        target: "lessSpecific",
                    },
                    { condition: { a: "1" }, target: "leastSpecific" },
                ],
                [
                    {
                        query: { a: "1", b: "2", c: "3", d: "4" },
                        target: "mostSpecific",
                    },
                    {
                        query: { a: "9", b: "2", d: "4" },
                        target: "lessSpecific",
                    },
                    {
                        query: { a: "1", b: "9" },
                        target: "leastSpecific",
                    },
                ]
            )
        })
    })

    // The built tree is serialized and reused at runtime. Its compact shape
    // must not change matching semantics, and object-prototype names must
    // behave like ordinary unrecognized input rather than inherited branches.
    describe("tree representation", () => {
        test("prunes a subtree once its highest-priority rule wins", () => {
            const rules: QueryParamMatchRule<string>[] = [
                { condition: { a: "1" }, target: "aWins" },
                { condition: { b: "2" }, target: "bWins" },
            ]
            const tree = buildQueryParamDecisionTree(rules)

            expect(tree.type).toBe("decision")
            if (tree.type === "decision") {
                expect(tree.paramName).toBe("a")
                expect(tree.branches["1"]).toEqual({
                    type: "leaf",
                    target: "aWins",
                })
            }

            expectMatches(rules, [
                { query: { a: "1", b: "2" }, target: "aWins" },
                { query: { a: "1" }, target: "aWins" },
                { query: { b: "2" }, target: "bWins" },
                { query: { c: "3" }, target: undefined },
            ])
        })

        test("does not match inherited Object.prototype property names", () => {
            const rules: QueryParamMatchRule<string>[] = [
                { condition: { country: "USA" }, target: "usa" },
                { condition: {}, target: "default" },
            ]
            const prototypePropertyNames = [
                "constructor",
                "toString",
                "__proto__",
                "hasOwnProperty",
                "valueOf",
            ]

            expectMatches(rules, [
                ...prototypePropertyNames.map((country) => ({
                    query: { country },
                    target: "default",
                })),
                { query: { country: "USA" }, target: "usa" },
            ])
        })

        test("preserves matching through serialization", () => {
            const tree = buildQueryParamDecisionTree([
                {
                    condition: { country: "USA", tab: "chart" },
                    target: "usaChart",
                },
                { condition: {}, target: "default" },
            ])
            const deserialized = deserializeDecisionTree<string>(
                serializeDecisionTree(tree)
            )

            expect(
                matchQueryParamDecisionTree(deserialized, {
                    country: "USA",
                    tab: "chart",
                })
            ).toBe("usaChart")
            expect(matchQueryParamDecisionTree(deserialized, {})).toBe(
                "default"
            )
        })
    })

    // A large generated rule set exercises construction, serialization, exact
    // lookup at both ends of the input, and fallback behavior without treating
    // every generated permutation as an independently meaningful scenario.
    test("keeps exact and fallback matches with 1,000 rules", () => {
        const countries = ["USA", "CAN", "GBR", "FRA", "DEU", "IND", "CHN"]
        const tabs = ["chart", "map", "table"]
        const types = ["line", "bar", "scatter"]
        const rules: QueryParamMatchRule<string>[] = Array.from(
            { length: 1000 },
            (_, index) => ({
                condition: {
                    country: countries[index % countries.length],
                    tab: tabs[(index >> 1) % tabs.length],
                    type: types[(index >> 2) % types.length],
                    year: index.toString(),
                },
                target: `target-${index}`,
            })
        )
        rules.push({ condition: { country: "USA" }, target: "usaFallback" })
        rules.push({ condition: {}, target: "default" })

        const tree = deserializeDecisionTree<string>(
            serializeDecisionTree(buildQueryParamDecisionTree(rules))
        )

        expect(
            matchQueryParamDecisionTree(tree, {
                country: "USA",
                tab: "chart",
                type: "line",
                year: "0",
                otherParam: "ignored",
            })
        ).toBe("target-0")
        expect(
            matchQueryParamDecisionTree(tree, {
                country: "IND",
                tab: "map",
                type: "line",
                year: "999",
            })
        ).toBe("target-999")
        expect(
            matchQueryParamDecisionTree(tree, {
                country: "USA",
                tab: "unrelated",
            })
        ).toBe("usaFallback")
        expect(
            matchQueryParamDecisionTree(tree, {
                country: "MEX",
                tab: "unrelated",
            })
        ).toBe("default")
    })
})
