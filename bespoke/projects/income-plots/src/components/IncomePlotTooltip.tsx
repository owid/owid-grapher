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
    atomLegendPlacement,
    atomRawDataForYear,
    atomTimeInterval,
    atomTooltipIsOpen,
} from "../store.ts"
import {
    computePercentageBelowLine,
    formatCurrency,
    getLabelDirection,
    getTimeIntervalStr,
    roundPercentage,
} from "../utils/incomePlotUtils.ts"
import { WORLD_ENTITY_NAME } from "../utils/incomePlotConstants.ts"

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

    const legendPlacement = useAtomValue(atomLegendPlacement)

    const tooltipPlacement = getLabelDirection(hoveredX ?? 0, legendPlacement)

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        middleware: [offset(10), flip(), shift(), arrow({ element: arrowRef })],
        placement: tooltipPlacement,
        whileElementsMounted: autoUpdate,
    })

    const hover = useHover(context, { move: false })
    const clientPoint = useClientPoint(context)
    const { getFloatingProps } = useInteractions([hover, clientPoint])

    if (!lineForDisplay) return null

    const entityForPercentage = hoveredEntity ?? WORLD_ENTITY_NAME
    let percentageForEntity: number | undefined = undefined
    if (entityForPercentage) {
        const percentageMap = computePercentageBelowLine(
            rawDataForYear,
            lineForDisplay,
            new Set([entityForPercentage])
        )
        percentageForEntity = percentageMap.get(entityForPercentage)
    }

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
                        {entityForPercentage && (
                            <>
                                {entityForPercentage !== WORLD_ENTITY_NAME && (
                                    <div className="tooltip--entityName">
                                        {entityForPercentage}
                                    </div>
                                )}
                                <div className="tooltip--percentage">
                                    {percentageForEntity !== undefined && (
                                        <>
                                            {roundPercentage(
                                                percentageForEntity
                                            )}
                                            % of the{" "}
                                            {entityForPercentage ===
                                            WORLD_ENTITY_NAME
                                                ? "world"
                                                : "country's"}{" "}
                                            population lives on less than{" "}
                                            {formatCurrency(
                                                lineForDisplay * combinedFactor,
                                                currency
                                            )}
                                            /{getTimeIntervalStr(timeInterval)}
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                        <div className="tooltip--set-pov-line">
                            {povertyLine !== null
                                ? "Click to unset custom poverty line"
                                : "Click to set a custom poverty line"}
                        </div>
                    </div>
                </FloatingPortal>
            )}
        </>
    )
}
