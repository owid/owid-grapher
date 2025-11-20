import { Suspense } from "react"
import { IncomePlot } from "./IncomePlot.tsx"
import { IncomePlotControlsRow } from "./IncomePlotControlsRow.tsx"

export const App = () => {
    return (
        <div>
            <h1>Income Distribution Visualization</h1>
            <Suspense fallback={<div>Loading plot...</div>}>
                <IncomePlot />
            </Suspense>
            <IncomePlotControlsRow />
        </div>
    )
}
