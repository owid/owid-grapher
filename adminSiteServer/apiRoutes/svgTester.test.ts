import { expect, it, describe } from "vitest"
import path from "path"
import { resolveSvgPath } from "./svgTester.js"
import { SVG_TESTER_REPO_PATH } from "../../settings/serverSettings.js"

const graphersReferences = path.resolve(
    SVG_TESTER_REPO_PATH,
    "graphers",
    "references"
)

describe(resolveSvgPath, () => {
    it("resolves a plain svg filename inside the suite directory", () => {
        expect(
            resolveSvgPath("graphers", "references", "life-expectancy_v42.svg")
        ).toBe(path.join(graphersReferences, "life-expectancy_v42.svg"))
    })

    it("resolves an mdim filename, which carries a query string", () => {
        const filename = "academic-performance?sex=both&subject=reading_v0.svg"
        expect(resolveSvgPath("mdims", "references", filename)).toBe(
            path.resolve(SVG_TESTER_REPO_PATH, "mdims", "references", filename)
        )
    })

    it("accepts both svg directories", () => {
        for (const kind of ["references", "differences"]) {
            expect(resolveSvgPath("graphers", kind, "a.svg")).not.toBeNull()
        }
    })

    it("rejects a directory that is not one of the two svg directories", () => {
        // `data/` is 3.8 GB of dumped inputs and must stay unreachable
        expect(resolveSvgPath("graphers", "data", "a.svg")).toBeNull()
        expect(resolveSvgPath("graphers", ".git", "a.svg")).toBeNull()
    })

    it("rejects an unknown suite", () => {
        expect(resolveSvgPath("explorers", "references", "a.svg")).toBeNull()
        expect(resolveSvgPath("..", "references", "a.svg")).toBeNull()
    })

    it("rejects traversal and anything that is not a bare svg basename", () => {
        const filenames = [
            "../../.git/config",
            "../references/a.svg",
            "sub/dir/a.svg",
            ".git",
            ".hidden.svg",
            "a.svg.json",
            "a.png",
            "",
        ]
        for (const filename of filenames) {
            expect(
                resolveSvgPath("graphers", "references", filename),
                filename
            ).toBeNull()
        }
    })
})
