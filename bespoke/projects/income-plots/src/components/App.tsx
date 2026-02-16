import { Suspense, useEffect, useMemo, useRef } from "react"
import { IncomePlot } from "./IncomePlot.tsx"
import {
    IncomePlotControlsRowBottom,
    IncomePlotControlsRowTop,
} from "./IncomePlotControlsRow.tsx"
import { PLOT_HEIGHT, PLOT_WIDTH } from "../utils/incomePlotConstants.ts"
import { useAtomValue, useSetAtom } from "jotai"
import { atomCurrentYear, atomIsMobile } from "../store.ts"
import { useResizeObserver } from "usehooks-ts"

export const App = () => {
    const currentYear = useAtomValue(atomCurrentYear)
    const containerRef = useRef<HTMLDivElement>(null)
    const { width = PLOT_WIDTH } = useResizeObserver({
        ref: containerRef as React.RefObject<HTMLDivElement>,
    })

    const setIsMobile = useSetAtom(atomIsMobile)

    const isMobile = useMemo(() => width < 720, [width])
    useEffect(() => {
        setIsMobile(isMobile)
    }, [isMobile, setIsMobile])

    return (
        <div ref={containerRef}>
            <IncomePlotControlsRowTop />
            <div
                style={{
                    width: PLOT_WIDTH,
                    aspectRatio: PLOT_WIDTH / PLOT_HEIGHT,
                    maxWidth: "100%",
                    margin: "auto",
                }}
            >
                <Suspense fallback={<>Loading...</>}>
                    <IncomePlot key={currentYear} isMobile={isMobile} />
                </Suspense>
            </div>
            <IncomePlotControlsRowBottom isMobile={isMobile} />
        </div>
    )
}
