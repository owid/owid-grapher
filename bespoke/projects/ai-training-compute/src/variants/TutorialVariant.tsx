import { useCallback, useRef, useState } from "react"
import cx from "clsx"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"

import { ChartBody } from "../components/ChartBody.js"
import { ChartSubtitle } from "../components/ChartSubtitle.js"
import { ModelSetSwitch } from "../components/ModelSetSwitch.js"
import { YScaleSwitch } from "../components/YScaleSwitch.js"
import { NOTE, SOURCE } from "../components/ChartSource.js"
import {
    SlideFooter,
    SlideHeader,
    WalkthroughPills,
    WalkthroughRail,
    useWalkthroughKeyboard,
} from "../components/Walkthrough.js"
import { FRONTIER_TIME_RANGE } from "../core/frontier.js"
import { ViewState, useViewState } from "../core/viewState.js"
import { initialViewFromConfig, useLabeledModels } from "../core/chartConfig.js"
import {
    WALKTHROUGHS,
    clampSlide,
    findWalkthrough,
    resolveSlideView,
} from "../core/walkthroughs.js"
import type { AiTrainingComputeConfig } from "../index.js"

/** From this container width on, the walkthroughs sit in a rail beside the chart */
const RAIL_BREAKPOINT = 900

/**
 * The chart with guided walkthroughs beside it. Playing one puts each
 * slide's text in place of the chart's header and eases the chart to the
 * slide's view; closing it eases back to where the reader left off.
 */
export function TutorialVariant({
    config,
}: {
    config: AiTrainingComputeConfig
}) {
    const { ref, width } = useContainerWidth()
    const hasRail = width >= RAIL_BREAKPOINT
    const labeledModels = useLabeledModels(config)

    // A walkthrough set in the config plays from the start, on its first
    // slide's view
    const [initialWalkthrough] = useState(() =>
        config.walkthrough ? findWalkthrough(config.walkthrough) : undefined
    )
    const { view, animate, updateView } = useViewState(
        initialWalkthrough
            ? resolveSlideView(initialWalkthrough.slides[0])
            : initialViewFromConfig(config)
    )
    const [playing, setPlaying] = useState<
        { id: string; slide: number } | undefined
    >(() =>
        initialWalkthrough ? { id: initialWalkthrough.id, slide: 1 } : undefined
    )
    const [watchedIds, setWatchedIds] = useState<ReadonlySet<string>>(
        () => new Set()
    )
    // The reader's own view, to come back to when a walkthrough closes
    const readerViewRef = useRef<ViewState | undefined>(
        initialWalkthrough ? initialViewFromConfig(config) : undefined
    )

    const walkthrough = playing ? findWalkthrough(playing.id) : undefined
    const slideNumber =
        walkthrough && playing ? clampSlide(playing.slide, walkthrough) : 1

    const goTo = useCallback(
        (id: string, slide: number) => {
            const target = findWalkthrough(id)
            if (!target) return
            const number = clampSlide(slide, target)
            setPlaying({ id, slide: number })
            updateView(resolveSlideView(target.slides[number - 1]), {
                animate: true,
            })
        },
        [updateView]
    )
    const open = useCallback(
        (id: string) => {
            if (!readerViewRef.current) readerViewRef.current = view
            goTo(id, 1)
        },
        [goTo, view]
    )
    const close = useCallback(() => {
        if (walkthrough && slideNumber === walkthrough.slides.length)
            setWatchedIds((ids) => new Set([...ids, walkthrough.id]))
        setPlaying(undefined)
        updateView(readerViewRef.current ?? initialViewFromConfig(config), {
            animate: true,
        })
        readerViewRef.current = undefined
    }, [walkthrough, slideNumber, updateView, config])
    const select = useCallback(
        (id: string) => (playing?.id === id ? close() : open(id)),
        [playing, close, open]
    )

    useWalkthroughKeyboard({
        isOpen: !!walkthrough,
        onPrevious: () => walkthrough && goTo(walkthrough.id, slideNumber - 1),
        onNext: () => walkthrough && goTo(walkthrough.id, slideNumber + 1),
        onClose: close,
    })

    return (
        <div
            ref={ref}
            className={cx("ai-tutorial", {
                "ai-tutorial--with-rail": hasRail,
                "ai-tutorial--playing": !!walkthrough,
            })}
        >
            {hasRail ? (
                <WalkthroughRail
                    walkthroughs={WALKTHROUGHS}
                    activeId={walkthrough?.id}
                    watchedIds={watchedIds}
                    onSelect={select}
                />
            ) : (
                <WalkthroughPills
                    walkthroughs={WALKTHROUGHS}
                    activeId={walkthrough?.id}
                    onSelect={select}
                />
            )}
            <Frame className="ai-training-compute ai-tutorial__frame">
                {walkthrough ? (
                    <SlideHeader
                        walkthrough={walkthrough}
                        slideNumber={slideNumber}
                        onClose={close}
                    />
                ) : (
                    <ChartHeader
                        title={config.title}
                        subtitle={
                            <ChartSubtitle
                                subtitle={config.subtitle}
                                onShowFrontier={() =>
                                    updateView(
                                        {
                                            showFrontier: true,
                                            timeRange: FRONTIER_TIME_RANGE,
                                        },
                                        { animate: true }
                                    )
                                }
                            />
                        }
                    />
                )}
                <div className="ai-training-compute__controls">
                    <ModelSetSwitch
                        modelSet={view.modelSet}
                        onChange={(modelSet) => updateView({ modelSet })}
                    />
                    <YScaleSwitch
                        yScaleType={view.yScaleType}
                        onChange={(yScaleType) => updateView({ yScaleType })}
                    />
                </div>
                <ChartBody
                    view={view}
                    animate={animate}
                    labeledModels={labeledModels}
                    onTimeRangeChange={
                        config.hideControls
                            ? undefined
                            : (timeRange) => updateView({ timeRange })
                    }
                />
                {walkthrough && (
                    <SlideFooter
                        walkthrough={walkthrough}
                        slideNumber={slideNumber}
                        onGoTo={(slide) => goTo(walkthrough.id, slide)}
                        onClose={close}
                    />
                )}
                <ChartFooter source={SOURCE} note={NOTE} />
            </Frame>
        </div>
    )
}
