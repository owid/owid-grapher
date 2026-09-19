/**
 * @vitest-environment happy-dom
 */

import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { SimpleMarkdownText } from "./SimpleMarkdownText.js"

function getColoredSpans(container: HTMLElement): NodeListOf<HTMLSpanElement> {
    return container.querySelectorAll("span[style]")
}

describe(SimpleMarkdownText, () => {
    // Ordinary markdown must remain ordinary text unless it uses the explicit
    // color syntax. This guards against accidentally styling unrelated text.
    it("leaves ordinary text unstyled", () => {
        const { container } = render(
            <SimpleMarkdownText text="Just plain text" />
        )

        expect(getColoredSpans(container)).toHaveLength(0)
        expect(container.textContent).toBe("Just plain text")
    })

    // Authors can color a text fragment with `{#hex: text}`. The parser must
    // accept the supported CSS hex lengths, preserve all surrounding content,
    // and continue to compose with regular markdown.
    describe("author color syntax", () => {
        it.each([
            { label: "three-digit", color: "#f00" },
            { label: "six-digit", color: "#ff0000" },
            { label: "eight-digit alpha", color: "#ff000080" },
        ])("renders a $label hex color", ({ color }) => {
            const { container } = render(
                <SimpleMarkdownText text={`{${color}: colored text}`} />
            )
            const [span] = getColoredSpans(container)

            expect(span.getAttribute("style")).toBe(`color: ${color};`)
            expect(span.textContent).toBe("colored text")
        })

        it("preserves text on both sides of a colored fragment", () => {
            const { container } = render(
                <SimpleMarkdownText text="Before {#00f: blue} after" />
            )

            expect(container.textContent).toBe("Before blue after")
        })

        it("renders multiple colored fragments independently", () => {
            const { container } = render(
                <SimpleMarkdownText text="{#f00: red} and {#00f: blue}" />
            )
            const spans = getColoredSpans(container)

            expect(spans).toHaveLength(2)
            expect(spans[0].getAttribute("style")).toBe("color: #f00;")
            expect(spans[0].textContent).toBe("red")
            expect(spans[1].getAttribute("style")).toBe("color: #00f;")
            expect(spans[1].textContent).toBe("blue")
        })

        it.each([
            { label: "a non-hex value", text: "{#xyz: not a color}" },
            { label: "a missing hash prefix", text: "{ff0000: no hash}" },
        ])("leaves $label untouched", ({ text }) => {
            const { container } = render(<SimpleMarkdownText text={text} />)

            expect(getColoredSpans(container)).toHaveLength(0)
            expect(container.textContent).toContain(text)
        })

        it("composes colored fragments with regular markdown", () => {
            const { container } = render(
                <SimpleMarkdownText text="**bold** and {#f00: red}" />
            )
            const [span] = getColoredSpans(container)

            expect(container.querySelector("strong")?.textContent).toBe("bold")
            expect(span.getAttribute("style")).toBe("color: #f00;")
            expect(span.textContent).toBe("red")
        })
    })
})

describe("SimpleMarkdownText dataTrackNote", () => {
    const text =
        "Read [the paper](https://example.org/paper) and this [term](#dod:gdp)."

    it("adds no tracking attribute by default", () => {
        const html = renderToStaticMarkup(<SimpleMarkdownText text={text} />)
        expect(html).not.toContain("data-track-note")
        expect(html).not.toContain('target="_blank"')
    })

    it("puts the note on every link", () => {
        const html = renderToStaticMarkup(
            <SimpleMarkdownText text={text} dataTrackNote="wysk_link" />
        )
        expect(html).toContain(
            '<a href="https://example.org/paper" data-track-note="wysk_link">'
        )
        expect(html).not.toContain('target="_blank"')
        expect(html).not.toContain("node=")
    })

    it("puts dodTrackNote on detail-on-demand spans only", () => {
        const html = renderToStaticMarkup(
            <SimpleMarkdownText text={text} dodTrackNote="wysk" />
        )
        expect(html).toContain('data-id="gdp"')
        expect(html.match(/data-dod-track-note="wysk"/g)).toHaveLength(1)
        expect(html).not.toContain('href="https://example.org/paper" data-dod')
    })

    it("leaves detail-on-demand terms as untracked spans", () => {
        const html = renderToStaticMarkup(
            <SimpleMarkdownText text={text} dataTrackNote="wysk_link" />
        )
        expect(html).toContain('class="dod-span" data-id="gdp"')
        expect(html.match(/data-track-note/g)).toHaveLength(1)
    })

    it("keeps openLinksInNewTab behaviour, with and without a note", () => {
        const plain = renderToStaticMarkup(
            <SimpleMarkdownText text={text} openLinksInNewTab />
        )
        expect(plain).toContain('target="_blank"')
        expect(plain).not.toContain("data-track-note")
        expect(plain).not.toContain("node=")
        const both = renderToStaticMarkup(
            <SimpleMarkdownText
                text={text}
                openLinksInNewTab
                dataTrackNote="wysk_link"
            />
        )
        expect(both).toContain('target="_blank"')
        expect(both).toContain('data-track-note="wysk_link"')
    })
})
