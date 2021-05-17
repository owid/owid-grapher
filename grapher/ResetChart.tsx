import React, { useRef } from "react"
import ReactDOM from "react-dom"
import { RenderInteractiveFigure } from "../clientUtils/owidTypes"
import { GRAPHER_EMBEDDED_FIGURE_ATTR } from "./core/GrapherConstants"

export const ResetChart = ({
    renderInteractiveFigure,
}: {
    renderInteractiveFigure: RenderInteractiveFigure
}) => {
    const onClick = () => {
        const grapherFigureInNextColumn = buttonRef.current
            ?.closest(".wp-block-column")
            ?.nextElementSibling?.querySelector(
                `[${GRAPHER_EMBEDDED_FIGURE_ATTR}]`
            ) as HTMLElement

        if (!grapherFigureInNextColumn) return

        renderInteractiveFigure(grapherFigureInNextColumn, {
            entityId: 137,
            value: 35.4,
            year: 2015,
        })
    }
    const buttonRef = useRef<HTMLButtonElement>(null)

    return (
        <button ref={buttonRef} onClick={onClick} className="reset-chart">
            Reset
        </button>
    )
}

export function runResetChart(
    renderInteractiveFigure: RenderInteractiveFigure
) {
    const resetButtons = document.querySelectorAll("button.reset-chart")

    resetButtons.forEach((resetButton) => {
        ReactDOM.hydrate(
            <ResetChart renderInteractiveFigure={renderInteractiveFigure} />,
            resetButton.parentElement
        )
    })
}
