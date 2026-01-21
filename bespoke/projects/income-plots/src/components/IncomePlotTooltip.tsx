import {
    FloatingPortal,
    arrow,
    autoUpdate,
    flip,
    offset,
    shift,
    useClientPoint,
    useFloating,
    useHover,
    useInteractions,
} from "@floating-ui/react"
import { useAtomValue } from "jotai"
import { useRef } from "react"
import { useShadowRoot } from "../ShadowRootContext.tsx"
import {
    atomCombinedFactor,
    atomCurrentCurrency,
    atomCustomPovertyLine,
    atomHoveredEntity,
    atomHoveredX,
    atomRawDataForYear,
    atomTimeInterval,
    atomTooltipIsOpen,
} from "../store.ts"
import {
    computePercentageBelowLine,
    formatCurrency,
    getTimeIntervalStr,
} from "../utils/incomePlotUtils.ts"

export const IncomePlotTooltip = () => {
    const arrowRef = useRef(null)
    const shadowRoot = useShadowRoot()

    const isOpen = useAtomValue(atomTooltipIsOpen)
    const hoveredEntity = useAtomValue(atomHoveredEntity)
    const hoveredX = useAtomValue(atomHoveredX)
    const povertyLine = useAtomValue(atomCustomPovertyLine)
    const rawDataForYear = useAtomValue(atomRawDataForYear)
    const currency = useAtomValue(atomCurrentCurrency)
    const combinedFactor = useAtomValue(atomCombinedFactor)
    const timeInterval = useAtomValue(atomTimeInterval)

    const lineForDisplay = povertyLine ?? hoveredX

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        middleware: [offset(10), flip(), shift(), arrow({ element: arrowRef })],
        placement: "right",
        whileElementsMounted: autoUpdate,
    })

    const hover = useHover(context, { move: false })
    const clientPoint = useClientPoint(context)
    const { getFloatingProps } = useInteractions([hover, clientPoint])

    if (!lineForDisplay || !hoveredEntity) return null
    const percentageMap = computePercentageBelowLine(
        rawDataForYear,
        lineForDisplay,
        new Set([hoveredEntity])
    )
    const percentageForEntity = percentageMap.get(hoveredEntity)

    return (
        <>
            {isOpen && (
                <FloatingPortal root={shadowRoot}>
                    <div
                        className="income-plot-tooltip"
                        ref={refs.setFloating}
                        style={floatingStyles}
                        {...getFloatingProps()}
                    >
                        <div className="tooltip--entityName">
                            {hoveredEntity}
                        </div>
                        <div className="tooltip--percentage">
                            {percentageForEntity !== undefined && (
                                <>
                                    {Math.round(percentageForEntity)}% of the
                                    population earns less than{" "}
                                    {formatCurrency(
                                        lineForDisplay * combinedFactor,
                                        currency
                                    )}
                                    /{getTimeIntervalStr(timeInterval)}
                                </>
                            )}
                        </div>
                        <div className="tooltip--set-pov-line">
                            Click to set poverty line
                        </div>
                    </div>
                </FloatingPortal>
            )}
        </>
    )
}
