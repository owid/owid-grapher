import { afterEach, beforeEach, expect, it, describe, vi } from "vitest"
import * as db from "../db.js"

import {
    buildWhereClauses,
    canUseFulltext,
    searchVariables,
    searchVariablesGroupedByDataset,
    unindexedSearchTerms,
} from "./Variable.js"

describe(canUseFulltext, () => {
    it("takes ordinary words", () => {
        expect(canUseFulltext("deaths")).toBe(true)
        expect(canUseFulltext("co2")).toBe(true)
        expect(canUseFulltext("uk_road_deaths_ons")).toBe(true)
    })

    it("rejects terms below the index's minimum token length", () => {
        expect(canUseFulltext("uk")).toBe(false)
        expect(canUseFulltext("a")).toBe(false)
    })

    it("rejects MySQL's stopwords, which the index leaves out", () => {
        // `who` is one of our namespaces, so this one matters
        expect(canUseFulltext("who")).toBe(false)
        expect(canUseFulltext("WHO")).toBe(false)
        expect(canUseFulltext("when")).toBe(false)
        expect(canUseFulltext("where")).toBe(false)
    })

    it("splits a term the way MySQL's tokenizer would", () => {
        // handed whole, `+age-standardized*` reads as "age but NOT
        // standardized" and matched none of the 5,751 rows it should
        expect(canUseFulltext("age-standardized")).toBe(true)
        expect(canUseFulltext("grapher/who")).toBe(true)
        expect(canUseFulltext("covid-19")).toBe(true)
    })

    it("has no usable token when every word is one the index drops", () => {
        expect(canUseFulltext("who-is")).toBe(false)
        expect(canUseFulltext("a-b")).toBe(false)
        expect(canUseFulltext("19")).toBe(false)
    })

    it("rejects terms carrying regex syntax, which the search box advertises", () => {
        expect(canUseFulltext("^population")).toBe(false)
        expect(canUseFulltext("deaths$")).toBe(false)
        expect(canUseFulltext("co(2|₂)")).toBe(false)
        expect(canUseFulltext("gdp.*capita")).toBe(false)
        // alternation makes the words alternatives, so neither is required
        expect(canUseFulltext("deaths|births")).toBe(false)
    })
})

describe(unindexedSearchTerms, () => {
    it("names the terms that fall back to a substring scan", () => {
        expect(unindexedSearchTerms("uk road deaths")).toEqual(["uk"])
        expect(unindexedSearchTerms("who deaths")).toEqual(["who"])
        expect(unindexedSearchTerms("^population before:2023")).toEqual([
            "^population",
        ])
    })

    it("is empty when every term can use the index", () => {
        expect(unindexedSearchTerms("road deaths")).toEqual([])
        expect(unindexedSearchTerms("")).toEqual([])
        expect(unindexedSearchTerms(undefined)).toEqual([])
    })

    it("checks the value of a path field, which goes through the index too", () => {
        expect(unindexedSearchTerms("namespace:who dataset:gho")).toEqual([
            "namespace:who",
        ])
        expect(unindexedSearchTerms("name:uk")).toEqual(["name:uk"])
    })

    it("ignores exclusions and fields matched on the dataset", () => {
        expect(unindexedSearchTerms("deaths -uk")).toEqual([])
        expect(unindexedSearchTerms("is:private dataset-id:12")).toEqual([])
    })
})

