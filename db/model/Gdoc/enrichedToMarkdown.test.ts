import { describe, it, expect } from "vitest"
import { stripCustomMarkdownComponents } from "./enrichedToMarkdown.js"

describe("stripCustomMarkdownComponents", () => {
    describe("single-line components", () => {
        it("should strip single-line components", () => {
            const content = `Some text\n<Image filename="test.png" alt="Test"/>\nMore text`
            const result = stripCustomMarkdownComponents(content)
            expect(result).toBe("Some text\n\nMore text")
        })

        it("should strip multiple single-line components", () => {
            const content = `Text before
<Image filename="img1.png" alt="First"/>
Some middle text
<Chart url="https://example.com"/>
Text after`
            const result = stripCustomMarkdownComponents(content)
            expect(result).toBe("Text before\n\nSome middle text\n\nText after")
        })
    })

    describe("multiline components", () => {
        it("should strip multiline components", () => {
            const content = `Before text
<AdditionalCharts>
* Chart 1
* Chart 2
</AdditionalCharts>
After text`
            const result = stripCustomMarkdownComponents(content)
            expect(result).toBe("Before text\n\nAfter text")
        })

        it("should handle multiple multiline components", () => {
            const content = `<AdditionalCharts>
* Chart A
</AdditionalCharts>
Middle text
<KeyIndicatorCollection>
Content here
</KeyIndicatorCollection>`
            const result = stripCustomMarkdownComponents(content)
            expect(result).toBe("\nMiddle text\n")
        })
    })

    describe("mixed components", () => {
        it("should strip both single-line and multiline components", () => {
            const content = `# Heading

Some text here

<Image filename="test.png" alt="Test"/>

More content

<AdditionalCharts>
* Chart 1
* Chart 2
</AdditionalCharts>

<Video url="https://example.com/video.mp4"/>

Final text`
            const result = stripCustomMarkdownComponents(content)
            expect(result).toBe(`# Heading

Some text here



More content





Final text`)
        })
    })
})
