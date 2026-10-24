/** @vitest-environment happy-dom */

import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { GrapherTabName } from "@ourworldindata/types"
import { renderToStaticMarkup } from "react-dom/server"
import { ContentSwitchers, ContentSwitchersManager } from "./ContentSwitchers"

const tabs: GrapherTabName[] = [
    "LineChart",
    "DiscreteBar",
    "StackedArea",
    "WorldMap",
    "Table",
]
let availableWidth = 600
let tabWidths = [100, 100, 100, 100, 100]
const resizeCallbacks: ResizeObserverCallback[] = []

beforeEach(() => {
    availableWidth = 600
    tabWidths = [100, 100, 100, 100, 100]
    vi.stubGlobal(
        "ResizeObserver",
        class {
            constructor(callback: ResizeObserverCallback) {
                resizeCallbacks.push(callback)
            }
            observe(): void {
                return
            }
            disconnect(): void {
                return
            }
        }
    )
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
        function (this: HTMLElement): DOMRect {
            const index = tabs.indexOf(this.dataset.tab as GrapherTabName)
            const width =
                index >= 0
                    ? tabWidths[index]
                    : this.classList.contains(
                            "ContentSwitchers__OverflowMenuButton"
                        )
                      ? 40
                      : availableWidth
            return { width, height: 32 } as DOMRect
        }
    )
})

afterEach(() => {
    cleanup()
    resizeCallbacks.length = 0
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

function manager(
    activeTab: GrapherTabName = "LineChart"
): ContentSwitchersManager {
    return {
        availableTabs: tabs,
        activeTab,
        setTab: vi.fn(),
        onTabChange: vi.fn(),
    }
}

function resize(width: number): void {
    availableWidth = width
    act(() =>
        resizeCallbacks.forEach((callback) =>
            callback([], {} as ResizeObserver)
        )
    )
}

it("shows every chart tab when there is room", () => {
    const { getAllByRole, queryByRole } = render(
        <ContentSwitchers manager={manager()} />
    )
    expect(getAllByRole("tab")).toHaveLength(5)
    expect(queryByRole("button", { name: "Show more chart types" })).toBeNull()
})

it("adds and removes overflow as the available space changes", () => {
    const { getAllByRole, getByRole, queryByRole } = render(
        <ContentSwitchers manager={manager()} />
    )
    resize(444)
    expect(getAllByRole("tab")).toHaveLength(4)
    expect(
        getByRole("button", { name: "Show more chart types" })
    ).toHaveTextContent("1")
    resize(343)
    expect(getAllByRole("tab")).toHaveLength(2)
    expect(
        getByRole("button", { name: "Show more chart types" })
    ).toHaveTextContent("3")
    resize(504)
    expect(getAllByRole("tab")).toHaveLength(5)
    expect(queryByRole("button", { name: "Show more chart types" })).toBeNull()
})

it("accounts for the width of an active tab promoted from the overflow", () => {
    availableWidth = 344
    tabWidths = [100, 100, 100, 100, 160]
    const { getAllByRole, getByRole } = render(
        <ContentSwitchers manager={manager("Table")} />
    )
    expect(getAllByRole("tab")).toHaveLength(2)
    expect(getByRole("tab", { name: "Table" })).toHaveAttribute("data-selected")
    expect(
        getByRole("button", { name: "Show more chart types" })
    ).toHaveTextContent("3")
})

it("keeps the active tab accessible even in a very narrow container", () => {
    availableWidth = 80
    const { getAllByRole, getByRole } = render(
        <ContentSwitchers manager={manager("Table")} />
    )
    expect(getAllByRole("tab")).toHaveLength(1)
    expect(getByRole("tab", { name: "Table" })).toHaveAttribute("data-selected")
    expect(
        getByRole("button", { name: "Show more chart types" })
    ).toHaveTextContent("4")
})

it("preserves the existing three-tab layout before browser measurement", () => {
    const markup = renderToStaticMarkup(
        <ContentSwitchers manager={manager("Table")} />
    )
    const document = new DOMParser().parseFromString(markup, "text/html")
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(3)
    expect(
        document.querySelector('[role="tab"][data-selected]')
    ).toHaveAttribute("aria-label", "Table")
})
