import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { OwidGdocType } from "@ourworldindata/types"
import type { OwidGdocPageProps } from "@ourworldindata/utils"
import { OwidGdoc } from "./OwidGdoc.js"

const fragmentProps: OwidGdocPageProps = {
    id: "test-gdoc-id",
    slug: "test-fragment",
    content: {
        type: OwidGdocType.Fragment,
        title: "Test fragment",
        authors: [],
        body: [],
    },
    contentMd5: "test-content-md5",
    createdAt: new Date("2026-03-10T00:00:00Z"),
    updatedAt: null,
    published: true,
    publishedAt: null,
    breadcrumbs: [],
    manualBreadcrumbs: null,
    tags: [],
    linkedAuthors: [],
    linkedDocuments: {},
    linkedStaticViz: {},
    linkedCharts: {},
    linkedNarrativeCharts: {},
    linkedIndicators: {},
    linkedCallouts: {},
    imageMetadata: {},
    relatedCharts: [],
}

describe("OwidGdoc", () => {
    it("does not render admin links into the server HTML", () => {
        const html = renderToStaticMarkup(<OwidGdoc {...fragmentProps} />)

        expect(html).not.toContain('class="gdoc-admin-bar"')
        expect(html).not.toContain('id="gdoc-link"')
        expect(html).not.toContain('id="admin-link"')
    })
})
