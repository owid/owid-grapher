import { expect, it, describe } from "vitest"

import {
    hasSearchTerm,
    makeSearchFilter,
    parseSearchQuery,
    SearchField,
    searchWordsToHighlight,
    toggleSearchTerm,
} from "./searchFilter.js"

interface Dataset {
    name: string
    namespace: string
    tags: string[]
    charts: number
    isPrivate: boolean
    updatedAt: Date
}

const DATASETS: Dataset[] = [
    {
        name: "Measles cases",
        namespace: "who",
        tags: ["Global Health", "Vaccination"],
        charts: 12,
        isPrivate: false,
        updatedAt: new Date("2024-03-15T00:00:00Z"),
    },
    {
        name: "Life expectancy",
        namespace: "un",
        tags: ["Global Health"],
        charts: 3,
        isPrivate: true,
        updatedAt: new Date("2025-01-02T00:00:00Z"),
    },
    {
        name: "Energy mix",
        namespace: "ember",
        tags: [],
        charts: 0,
        isPrivate: false,
        updatedAt: new Date("2023-11-30T00:00:00Z"),
    },
]

const FIELDS: SearchField<Dataset>[] = [
    {
        name: "name",
        type: "string",
        description: "Dataset name",
        get: (d) => d.name,
    },
    {
        name: "namespace",
        type: "string",
        description: "Namespace",
        get: (d) => d.namespace,
    },
    {
        name: "tag",
        type: "string",
        description: "Tags",
        get: (d) => d.tags,
    },
    {
        name: "charts",
        type: "number",
        description: "Number of charts",
        get: (d) => d.charts,
    },
    {
        name: "private",
        type: "boolean",
        description: "Unpublished",
        get: (d) => d.isPrivate,
    },
    {
        name: "updated",
        type: "date",
        description: "Last updated",
        get: (d) => d.updatedAt,
    },
]

function search(query: string): string[] {
    return DATASETS.filter(makeSearchFilter(query, FIELDS)).map((d) => d.name)
}

describe(parseSearchQuery, () => {
    it("returns nothing for an empty query", () => {
        expect(parseSearchQuery("")).toEqual([])
        expect(parseSearchQuery(undefined)).toEqual([])
        expect(parseSearchQuery("   ")).toEqual([])
    })

    it("parses words, phrases, fields, exclusions and operators", () => {
        expect(
            parseSearchQuery(
                'measles "life expectancy" -energy tag:Health charts:>5'
            )
        ).toEqual([
            { value: "measles", exclude: false, raw: "measles" },
            {
                value: "life expectancy",
                exclude: false,
                raw: "life expectancy",
            },
            { value: "energy", exclude: true, raw: "-energy" },
            {
                field: "tag",
                value: "Health",
                exclude: false,
                raw: "tag:Health",
            },
            {
                field: "charts",
                operator: ">",
                value: "5",
                exclude: false,
                raw: "charts:>5",
            },
        ])
    })

    it("keeps a quoted field value together", () => {
        expect(parseSearchQuery('tag:"Global Health"')).toEqual([
            {
                field: "tag",
                value: "Global Health",
                exclude: false,
                raw: "tag:Global Health",
            },
        ])
    })
})

describe(makeSearchFilter, () => {
    it("matches everything when the query is empty", () => {
        expect(search("")).toHaveLength(3)
    })

    it("matches free text against the string fields", () => {
        expect(search("measles")).toEqual(["Measles cases"])
        expect(search("who")).toEqual(["Measles cases"])
        expect(search("vaccination")).toEqual(["Measles cases"])
    })

    it("requires every term to match", () => {
        expect(search("measles who")).toEqual(["Measles cases"])
        expect(search("measles ember")).toEqual([])
    })

    it("drops rows matching an exclusion", () => {
        expect(search("-measles")).toEqual(["Life expectancy", "Energy mix"])
        expect(search("-tag:Vaccination")).toEqual([
            "Life expectancy",
            "Energy mix",
        ])
    })

    it("restricts a term to one field", () => {
        expect(search("name:who")).toEqual([])
        expect(search("namespace:who")).toEqual(["Measles cases"])
    })

    it("matches a phrase, not its separate words", () => {
        expect(search('"measles cases"')).toEqual(["Measles cases"])
        expect(search('"cases measles"')).toEqual([])
    })

    it("matches any element of an array field", () => {
        expect(search('tag:"Global Health"')).toEqual([
            "Measles cases",
            "Life expectancy",
        ])
    })

    it("compares numbers", () => {
        expect(search("charts:>5")).toEqual(["Measles cases"])
        expect(search("charts:0")).toEqual(["Energy mix"])
        expect(search("charts:>=3")).toEqual([
            "Measles cases",
            "Life expectancy",
        ])
    })

    it("compares booleans", () => {
        expect(search("private:true")).toEqual(["Life expectancy"])
        expect(search("private:no")).toEqual(["Measles cases", "Energy mix"])
    })

    it("matches a date by prefix or comparison", () => {
        expect(search("updated:2024")).toEqual(["Measles cases"])
        expect(search("updated:2024-03")).toEqual(["Measles cases"])
        // a truncated date is a period: `>2024` means after all of 2024
        expect(search("updated:>2024")).toEqual(["Life expectancy"])
        expect(search("updated:>=2024")).toEqual([
            "Measles cases",
            "Life expectancy",
        ])
        expect(search("updated:<2024")).toEqual(["Energy mix"])
    })

    it("treats an unknown field as ordinary text", () => {
        // no field called "grapher", so this searches for the whole string
        expect(search("grapher:measles")).toEqual([])
        expect(search("http://example.com")).toEqual([])
        expect(search("who:")).toEqual(["Measles cases"])
    })

    it("ignores a number-only query against number fields", () => {
        // `12` is free text, so it doesn't match the dataset with 12 charts
        expect(search("12")).toEqual([])
    })
})

describe(searchWordsToHighlight, () => {
    it("returns the text of terms that appear in the results", () => {
        expect(
            searchWordsToHighlight(
                "measles namespace:who charts:>5 -energy",
                FIELDS
            ).map((word) => word.word)
        ).toEqual(["measles", "who"])
    })

    it("keeps an unknown field's raw text", () => {
        expect(
            searchWordsToHighlight("grapher:measles", FIELDS).map((w) => w.word)
        ).toEqual(["grapher:measles"])
    })
})

describe(toggleSearchTerm, () => {
    it("adds and removes a term without disturbing the rest", () => {
        expect(toggleSearchTerm("", "published:true", true)).toBe(
            "published:true"
        )
        expect(toggleSearchTerm("measles", "published:true", true)).toBe(
            "measles published:true"
        )
        expect(
            toggleSearchTerm("measles published:true", "published:true", false)
        ).toBe("measles")
    })

    it("leaves quoted phrases intact", () => {
        expect(
            toggleSearchTerm('tag:"Global Health"', "published:true", true)
        ).toBe('tag:"Global Health" published:true')
    })

    it("reports whether the term is set", () => {
        expect(hasSearchTerm("measles published:true", "published:true")).toBe(
            true
        )
        expect(hasSearchTerm("measles", "published:true")).toBe(false)
        expect(hasSearchTerm(undefined, "published:true")).toBe(false)
    })
})
