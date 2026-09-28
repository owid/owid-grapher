import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from "react"
import cx from "clsx"
import { GrapherState, GuidedChartContext } from "@ourworldindata/grapher"
import { type GrapherQueryParams } from "@ourworldindata/types"
import { reaction, runInAction, when } from "mobx"
import { RelatedSections, Sidebar } from "./Sidebar.js"
import { HorizontalStrip } from "./HorizontalStrip.js"
import { type DataPage, type Perspective } from "./data.js"
import { useWindowQueryParams } from "../hooks.js"

const VARIANTS = [
    { id: "sidebar", label: "Sidebar" },
    { id: "horizontal", label: "Horizontal" },
] as const
type Variant = (typeof VARIANTS)[number]["id"]
const DEFAULT_VARIANT: Variant = "sidebar"
const VARIANT_PARAM = "perspectivesVariant"

// The chart as configured, without any query parameters
const DEFAULT_PERSPECTIVE_ID = "default"

const RELATED_OPTIONS = [
    { id: "on", label: "On" },
    { id: "off", label: "Off" },
] as const
const RELATED_PARAM = "perspectivesRelated"

// "tinted" keeps only the chart white and sets everything around it on a
// tinted background, with the selected perspective joined to the chart
const BACKGROUNDS = [
    { id: "tinted", label: "Tinted" },
    { id: "white", label: "White" },
] as const
type Background = (typeof BACKGROUNDS)[number]["id"]
const DEFAULT_BACKGROUND: Background = "tinted"
const BACKGROUND_PARAM = "perspectivesBackground"

function parseVariant(value: string | null): Variant {
    return (
        VARIANTS.find((variant) => variant.id === value)?.id ?? DEFAULT_VARIANT
    )
}

function parseBackground(value: string | null): Background {
    return (
        BACKGROUNDS.find((background) => background.id === value)?.id ??
        DEFAULT_BACKGROUND
    )
}

/** Harness state kept in the URL; undefined values are left out. */
function getHarnessParams({
    variant,
    showRelated,
    background,
}: {
    variant: Variant
    showRelated: boolean
    background: Background
}): Record<string, string | undefined> {
    return {
        // Earlier versions of the prototype stored the selection in the URL
        perspective: undefined,
        [VARIANT_PARAM]: variant === DEFAULT_VARIANT ? undefined : variant,
        [RELATED_PARAM]: showRelated ? undefined : "off",
        [BACKGROUND_PARAM]:
            background === DEFAULT_BACKGROUND ? undefined : background,
    }
}

function applyPerspective(
    state: GrapherState,
    perspective: Perspective,
    harnessParams: Record<string, string | undefined> = {}
): void {
    const externalParams = { ...state.externalQueryParams }
    delete externalParams.v
    for (const [key, value] of Object.entries(harnessParams)) {
        if (value) externalParams[key] = value
        else delete externalParams[key]
    }
    state.clearQueryParams()
    state.populateFromQueryParams({
        ...externalParams,
        ...perspective.config,
        // Explicitly choose a line chart, even after the reader switches chart type.
        ...(perspective.config.tab === "chart" ? { tab: "line" } : {}),
    })
}