describe(buildWhereClauses, () => {
    it("keeps search text in bindings, not in SQL", () => {
        const term = "why? a\\? x' OR 1=1 --"
        const [clause] = buildWhereClauses(`name:"${term}"`)
        expect(clause).toEqual({
            sql: "  REGEXP_LIKE(v.name, ?, 'i')",
            bindings: [term],
        })
    })

    it.each([
        ["name", "v.name", true],
        ["path", "v.catalogPath", true],
        [
            "namespace",
            "SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(v.catalogPath, '/', 2), '/', -1), '#', 1)",
            true,
        ],
        [
            "version",
            "SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(v.catalogPath, '/', 3), '/', -1), '#', 1)",
            true,
        ],
        [
            "dataset",
            "SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(v.catalogPath, '/', 4), '/', -1), '#', 1)",
            true,
        ],
        [
            "table",
            "SUBSTRING_INDEX(SUBSTRING_INDEX(SUBSTRING_INDEX(v.catalogPath, '/', 5), '/', -1), '#', 1)",
            true,
        ],
        ["short", "v.shortName", true],
        ["dataset-name", "d.name", false],
    ] as const)(
        "matches %s: on the correct expression and index policy",
        (field, expression, indexed) => {
            const clauses = buildWhereClauses(`${field}:road`)
            expect(clauses).toEqual([
                {
                    sql: `  REGEXP_LIKE(${expression}, ?, 'i')`,
                    bindings: ["road"],
                },
                ...(indexed
                    ? [
                          {
                              sql: "MATCH(v.name, v.catalogPath) AGAINST(? IN BOOLEAN MODE)",
                              bindings: ["+road*"],
                          },
                      ]
                    : []),
            ])
            expect(buildWhereClauses(`${field}:`)).toEqual([])
            expect(unindexedSearchTerms(`${field}:who`)).toEqual(
                indexed ? [`${field}:who`] : []
            )
        }
    )

    it.each(["foo:bar", "foo\nbar"])(
        "keeps the complete field value %s",
        (value) => {
            expect(buildWhereClauses(`name:"${value}"`)[0]).toEqual({
                sql: "  REGEXP_LIKE(v.name, ?, 'i')",
                bindings: [value],
            })
        }
    )

    it.each(["unknown:road", "constructor:road", "name"])(
        "still searches %s as free text",
        (term) => {
            expect(buildWhereClauses(term)[0]).toEqual({
                sql: "  (REGEXP_LIKE(v.name, ?, 'i') OR REGEXP_LIKE(v.catalogPath, ?, 'i'))",
                bindings: [term, term],
            })
        }
    )

    it.each(["name:.*road", "-namespace:road", "name:road|deaths"])(
        "does not narrow regexes or exclusions through the index: %s",
        (query) => {
            expect(buildWhereClauses(query)).toHaveLength(1)
            expect(buildWhereClauses(query)[0].sql).toContain("REGEXP_LIKE(")
        }
    )

    it("binds both free-text predicates and the full-text expression", () => {
        expect(buildWhereClauses("road deaths road")).toEqual([
            ...["road", "deaths", "road"].map((term) => ({
                sql: "  (REGEXP_LIKE(v.name, ?, 'i') OR REGEXP_LIKE(v.catalogPath, ?, 'i'))",
                bindings: [term, term],
            })),
            {
                sql: "MATCH(v.name, v.catalogPath) AGAINST(? IN BOOLEAN MODE)",
                bindings: ["+road* +deaths*"],
            },
        ])
    })

    it("binds dates twice and dataset ids as numbers", () => {
        const clauses = buildWhereClauses(
            "before:2023 after:2020 dataset-id:12 -dataset-id:34"
        )
        expect(clauses.map((clause) => clause.bindings)).toEqual([
            ["2023", "2023"],
            ["2020", "2020"],
            [12],
            [34],
        ])
        expect(clauses[3].sql).toBe("NOT  d.id = ?")
    })

    it("matches field names whatever their case", () => {
        expect(buildWhereClauses("Dataset-ID:12 -NAME:Road")).toEqual(
            buildWhereClauses("dataset-id:12 -name:Road")
        )
        expect(unindexedSearchTerms("Is:private Dataset-ID:12")).toEqual([])
    })

    it("keeps exclusions out of full-text narrowing", () => {
        const clauses = buildWhereClauses("road -deaths")
        expect(clauses[1]).toEqual({
            sql: "NOT  (REGEXP_LIKE(v.name, ?, 'i') OR REGEXP_LIKE(v.catalogPath, ?, 'i'))",
            bindings: ["deaths", "deaths"],
        })
        expect(clauses[2].bindings).toEqual(["+road*"])
    })

    it("keeps boolean predicates and empty queries binding-free", () => {
        expect(buildWhereClauses("is:public -is:private")).toEqual([
            { sql: "  (NOT d.isPrivate)", bindings: [] },
            { sql: "NOT  d.isPrivate", bindings: [] },
        ])
        expect(buildWhereClauses("")).toEqual([])
    })
})

// Exercise query composition without a database; knexRaw is the execution boundary.
describe("search query bindings", () => {
    const trx = {} as db.KnexReadonlyTransaction

    beforeEach(() => {
        vi.spyOn(db, "knexRaw").mockResolvedValue([])
    })
    afterEach(() => vi.restoreAllMocks())

    it("binds flat pagination after search values, but not in the count", async () => {
        const raw = vi.mocked(db.knexRaw)
        raw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 42 }])

        const result = await searchVariables("road", 50, 100, trx)

        expect(result.numTotalRows).toBe(42)
        expect(raw.mock.calls[0][2]).toEqual([
            "road",
            "road",
            "+road*",
            50,
            100,
        ])
        expect(raw.mock.calls[0][1]).toContain("LIMIT ? OFFSET ?")
        expect(raw.mock.calls[1][2]).toEqual(["road", "road", "+road*"])
    })

    it.each(["road", ""])(
        "binds selected dataset ids and the preview limit for query '%s'",
        async (query) => {
            const raw = vi.mocked(db.knexRaw)
            raw.mockResolvedValueOnce([
                { id: 12, matchCount: 6, numTotalDatasets: 2, numTotalRows: 9 },
                { id: 34, matchCount: 3, numTotalDatasets: 2, numTotalRows: 9 },
            ]).mockResolvedValueOnce([])

            await searchVariablesGroupedByDataset(query, 10, 20, trx)

            const searchBindings = query ? ["road", "road", "+road*"] : []
            expect(raw.mock.calls[0][2]).toEqual([...searchBindings, 10, 20])
            expect(raw.mock.calls[1][2]).toEqual([...searchBindings, 12, 34, 5])
            expect(raw.mock.calls[1][1]).toContain("v.datasetId IN (?,?)")
            expect(raw.mock.calls[1][1]).toContain("WHERE rankInDataset <= ?")
        }
    )

    it("reuses grouped SQL with first-page bindings when past the last page", async () => {
        const raw = vi.mocked(db.knexRaw)
        raw.mockResolvedValueOnce([]).mockResolvedValueOnce([
            { numTotalDatasets: 2, numTotalRows: 9 },
        ])

        const result = await searchVariablesGroupedByDataset(
            "road",
            10,
            20,
            trx
        )

        expect(result).toMatchObject({
            datasets: [],
            numTotalDatasets: 2,
            numTotalRows: 9,
        })
        expect(raw.mock.calls[1][1]).toBe(raw.mock.calls[0][1])
        expect(raw.mock.calls[1][2]).toEqual(["road", "road", "+road*", 1, 0])
    })

    it("still reports regex errors from bound searches", async () => {
        vi.mocked(db.knexRaw).mockRejectedValueOnce(
            Object.assign(new Error("Invalid regex"), {
                code: "ER_REGEXP_RULE_SYNTAX",
                sqlMessage: "Invalid regex",
            })
        )

        expect(await searchVariables("name:[", 50, 0, trx)).toMatchObject({
            variables: [],
            numTotalRows: 0,
            regexError: "Invalid regex",
        })
    })
})
