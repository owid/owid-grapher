/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { SimpleMarkdownText } from "./SimpleMarkdownText.js"

describe(SimpleMarkdownText, () => {
    it("renders text", () => {
        const { container } = render(
            <SimpleMarkdownText text="Just plain text" />
        )
        const span = container.querySelector("span[style]")
        expect(span).toBeNull()
        expect(container.textContent).toBe("Just plain text")
    })
})

describe("SimpleMarkdownText color syntax", () => {
    it("renders {#hex: text} as a colored span", () => {
        const { container } = render(
            <SimpleMarkdownText text="Normal {#f00: red text} normal" />
        )
        const span = container.querySelector("span[style]")
        expect(span).toBeTruthy()
        expect(span?.getAttribute("style")).toBe("color: #f00;")
        expect(span?.textContent).toBe("red text")
    })

    it("preserves surrounding text", () => {
        const { container } = render(
            <SimpleMarkdownText text="Before {#00f: blue} after" />
        )
        const p = container.querySelector("p")
        expect(p?.textContent).toBe("Before blue after")
    })

    it("handles multiple color spans in the same text", () => {
        const { container } = render(
            <SimpleMarkdownText text="{#f00: red} and {#00f: blue}" />
        )
        const spans = container.querySelectorAll("span[style]")
        expect(spans).toHaveLength(2)
        expect(spans[0].getAttribute("style")).toBe("color: #f00;")
        expect(spans[0].textContent).toBe("red")
        expect(spans[1].getAttribute("style")).toBe("color: #00f;")
        expect(spans[1].textContent).toBe("blue")
    })

    it("supports 6-digit hex codes", () => {
        const { container } = render(
            <SimpleMarkdownText text="{#ff0000: red text}" />
        )
        const span = container.querySelector("span[style]")
        expect(span?.getAttribute("style")).toBe("color: #ff0000;")
    })

    it("supports 8-digit hex codes (with alpha)", () => {
        const { container } = render(
            <SimpleMarkdownText text="{#ff000080: semi-transparent}" />
        )
        const span = container.querySelector("span[style]")
        expect(span?.getAttribute("style")).toBe("color: #ff000080;")
    })

    it("does not match invalid hex codes", () => {
        const { container } = render(
            <SimpleMarkdownText text="{#xyz: not a color}" />
        )
        const span = container.querySelector("span[style]")
        expect(span).toBeNull()
        expect(container.textContent).toContain("{#xyz: not a color}")
    })

    it("does not match without the # prefix", () => {
        const { container } = render(
            <SimpleMarkdownText text="{ff0000: no hash}" />
        )
        const span = container.querySelector("span[style]")
        expect(span).toBeNull()
    })

    it("handles color syntax alongside regular markdown", () => {
        const { container } = render(
            <SimpleMarkdownText text="**bold** and {#f00: red}" />
        )
        const strong = container.querySelector("strong")
        expect(strong?.textContent).toBe("bold")
        const span = container.querySelector("span[style]")
        expect(span?.getAttribute("style")).toBe("color: #f00;")
        expect(span?.textContent).toBe("red")
    })

    it("handles color syntax at the start of text", () => {
        const { container } = render(
            <SimpleMarkdownText text="{#f00: starts red} then normal" />
        )
        const span = container.querySelector("span[style]")
        expect(span?.textContent).toBe("starts red")
        expect(container.textContent).toContain("then normal")
    })

    it("handles color syntax at the end of text", () => {
        const { container } = render(
            <SimpleMarkdownText text="Normal then {#f00: ends red}" />
        )
        const span = container.querySelector("span[style]")
        expect(span?.textContent).toBe("ends red")
        expect(container.textContent).toContain("Normal then")
    })
})
