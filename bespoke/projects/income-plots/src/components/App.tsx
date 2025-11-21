import { Suspense } from "react"
import { IncomePlot } from "./IncomePlot.tsx"
import { IncomePlotControlsRowBottom } from "./IncomePlotControlsRow.tsx"
import { IncomePlotLegend } from "./IncomePlotLegend.tsx"
import { PLOT_HEIGHT, PLOT_WIDTH } from "../utils/incomePlotConstants.ts"
import { useAtomValue } from "jotai"
import { atomCurrentYear } from "../store.ts"

export const App = () => {
    const currentYear = useAtomValue(atomCurrentYear)
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
                    <IncomePlot key={currentYear} />
                </Suspense>
            </div>
            <IncomePlotControlsRowBottom />
        </div>
    )
}
