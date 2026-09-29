/**
 * @vitest-environment happy-dom
 */

import { expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { renderToString } from "react-dom/server"
import { hydrateRoot } from "react-dom/client"
import { RefDictionary, SpanRef } from "@ourworldindata/types"
import { DocumentContext } from "./gdocs/DocumentContext.js"
import SpanElements from "./gdocs/components/SpanElements.js"

const reference: SpanRef = {
    spanType: "span-ref",
    url: "#note-1",
    children: [
        {
            spanType: "span-superscript",
            children: [{ spanType: "span-simple-text", text: "1" }],
        },
    ],
}

const footnotes: RefDictionary = {
    source: {
        id: "source",
        index: 0,
        parseErrors: [],
        content: [
            {
                type: "text",
                parseErrors: [],
                value: [
                    { spanType: "span-simple-text", text: "Source with " },
                    {
                        spanType: "span-bold",
                        children: [
                            {
                                spanType: "span-simple-text",
                                text: "formatting",
                            },
                        ],
                    },
                ],
            },
        ],
    },
}

it.each(["mouseEnter", "focus", "click"] as const)(
    "opens a footnote on %s after hydrating the document tree",
    async (event) => {
        const tree = (
            <DocumentContext.Provider
                value={{ isPreviewing: false, footnotes }}
            >
                <SpanElements spans={[reference]} />
            </DocumentContext.Provider>
        )
        const container = document.createElement("div")
        container.innerHTML = renderToString(tree)
        document.body.appendChild(container)
        const serverReference = container.querySelector("a")!
        expect(serverReference.getAttribute("href")).toBe("#note-1")
        expect(serverReference.querySelector("sup")?.textContent).toBe("1")
        const onRecoverableError = vi.fn()
        let root: ReturnType<typeof hydrateRoot> | undefined
        try {
            await act(async () => {
                root = hydrateRoot(container, tree, { onRecoverableError })
            })
            expect(container.querySelector("a")).toBe(serverReference)
            fireEvent[event](serverReference)
            await waitFor(() => {
                expect(screen.getByRole("tooltip")).toHaveTextContent(
                    "Source with formatting"
                )
            })
            expect(
                screen.getByRole("tooltip").querySelector("strong")
            ).toHaveTextContent("formatting")
            expect(onRecoverableError).not.toHaveBeenCalled()
        } finally {
            await act(async () => root?.unmount())
            container.remove()
        }
    }
)

it("keeps a plain endnote link when the definition is unavailable", () => {
    render(<SpanElements spans={[reference]} />)
    expect(screen.getByRole("link", { name: "1" })).toHaveAttribute(
        "href",
        "#note-1"
    )
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
})

it("omits footnote links when links are disabled", () => {
    render(
        <DocumentContext.Provider value={{ isPreviewing: false, footnotes }}>
            <SpanElements spans={[reference]} shouldRenderLinks={false} />
        </DocumentContext.Provider>
    )
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
})
