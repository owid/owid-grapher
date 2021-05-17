import React, { useRef } from "react"
import ReactDOM from "react-dom"
import { Grapher } from "./core/Grapher"
import { GRAPHER_EMBEDDED_FIGURE_ATTR } from "./core/GrapherConstants"

export const ResetChart = ({
    getGrapherRegisteredWithFigure,
}: {
    getGrapherRegisteredWithFigure: (figure: HTMLElement) => Grapher | undefined
}) => {
    const onClick = () => {
        const grapherFigureInNextColumn = buttonRef.current
            ?.closest(".wp-block-column")
            ?.nextElementSibling?.querySelector(
                `[${GRAPHER_EMBEDDED_FIGURE_ATTR}]`
            ) as HTMLElement

        if (!grapherFigureInNextColumn) return

        const grapher = getGrapherRegisteredWithFigure(
            grapherFigureInNextColumn
        )

        grapher?.renderAnnotation({
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
    getGrapherRegisteredWithFigure: (figure: HTMLElement) => Grapher | undefined
) {
    const resetButtons = document.querySelectorAll("button.reset-chart")

    resetButtons.forEach((resetButton) => {
        ReactDOM.hydrate(
            <ResetChart
                getGrapherRegisteredWithFigure={getGrapherRegisteredWithFigure}
            />,
            resetButton.parentElement
        )
    })
}
