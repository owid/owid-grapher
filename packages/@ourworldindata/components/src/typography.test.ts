import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

describe("Typography font features", () => {
    it("should include lining numerals in default font features", () => {
        // Read the typography SCSS file
        const typographyPath = path.join(__dirname, "styles/typography.scss")
        const typographyContent = fs.readFileSync(typographyPath, "utf-8")

        // Check that default font features includes lnum
        expect(typographyContent).toContain('"lnum"')
        expect(typographyContent).toContain(
            '$default-font-features: "liga", "kern", "calt", "lnum";'
        )
    })

    it("should apply lining numerals to elements using default font features", () => {
        // Read the typography SCSS file
        const typographyPath = path.join(__dirname, "styles/typography.scss")
        const typographyContent = fs.readFileSync(typographyPath, "utf-8")

        // Check that body uses default font features (which now includes lnum)
        expect(typographyContent).toContain("font-feature-settings: $default-font-features;")
    })
})