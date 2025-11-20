import { Suspense } from "react"
import { IncomePlot } from "./IncomePlot.tsx"
import { IncomePlotControlsRow } from "./IncomePlotControlsRow.tsx"
import { IncomePlotLegend } from "./IncomePlotLegend.tsx"

export const App = () => {
    return (
        <div>
            <IncomePlotLegend />
            <Suspense fallback={<div>Loading plot...</div>}>
                <IncomePlot />
            </Suspense>
            <IncomePlotControlsRow />
        </div>
    )
}
