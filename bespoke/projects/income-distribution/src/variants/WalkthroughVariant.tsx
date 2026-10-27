import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import cx from "clsx"
import { QueryClientProvider } from "@tanstack/react-query"

import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { BespokeMetadataProvider } from "../../../../components/MetadataModal/BespokeMetadataContext.js"
import { EmbedConfigProvider } from "../../../../hooks/useEmbedConfig.js"
import { combineStatuses } from "../../../../helpers/queryStatus.js"
import type { VariantProps } from "../../../../helpers/config.js"
import type { BespokeComponentDataUrls } from "owid-bespoke-types"

import { IncomeDistributionConfig } from "../core/config.js"
import { DEFAULT_YEAR } from "../core/constants.js"
import {
    IncomeDistributionMetadata,
    queryClient,
    useIncomeDistributionMetadata,
    useIncomeDistributionYear,
} from "../core/data.js"
import type { IncomeDistributionYear } from "../core/types.js"
import { mixScenes, phase, type Scene } from "../walkthrough/scene.js"
import {
    BEAT_NAMES,
    buildSteps,
    initialScene,
    StepScenes,
} from "../walkthrough/steps.js"
import { buildWalkthroughData } from "../walkthrough/walkthroughData.js"
import { WalkthroughPlot } from "../walkthrough/WalkthroughPlot.js"

/** Below this width the text cards scroll over the plot instead of beside it */
const WIDE_BREAKPOINT = 760

/** Where a step takes over, as a share of the viewport's height from the top */
const TRIGGER_LINE_WIDE = 0.55
const TRIGGER_LINE_NARROW = 0.85

/** Step animations play faster than the timed prototype they come from */
const PLAYBACK_SPEED = 1.6

/** How long the plot takes to blend into a step it jumps to */
const BLEND_MS = 450

export function WalkthroughVariant({
    config,
    urls,
}: VariantProps<IncomeDistributionConfig>): React.ReactElement {
    return (
        <EmbedConfigProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <FetchingWalkthroughVariant config={config} urls={urls} />
            </QueryClientProvider>
        </EmbedConfigProvider>
    )
}

function FetchingWalkthroughVariant({
    config,
    urls,
}: {
    config: IncomeDistributionConfig
    urls: BespokeComponentDataUrls
}): React.ReactElement {
    const { data: metadata, status: metadataStatus } =
        useIncomeDistributionMetadata(urls.metadataUrl)
    const { data: yearData, status: yearStatus } = useIncomeDistributionYear(
        config.year ?? DEFAULT_YEAR,
        urls.dataUrl
    )
    const status = combineStatuses(metadataStatus, yearStatus)

    if (status === "pending")
        return <ChartSkeleton className="walkthrough-skeleton" />
    if (status === "error" || !metadata || !yearData)
        return <ChartError className="walkthrough-skeleton" />

    return <Walkthrough metadata={metadata} yearData={yearData} />
}

