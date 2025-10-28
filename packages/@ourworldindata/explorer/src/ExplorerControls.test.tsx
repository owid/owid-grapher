/**
 * @vitest-environment happy-dom
 */

import { expect, it, describe } from "vitest"
import { render, screen } from "@testing-library/react"
import { ExplorerControlType } from "./ExplorerConstants.js"
import { ExplorerControlPanel } from "./ExplorerControls.js"

describe(ExplorerControlPanel, () => {
    const options = [
        {
            label: "Paper",
            available: true,
            value: "paper",
        },
        {
            label: "Plastic",
            available: true,
            value: "plastic",
        },
    ]

    const { container } = render(
        <ExplorerControlPanel
            choice={{
                title: "Some decision",
                value: "",
                options,
                type: ExplorerControlType.Radio,
            }}
            explorerSlug="explorer_slug"
            isMobile={false}
        />
    )

    it("renders options", () => {
        expect(screen.getAllByRole("radio")).toHaveLength(2)
        expect(container.querySelectorAll(`.AvailableOption`).length).toEqual(2)
    })
})
