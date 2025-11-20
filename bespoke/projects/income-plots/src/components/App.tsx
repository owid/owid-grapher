import { Suspense } from "react"
import { IncomePlot } from "./IncomePlot.tsx"
import { IncomePlotControlsRow } from "./IncomePlotControlsRow.tsx"
import { IncomePlotLegend } from "./IncomePlotLegend.tsx"
import { PLOT_HEIGHT, PLOT_WIDTH } from "../utils/incomePlotConstants.ts"

export const App = () => {
    return (
        <div>
            <IncomePlotLegend />
            <div
                style={{
                    width: PLOT_WIDTH,
                    aspectRatio: PLOT_WIDTH / PLOT_HEIGHT,
                    maxWidth: "100%",
                    margin: "auto",
                }}
            >
                <Suspense fallback={<>Loading...</>}>
                    <IncomePlot />
                </Suspense>
            </div>
            <IncomePlotControlsRow />
        </div>
    )
}
