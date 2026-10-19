import { describe, expect, it } from "vitest"
import { faStar } from "@fortawesome/free-solid-svg-icons"
import { ActionButtons, ActionButtonsManager } from "./ActionButtons"

const hostActionButton = {
    label: "Ask AI",
    icon: faStar,
    onClick: (): void => undefined,
}

// Download, Share and Enter full-screen, as on a data page. Layout never
// rasterizes, so the share menu's export hook is a stub.
const baseManager: ActionButtonsManager = {
    hideExploreTheDataButton: true,
    rasterize: () => Promise.reject(new Error("not used in layout")),
}

const layout = (
    manager: ActionButtonsManager,
    maxWidth: number
): ActionButtons => new ActionButtons({ manager, maxWidth })

describe("action row with a host button", () => {
    const withHost = { ...baseManager, hostActionButton }
    const allLabels = layout(withHost, 10_000).width
    const iconsOnly = layout(withHost, 0).width

    it("labels every button when there is room", () => {
        expect(layout(withHost, allLabels).showButtonLabels).toBe(true)
    })

    it("drops only the full-screen label when that is enough", () => {
        const row = layout(withHost, allLabels - 1)
        expect(row.showButtonLabels).toBe(true)
        expect(row.width).toBeLessThan(allLabels)
        expect(row.width).toBeGreaterThan(iconsOnly)
    })

    it("goes icon-only when even that doesn't fit", () => {
        const row = layout(withHost, iconsOnly + 1)
        expect(row.showButtonLabels).toBe(false)
        expect(row.width).toBe(iconsOnly)
    })
})

describe("action row without a host button", () => {
    it("keeps the all-or-nothing rule", () => {
        const allLabels = layout(baseManager, 10_000).width
        const row = layout(baseManager, allLabels - 1)
        expect(row.showButtonLabels).toBe(false)
        expect(row.width).toBe(layout(baseManager, 0).width)
    })
})