/** Identifies a chart view by the parameters that differ from the authored chart. */
function getViewKey(state: GrapherState): string {
    const params: Partial<GrapherQueryParams> = { ...state.changedParams }
    // Opening a modal doesn't change the view
    delete params.overlay
    return JSON.stringify(
        Object.entries(params)
            .filter(([, value]) => value !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
    )
}

/**
 * Perspective configs are shorthand: Grapher normalizes their parameters
 * (e.g. drops values equal to the authored chart) in ways that depend on the
 * chart and its data. To compare them with the current view, briefly apply
 * each one to the chart and record the resulting view, then restore it. It all
 * happens in one action, so nothing renders in between.
 */
function getPerspectiveViewKeys(
    state: GrapherState,
    perspectives: Perspective[]
): Map<string, string> {
    return runInAction(() => {
        const current = { ...state.changedParams, ...state.externalQueryParams }
        const viewKeys = new Map(
            perspectives.map((perspective) => {
                applyPerspective(state, perspective)
                return [perspective.id, getViewKey(state)]
            })
        )
        state.clearQueryParams()
        state.populateFromQueryParams(current)
        return viewKeys
    })
}

/** Development-only harness around the actual data page's Grapher. */
export function DataPerspectivesPrototype({
    page,
    belowChart,
    children,
}: {
    page: DataPage
    /** Page content that follows the chart, e.g. the metadata box */
    belowChart?: ReactNode
    children: ReactNode
}) {
    const stateRef = useRef<GrapherState | null>(null)
    const chartRef = useRef<HTMLDivElement>(null)
    const [perspectiveViewKeys, setPerspectiveViewKeys] =
        useState<Map<string, string>>()
    const [viewKey, setViewKey] = useState<string>()
    const [variant, setVariant] = useState<Variant>(DEFAULT_VARIANT)
    const [showRelated, setShowRelated] = useState(true)
    const [background, setBackground] = useState<Background>(DEFAULT_BACKGROUND)
    const [mounted, setMounted] = useState(false)
    const queryStr = useWindowQueryParams()
    const context = useMemo(
        () => ({ grapherStateRef: stateRef as RefObject<GrapherState> }),
        []
    )

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        setVariant(parseVariant(params.get(VARIANT_PARAM)))
        setShowRelated(params.get(RELATED_PARAM) !== "off")
        setBackground(parseBackground(params.get(BACKGROUND_PARAM)))
        setMounted(true)
    }, [])

    const perspectives: Perspective[] = useMemo(
        () => [
            {
                id: DEFAULT_PERSPECTIVE_ID,
                title: page.defaultPerspectiveTitle ?? "Base view",
                config: {},
            },
            ...page.perspectives,
        ],
        [page]
    )

    // Follow the chart's view once Grapher and its data are ready. The Grapher
    // state is created while the chart renders, so it may not exist yet.
    useEffect(() => {
        const disposers: (() => void)[] = []
        let frame: number | undefined
        const subscribe = (): void => {
            const state = stateRef.current
            if (!state) {
                frame = requestAnimationFrame(subscribe)
                return
            }
            disposers.push(
                when(
                    () => state.isReady,
                    () => {
                        setPerspectiveViewKeys(
                            getPerspectiveViewKeys(state, perspectives)
                        )
                        disposers.push(
                            reaction(() => getViewKey(state), setViewKey, {
                                fireImmediately: true,
                            })
                        )
                    }
                )
            )
        }
        subscribe()
        return () => {
            if (frame !== undefined) cancelAnimationFrame(frame)
            disposers.forEach((dispose) => dispose())
        }
    }, [perspectives])

    // Grapher owns the chart parameters. Preserve the harness parameters when
    // its URL binding replaces the query string after a chart interaction.
    useEffect(() => {
        if (!mounted) return
        const url = new URL(window.location.href)
        url.searchParams.delete("v")
        const harnessParams = getHarnessParams({
            variant,
            showRelated,
            background,
        })
        for (const [key, value] of Object.entries(harnessParams)) {
            if (value) url.searchParams.set(key, value)
            else url.searchParams.delete(key)
        }
        if (url.search !== window.location.search)
            window.history.replaceState(null, "", url)
    }, [queryStr, variant, showRelated, background, mounted])

    const selectPerspective = (perspective: Perspective): void => {
        const state = stateRef.current
        if (!state) return
        runInAction(() =>
            applyPerspective(
                state,
                perspective,
                getHarnessParams({ variant, showRelated, background })
            )
        )
        if (
            chartRef.current &&
            chartRef.current.getBoundingClientRect().top < 0
        ) {
            chartRef.current.scrollIntoView({
                block: "start",
                behavior: "instant",
            })
        }
    }
    // A view that matches no perspective, e.g. after the reader changes the
    // chart, leaves them all unselected
    const selectedId =
        viewKey === undefined
            ? undefined
            : perspectives.find(
                  (perspective) =>
                      perspectiveViewKeys?.get(perspective.id) === viewKey
              )?.id

    // The white sidebar runs down the page next to the content below the chart
    const hasLongSidebar = variant === "sidebar" && background === "white"

    // With the vertical tinted layout, the related sections move out of the
    // tinted section into a white box next to the content below the chart
    const hasRelatedBelow =
        variant === "sidebar" &&
        background === "tinted" &&
        showRelated &&
        !!(page.relatedData || page.relatedArticles)

    const sectionProps = {
        page: {
            ...page,
            perspectives,
            ...(showRelated
                ? {}
                : { relatedData: undefined, relatedArticles: undefined }),
        },
        selectedId,
        onSelect: selectPerspective,
    }

    return (
        <GuidedChartContext.Provider value={context}>
            <div
                className={cx(
                    "data-perspectives-prototype",
                    `data-perspectives-prototype--${variant}`,
                    `data-perspectives-prototype--${background}`,
                    {
                        "data-perspectives-prototype--long-sidebar":
                            hasLongSidebar,
                    }
                )}
            >
                <div
                    className="data-perspectives-prototype__chart"
                    ref={chartRef}
                    data-dod-track-note="grapher"
                >
                    {children}
                </div>
                {variant === "horizontal" ? (
                    <HorizontalStrip {...sectionProps} />
                ) : (
                    <Sidebar {...sectionProps} withRelated={!hasRelatedBelow} />
                )}
                {hasLongSidebar && belowChart && (
                    <div className="data-perspectives-prototype__below">
                        {belowChart}
                    </div>
                )}
            </div>
            {hasRelatedBelow ? (
                <div className="data-perspectives-prototype data-perspectives-prototype--related-below">
                    <section className="perspectives" aria-label="Related">
                        <div className="perspectives__content">
                            <RelatedSections page={sectionProps.page} />
                        </div>
                    </section>
                    <div className="data-perspectives-prototype__below">
                        {belowChart}
                    </div>
                </div>
            ) : (
                !hasLongSidebar && belowChart
            )}
            <VariantSwitcher
                variant={variant}
                onVariantChange={setVariant}
                showRelated={showRelated}
                onShowRelatedChange={setShowRelated}
                background={background}
                onBackgroundChange={setBackground}
            />
        </GuidedChartContext.Provider>
    )
}

