/*
 * What "validated" means for a sidecar example: the guarantees the spec
 * lists, one malformed example per advertised construct.
 *
 * Run just this file:
 *     yarn test run --reporter dot devTools/gdocs/exampleValidation.test.ts
 */

import { describe, expect, test } from "vitest"
import {
    validateBodyExample,
    validateDocumentExample,
} from "./exampleValidation.js"

const doc = (frontMatter: string, body = "A paragraph."): string =>
    frontMatter + "\n[+body]\n" + body + "\n[]\n"

describe(validateBodyExample, () => {
    test("accepts a parsing block", () => {
        expect(
            validateBodyExample("{.callout}\ntitle: Hi\n[.+text]\nBody\n[]\n{}")
        ).toEqual([])
    })

    test("rejects a block the parser drops silently", () => {
        expect(validateBodyExample("[socials]\n[]")).toEqual([
            expect.stringContaining("parsed to zero body blocks"),
        ])
    })

    test("rejects a block with a parse error", () => {
        expect(validateBodyExample("{.chart}\n{}")).toEqual([
            expect.stringContaining("[chart]"),
        ])
    })
})

describe(validateDocumentExample, () => {
    test("accepts a minimal article with ID-based refs", () => {
        const archie = doc(
            "title: Refs\ntype: article\n[.refs]\nid: a\n[.+content]\nA source.\n[]\n[]",
            "A claim.{ref}a{/ref}"
        )
        expect(validateDocumentExample(archie)).toEqual([])
    })

    test("rejects a missing or unknown type", () => {
        expect(validateDocumentExample(doc("title: X"))).toEqual([
            expect.stringContaining("no known type"),
        ])
        expect(validateDocumentExample(doc("title: X\ntype: essay"))).toEqual([
            expect.stringContaining('unknown type "essay"'),
        ])
    })

    // The "no documented template" branch in validateDocumentExample is now
    // unreachable through a real OwidGdocType: every type has a template
    // sidecar (see the tightened `satisfies Record<OwidGdocType, …>` on
    // GDOC_TEMPLATE_CONTENT_INTERFACES in Gdoc.ts and the structural test
    // in sidecars.test.ts), so there is no longer a value that passes the
    // "known type" check above but fails the template lookup. The guard
    // stays in exampleValidation.ts as defense-in-depth for a future type
    // added to the enum before its template lands.

    test("rejects an unknown front-matter key", () => {
        expect(
            validateDocumentExample(doc("title: X\ntype: article\nsubtitel: y"))
        ).toEqual([
            expect.stringContaining('unknown front-matter key "subtitel"'),
        ])
    })

    test("rejects a ref that is cited but never defined", () => {
        expect(
            validateDocumentExample(
                doc("title: X\ntype: article", "Claim{ref}nope{/ref}")
            )
        ).toEqual([expect.stringContaining("refs")])
    })

    test("rejects a malformed sticky-nav entry", () => {
        const archie = doc(
            "title: X\ntype: topic-page\n[.sticky-nav]\ntext: Intro\n[]"
        )
        expect(validateDocumentExample(archie)).toEqual([
            expect.stringContaining("sticky-nav[0]"),
        ])
    })

    test("accepts a well-formed sticky-nav", () => {
        const archie = doc(
            "title: X\ntype: topic-page\n[.sticky-nav]\ntarget: #introduction\ntext: Intro\n[]"
        )
        expect(validateDocumentExample(archie)).toEqual([])
    })

    test("rejects a deprecation notice carrying a parse error", () => {
        // A non-text block in the notice is turned into an errored text block
        const archie = doc(
            "title: X\ntype: article\n[+deprecation-notice]\n{.chart}\nurl: https://ourworldindata.org/grapher/x\n{}\n[]"
        )
        expect(validateDocumentExample(archie)).toEqual([
            expect.stringContaining("deprecation-notice"),
        ])
    })

    test("rejects an empty body", () => {
        expect(validateDocumentExample("title: X\ntype: article\n")).toEqual([
            expect.stringContaining("no body"),
        ])
    })
})
