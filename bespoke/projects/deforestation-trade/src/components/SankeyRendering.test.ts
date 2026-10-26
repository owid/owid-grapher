import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { Sankey } from "../../../../components/Sankey/Sankey.js"

describe("parallel link rendering", () => {
    const nodes = [
        { id: "source", label: "Source" },
        { id: "target", label: "Target" },
    ]
    const links = [
        { source: "source", target: "target", value: 1, category: "small" },
        { source: "source", target: "target", value: 9, category: "large" },
    ]

    it("preserves each link's color and low-volume fading by default", () => {
        const markup = renderToStaticMarkup(
            createElement(Sankey, {
                nodes,
                links,
                width: 600,
                height: 400,
                totalFlowVolume: 10,
                linkLowVolumeThreshold: 0.2,
                linkColor: (link) =>
                    link.category === "small" ? "red" : "blue",
            })
        )

        const paths = markup.match(/<path\b[^>]*>/g) ?? []
        expect(paths).toHaveLength(2)
        expect(paths[0]).toContain('fill="red"')
        expect(paths[0]).toContain("sankey__link--low-volume")
        expect(paths[1]).toContain('fill="blue"')
        expect(paths[1]).not.toContain("sankey__link--low-volume")
    })

    it("merges parallel links into a seamless ribbon when enabled", () => {
        const markup = renderToStaticMarkup(
            createElement(Sankey, {
                nodes,
                links,
                width: 600,
                height: 400,
                mergeParallelLinks: true,
                linkColor: () => "teal",
            })
        )

        const paths = markup.match(/<path\b[^>]*>/g) ?? []
        expect(paths).toHaveLength(1)
        expect(paths[0]).toContain('fill="teal"')
    })
})