/** Floating controls for comparing the prototype variants during evaluation. */
function VariantSwitcher({
    variant,
    onVariantChange,
    showRelated,
    onShowRelatedChange,
    background,
    onBackgroundChange,
}: {
    variant: Variant
    onVariantChange: (variant: Variant) => void
    showRelated: boolean
    onShowRelatedChange: (showRelated: boolean) => void
    background: Background
    onBackgroundChange: (background: Background) => void
}) {
    return (
        <div className="data-perspectives-variant-switcher">
            <SwitcherGroup
                label="Layout"
                options={VARIANTS}
                value={variant}
                onChange={onVariantChange}
            />
            <SwitcherGroup
                label="Related"
                options={RELATED_OPTIONS}
                value={showRelated ? "on" : "off"}
                onChange={(value) => onShowRelatedChange(value === "on")}
            />
            <SwitcherGroup
                label="Background"
                options={BACKGROUNDS}
                value={background}
                onChange={onBackgroundChange}
            />
        </div>
    )
}

function SwitcherGroup<T extends string>({
    label,
    options,
    value,
    onChange,
}: {
    label: string
    options: readonly { id: T; label: string }[]
    value: T
    onChange: (value: T) => void
}) {
    return (
        <div
            className="data-perspectives-variant-switcher__group"
            role="group"
            aria-label={label}
        >
            <span className="data-perspectives-variant-switcher__label">
                {label}
            </span>
            {options.map((option) => (
                <button
                    key={option.id}
                    className="data-perspectives-variant-switcher__option"
                    aria-pressed={value === option.id}
                    onClick={() => onChange(option.id)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}