function Walkthrough({
    metadata,
    yearData,
}: {
    metadata: IncomeDistributionMetadata
    yearData: IncomeDistributionYear
}): React.ReactElement {
    const { scenes, stats } = useMemo(() => {
        const data = buildWalkthroughData(yearData)
        return {
            scenes: new StepScenes(initialScene(data), buildSteps(data)),
            stats: data.stats,
        }
    }, [yearData])
    const steps = scenes.steps

    const [rootRef, rootSize] = useElementSize<HTMLDivElement>()
    const [plotRef, plotSize] = useElementSize<HTMLDivElement>()
    const isWide = rootSize.width >= WIDE_BREAKPOINT

    const stepRefs = useRef<(HTMLElement | null)[]>([])
    const activeIndex = useActiveStep(
        stepRefs,
        isWide ? TRIGGER_LINE_WIDE : TRIGGER_LINE_NARROW
    )
    const scene = useStepAnimation(scenes, activeIndex)

    const activeStep = activeIndex >= 0 ? steps[activeIndex] : undefined

    return (
        <div
            ref={rootRef}
            className={cx("walkthrough", {
                "walkthrough--wide": isWide,
                "walkthrough--narrow": !isWide,
            })}
        >
            <div className="walkthrough__graphic">
                <div ref={plotRef} className="walkthrough__plot">
                    <WalkthroughPlot
                        scene={scene}
                        stats={stats}
                        year={yearData.year}
                        width={plotSize.width}
                        height={plotSize.height}
                    />
                </div>
                <BespokeMetadataProvider metadata={metadata.bespokeMetadata}>
                    <ChartFooter
                        className={cx("walkthrough__footer", {
                            "walkthrough__footer--highlighted":
                                activeStep?.pointsAtNotes,
                        })}
                        source={metadata.source}
                    />
                </BespokeMetadataProvider>
            </div>
            {/* role="list" keeps list semantics in Safari, which drops them with list-style: none */}
            <ol className="walkthrough__steps" role="list">
                {steps.map((step, i) => {
                    const startsBeat =
                        i === 0 || steps[i - 1].beat !== step.beat
                    return (
                        <li
                            key={i}
                            ref={(el) => {
                                stepRefs.current[i] = el
                            }}
                            className={cx("walkthrough__step", {
                                "walkthrough__step--active": i === activeIndex,
                            })}
                        >
                            <div className="walkthrough__card">
                                {startsBeat && (
                                    <div className="walkthrough__kicker">
                                        Part {step.beat + 1} of{" "}
                                        {BEAT_NAMES.length} ·{" "}
                                        {BEAT_NAMES[step.beat]}
                                    </div>
                                )}
                                <p
                                    className={cx("walkthrough__text", {
                                        "walkthrough__text--placeholder":
                                            step.isPlaceholder,
                                    })}
                                >
                                    {step.text}
                                </p>
                            </div>
                        </li>
                    )
                })}
            </ol>
        </div>
    )
}

/**
 * The index of the step whose card has crossed the trigger line, the
 * highest one if several have; -1 before the first
 */
function useActiveStep(
    stepRefs: React.RefObject<(HTMLElement | null)[]>,
    triggerLine: number
): number {
    const [index, setIndex] = useState(-1)

    useEffect(() => {
        let frame = 0
        const update = (): void => {
            frame = 0
            const line = window.innerHeight * triggerLine
            let next = -1
            stepRefs.current.forEach((el, i) => {
                if (el && el.getBoundingClientRect().top <= line) next = i
            })
            setIndex(next)
        }
        const schedule = (): void => {
            if (!frame) frame = requestAnimationFrame(update)
        }
        update()
        window.addEventListener("scroll", schedule, { passive: true })
        window.addEventListener("resize", schedule)
        return () => {
            cancelAnimationFrame(frame)
            window.removeEventListener("scroll", schedule)
            window.removeEventListener("resize", schedule)
        }
    }, [stepRefs, triggerLine])

    return index
}

function prefersReducedMotion(): boolean {
    return (
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
}

/**
 * The scene to draw. When the active step changes, the plot blends from
 * whatever it was showing into the new step: moving forward, the step's
 * animation then plays; moving back, it lands on the step's end state.
 */
function useStepAnimation(scenes: StepScenes, index: number): Scene {
    const [scene, setScene] = useState<Scene>(() => scenes.at(index, Infinity))
    const shownRef = useRef(scene)
    useEffect(() => {
        shownRef.current = scene
    })
    const previousIndexRef = useRef(index)

    useEffect(() => {
        const forward = index > previousIndexRef.current
        previousIndexRef.current = index
        const from = shownRef.current
        const duration = index >= 0 ? scenes.steps[index].duration : 0
        const instant = prefersReducedMotion()

        const start = performance.now()
        let frame = 0
        const tick = (now: number): void => {
            const elapsed = now - start
            const ms = forward && !instant ? elapsed * PLAYBACK_SPEED : Infinity
            const blend = instant ? 1 : phase(elapsed, 0, BLEND_MS)
            setScene(mixScenes(from, scenes.at(index, ms), blend))
            if (blend < 1 || ms < duration) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [scenes, index])

    return scene
}

function useElementSize<E extends HTMLElement>(): [
    (node: E | null) => void,
    { width: number; height: number },
] {
    const [node, setNode] = useState<E | null>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })

    useLayoutEffect(() => {
        if (!node || typeof ResizeObserver === "undefined") return
        const update = (): void =>
            setSize({ width: node.clientWidth, height: node.clientHeight })
        const observer = new ResizeObserver(update)
        observer.observe(node)
        update()
        return () => observer.disconnect()
    }, [node])

    return [setNode, size]
}
