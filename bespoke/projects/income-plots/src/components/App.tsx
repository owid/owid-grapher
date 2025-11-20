import { IncomePlot } from "./IncomePlot.tsx"
import { IncomePlotControlsRow } from "./IncomePlotControlsRow.tsx"

export const App = () => {
    return (
        <div>
            <h1>Income Distribution Visualization</h1>
            <IncomePlot />
            <IncomePlotControlsRow />
        </div>
    )
}
