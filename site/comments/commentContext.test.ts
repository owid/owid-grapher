import { expect, it, describe } from "vitest"

import {
    CommentMultiDimDimension,
    describeViewState,
    hrefForViewState,
    viewStateKey,
} from "./commentContext.js"

const dimensions: CommentMultiDimDimension[] = [
    {
        slug: "level",
        name: "Level of education",
        choices: [
            { slug: "primary", name: "Primary school" },
            { slug: "secondary", name: "Secondary school" },
        ],
    },
    {
        slug: "gender",
        name: "Gender",
        choices: [
            { slug: "girls", name: "Girls" },
            { slug: "boys", name: "Boys" },
        ],
    },
]

describe(viewStateKey, () => {
    it("keys by dimension order, not by the order the view was written in", () => {
        expect(
            viewStateKey({ gender: "girls", level: "primary" }, dimensions)
        ).toEqual(viewStateKey({ level: "primary", gender: "girls" }, dimensions))
    })

    it("distinguishes different views", () => {
        expect(
            viewStateKey({ level: "primary", gender: "girls" }, dimensions)
        ).not.toEqual(
            viewStateKey({ level: "primary", gender: "boys" }, dimensions)
        )
    })

    it("keeps dimensions the multi-dim no longer has, so old views stay distinct", () => {
        expect(viewStateKey({ level: "primary", dropped: "a" }, dimensions)).not.toEqual(
            viewStateKey({ level: "primary", dropped: "b" }, dimensions)
        )
    })
})

describe(describeViewState, () => {
    it("names a view with the choice names the page shows", () => {
        expect(
            describeViewState({ level: "primary", gender: "girls" }, dimensions)
        ).toBe("Primary school · Girls")
    })

    it("falls back to the raw slug for a choice that no longer exists", () => {
        expect(describeViewState({ level: "tertiary" }, dimensions)).toBe(
            "tertiary"
        )
    })

    it("skips dimensions the view doesn't pin down", () => {
        expect(describeViewState({ gender: "boys" }, dimensions)).toBe("Boys")
    })
})

describe(hrefForViewState, () => {
    const url = { pathname: "/grapher/school-enrolment", search: "" }

    it("writes every dimension of the target view into the url", () => {
        expect(
            hrefForViewState(
                { level: "secondary", gender: "boys" },
                dimensions,
                url
            )
        ).toBe("/grapher/school-enrolment?level=secondary&gender=boys")
    })

    it("replaces the dimensions already in the url", () => {
        expect(
            hrefForViewState({ level: "secondary", gender: "boys" }, dimensions, {
                ...url,
                search: "?level=primary&gender=girls",
            })
        ).toBe("/grapher/school-enrolment?level=secondary&gender=boys")
    })

    it("carries over params that aren't dimensions", () => {
        const href = hrefForViewState(
            { level: "secondary", gender: "boys" },
            dimensions,
            { ...url, search: "?tab=map&country=~ESP" }
        )
        const params = new URLSearchParams(href.split("?")[1])
        expect(params.get("tab")).toBe("map")
        expect(params.get("country")).toBe("~ESP")
        expect(params.get("level")).toBe("secondary")
    })

    it("drops a dimension the target view doesn't pin down", () => {
        expect(
            hrefForViewState({ level: "secondary" }, dimensions, {
                ...url,
                search: "?level=primary&gender=girls",
            })
        ).toBe("/grapher/school-enrolment?level=secondary")
    })
})
