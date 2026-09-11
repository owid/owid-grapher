import { describe, expect, it } from "vitest"
import {
    GDOC_TEMPLATE_CONTENT_INTERFACES,
    OwidGdocType,
} from "@ourworldindata/types"
import { archieToEnriched } from "./archieToEnriched.js"
import { gdocFromJSON } from "./GdocFactory.js"
import { GdocProfile, instantiateProfileForEntity } from "./GdocProfile.js"

/**
 * The writing reference classifies every content key as authored or computed
 * by hand (the *_CONTENT_KEY_KINDS tables in Gdoc.ts). `satisfies` keeps the
 * tables complete; this keeps them truthful, per document type:
 *
 * - every key tagged "computed" is one enrichment writes to a document whose
 *   source never mentions it — so an authored key can't hide behind the tag;
 * - every key enrichment writes is classified at all;
 * - the authored keys that enrichment fills in when the author omits them
 *   are named below, so a new one is a conscious decision, not drift.
 */

// Written in every minimal source. `refs` is materialised by the parser for
// every type (inline {ref} bookkeeping), whether or not the source has any.
const SOURCE_KEYS = ["title", "type", "authors", "body", "refs"]

// Authored keys that enrichment writes when the source omits them — the
// parser generates a default (a sticky nav from the headings). They are
// authored — an author's value is respected — and so stay tagged as such.
const AUTHORED_WITH_DEFAULTS: Partial<Record<OwidGdocType, string[]>> = {
    [OwidGdocType.Article]: ["sticky-nav"],
    [OwidGdocType.TopicPage]: ["sticky-nav"],
    [OwidGdocType.LinearTopicPage]: ["sticky-nav"],
    [OwidGdocType.Fragment]: ["sticky-nav"],
}

// Keys enrichment writes that no content interface declares. `citation` is
// dead — nothing reads it — and is removed in owid/owid-grapher#7262; once
// that lands this test fails on the entry, and the entry goes.
const KNOWN_UNDECLARED: Partial<Record<OwidGdocType, string[]>> = {
    [OwidGdocType.Article]: ["citation"],
    [OwidGdocType.TopicPage]: ["citation"],
    [OwidGdocType.LinearTopicPage]: ["citation"],
    [OwidGdocType.Fragment]: ["citation"],
}

const PROFILE_ENTITY = { name: "World", code: "OWID_WRL" }

function keysTagged(
    type: OwidGdocType,
    kind: "authored" | "computed"
): string[] {
    return Object.entries(GDOC_TEMPLATE_CONTENT_INTERFACES[type].keyKinds)
        .filter(([, keyKind]) => keyKind === kind)
        .map(([key]) => key)
        .sort()
}

/** Keys the pipeline adds to a minimal document of the type */
async function keysAddedByEnrichment(type: OwidGdocType): Promise<string[]> {
    // Some computed keys only appear when their authored source is present:
    // a profile's toc is generated at instantiation and only when asked for,
    // and parsedFaqs only from authored faqs.
    const extraSource: Record<string, string> =
        type === OwidGdocType.Profile
            ? { "sidebar-toc": "true", scope: "World" }
            : GDOC_TEMPLATE_CONTENT_INTERFACES[type].interfaceName ===
                "OwidGdocPostContent"
              ? { faqs: "\n[.+content]\nAnswer\n[]\nid: q1\n" }
              : {}
    const sourceKeys = [...SOURCE_KEYS, ...Object.keys(extraSource)]
    const extra = Object.entries(extraSource)
        .map(([key, value]) =>
            value.startsWith("\n")
                ? `[.${key}]${value}[]\n`
                : `${key}: ${value}\n`
        )
        .join("")
    const source = `title: T\ntype: ${type}\nauthors: Jane Doe (Editor)\n${extra}[.refs]\n[]\n[+body]\nHello\n[]\n`
    const gdoc = gdocFromJSON({ id: "key-kinds-test", content: { type } })
    let content: object = archieToEnriched(source, gdoc._enrichSubclassContent)
    if (gdoc instanceof GdocProfile) {
        gdoc.content = content as GdocProfile["content"]
        content = (await instantiateProfileForEntity(gdoc, PROFILE_ENTITY))
            .content
    }
    return Object.keys(content)
        .filter((key) => !sourceKeys.includes(key))
        .sort()
}

describe("gdoc content key kinds", () => {
    const types = Object.keys(
        GDOC_TEMPLATE_CONTENT_INTERFACES
    ) as OwidGdocType[]

    for (const type of types) {
        it(`${type}: the keys tagged computed are exactly what enrichment adds`, async () => {
            const undeclared = KNOWN_UNDECLARED[type] ?? []
            const allAdded = await keysAddedByEnrichment(type)
            for (const key of undeclared) expect(allAdded).toContain(key)
            const added = allAdded.filter((key) => !undeclared.includes(key))
            const computed = keysTagged(type, "computed")
            const classified = [...computed, ...keysTagged(type, "authored")]

            expect(added.filter((key) => !classified.includes(key))).toEqual([])
            expect(added.filter((key) => computed.includes(key))).toEqual(
                computed
            )
            expect(added.filter((key) => !computed.includes(key))).toEqual(
                [...(AUTHORED_WITH_DEFAULTS[type] ?? [])].sort()
            )
        })
    }
})
