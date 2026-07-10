import * as React from "react"
import { useEffect, useRef, useState } from "react"
import cx from "clsx"
import { observer } from "mobx-react"
import { runInAction } from "mobx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCheck, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons"
import {
    ColumnSlug,
    EntityName,
    GrapherQueryParams,
    GrapherTabName,
    Time,
} from "@ourworldindata/types"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { SelectionArray } from "../selection/SelectionArray"
import { groupEntitiesByRegionType } from "../core/RegionGroups"
import { SearchField } from "../controls/SearchField"
import {
    AssistantBackend,
    AssistantChartContext,
    AssistantTrailingChange,
    AssistantView,
    AssistantViewOption,
    MockAssistantBackend,
    buildDefaultOptions,
    buildFollowUpOptions,
} from "./AssistantBackend"

export interface AssistantPanelManager {
    availableTabs: GrapherTabName[]
    activeTab: GrapherTabName
    times: Time[]
    selection: SelectionArray
    yColumnSlugs: ColumnSlug[]
    inputTable: OwidTable
    populateFromQueryParams: (params: GrapherQueryParams) => void
}

/** Trailing window for "fastest decline/increase" options */
const TRAILING_WINDOW_YEARS = 20

/** How many suggestion chips to show by default (before any query) */
const MAX_DEFAULT_OPTIONS = 3
/** How many follow-up chips to show after a view has been applied */
const MAX_FOLLOW_UP_OPTIONS = 3

/** How long the "Applied ..." confirmation is fully visible */
const CONFIRMATION_HOLD_MS = 2500
/** How long the confirmation takes to fade out (keep in sync with the scss) */
const CONFIRMATION_FADE_MS = 1000

function buildAssistantContext(
    manager: AssistantPanelManager
): AssistantChartContext {
    // Use the full input table rather than `availableEntityNames`/`times`,
    // which are filtered by the current view (e.g. a map zoomed to a region,
    // or the times covered by the current selection)
    const availableTimes =
        manager.yColumnSlugs.length > 0
            ? manager.inputTable.getTimesUniqSortedAscForColumns(
                  manager.yColumnSlugs
              )
            : manager.times

    // Country entities (aggregates like "Africa" or "World" excluded) so
    // rankings are country-to-country comparisons
    const regionGroups = groupEntitiesByRegionType(
        manager.inputTable.availableEntityNames
    )
    const countryEntities = new Set(
        regionGroups.find((group) => group.regionGroupKey === "countries")
            ?.entityNames ?? []
    )

    const columnSlug = manager.yColumnSlugs[0]
    const column = columnSlug ? manager.inputTable.get(columnSlug) : undefined

    return {
        availableEntityNames: manager.inputTable.availableEntityNames,
        availableTabs: manager.availableTabs,
        activeTab: manager.activeTab,
        availableTimes,
        selectedEntityNames: manager.selection.selectedEntityNames,
        latestValueByEntityName: computeLatestValuesByCountry(
            column,
            countryEntities
        ),
        trailingChange: computeTrailingChange(
            column,
            countryEntities,
            availableTimes
        ),
    }
}

/** Latest data value per country entity (used for "top/bottom N" views) */
function computeLatestValuesByCountry(
    column: CoreColumn | undefined,
    countryEntities: Set<EntityName>
): Map<EntityName, number> {
    const latestValues = new Map<EntityName, number>()
    if (!column) return latestValues

    for (const [
        entityName,
        valueByTime,
    ] of column.valueByEntityNameAndOriginalTime) {
        if (!countryEntities.has(entityName)) continue
        let latestTime = -Infinity
        let latestValue: number | undefined
        for (const [time, value] of valueByTime) {
            if (typeof value === "number" && time > latestTime) {
                latestTime = time
                latestValue = value
            }
        }
        if (latestValue !== undefined) latestValues.set(entityName, latestValue)
    }
    return latestValues
}

/**
 * Per-country change over the trailing window, computed as the last minus the
 * first value each country has within the window (used for "fastest
 * decline/increase" views)
 */
function computeTrailingChange(
    column: CoreColumn | undefined,
    countryEntities: Set<EntityName>,
    availableTimes: Time[]
): AssistantTrailingChange | undefined {
    if (!column || availableTimes.length < 2) return undefined

    const endTime = availableTimes[availableTimes.length - 1]
    const targetStartTime = endTime - TRAILING_WINDOW_YEARS
    const startTime =
        availableTimes.find((time) => time >= targetStartTime) ??
        availableTimes[0]
    if (startTime >= endTime) return undefined

    const changeByEntityName = new Map<EntityName, number>()
    for (const [
        entityName,
        valueByTime,
    ] of column.valueByEntityNameAndOriginalTime) {
        if (!countryEntities.has(entityName)) continue
        let firstTime = Infinity
        let firstValue: number | undefined
        let lastTime = -Infinity
        let lastValue: number | undefined
        for (const [time, value] of valueByTime) {
            if (typeof value !== "number") continue
            if (time < startTime || time > endTime) continue
            if (time < firstTime) {
                firstTime = time
                firstValue = value
            }
            if (time > lastTime) {
                lastTime = time
                lastValue = value
            }
        }
        if (
            firstValue !== undefined &&
            lastValue !== undefined &&
            lastTime > firstTime
        )
            changeByEntityName.set(entityName, lastValue - firstValue)
    }
    if (changeByEntityName.size === 0) return undefined

    return { startTime, endTime, changeByEntityName }
}

export const AssistantPanel = observer(function AssistantPanel({
    manager,
}: {
    manager: AssistantPanelManager
}): React.ReactElement {
    const [inputValue, setInputValue] = useState("")
    const [isPending, setIsPending] = useState(false)
    const [confirmation, setConfirmation] = useState<string | undefined>()
    const [isConfirmationFading, setIsConfirmationFading] = useState(false)
    const [options, setOptions] = useState<AssistantViewOption[] | undefined>()
    const [followUps, setFollowUps] = useState<
        AssistantViewOption[] | undefined
    >()
    const [note, setNote] = useState<string | undefined>()
    const [hasSubmitted, setHasSubmitted] = useState(false)
    const requestIdRef = useRef(0)
    const confirmationTimersRef = useRef<number[]>([])
    const backendRef = useRef<AssistantBackend>(undefined)
    backendRef.current ??= new MockAssistantBackend()

    // Clear any pending confirmation timers on unmount
    useEffect(
        () => (): void =>
            confirmationTimersRef.current.forEach((timer) =>
                clearTimeout(timer)
            ),
        []
    )

    const clearConfirmationTimers = (): void => {
        confirmationTimersRef.current.forEach((timer) => clearTimeout(timer))
        confirmationTimersRef.current = []
    }

    // Show the confirmation, hold it briefly, then fade it out and remove it
    const showConfirmation = (description: string): void => {
        clearConfirmationTimers()
        setConfirmation(description)
        setIsConfirmationFading(false)
        confirmationTimersRef.current = [
            window.setTimeout(
                () => setIsConfirmationFading(true),
                CONFIRMATION_HOLD_MS
            ),
            window.setTimeout(() => {
                setConfirmation(undefined)
                setIsConfirmationFading(false)
            }, CONFIRMATION_HOLD_MS + CONFIRMATION_FADE_MS),
        ]
    }

    // Apply a view to the chart, confirm it, and offer follow-up options
    // that make sense as a next step from the now-current view
    const applyView = (
        view: AssistantView,
        params: GrapherQueryParams,
        description: string
    ): void => {
        runInAction(() => manager.populateFromQueryParams(params))
        setHasSubmitted(true)
        setOptions(undefined)
        setNote(undefined)
        showConfirmation(description)
        // Build the context after applying so follow-ups reflect the new view
        setFollowUps(
            buildFollowUpOptions(view, buildAssistantContext(manager)).slice(
                0,
                MAX_FOLLOW_UP_OPTIONS
            )
        )
    }

    const submitQuery = async (): Promise<void> => {
        const query = inputValue.trim()
        if (!query) return
        const requestId = ++requestIdRef.current

        setHasSubmitted(true)
        setIsPending(true)
        clearConfirmationTimers()
        setConfirmation(undefined)
        setIsConfirmationFading(false)
        setOptions(undefined)
        setFollowUps(undefined)
        setNote(undefined)

        const context = buildAssistantContext(manager)
        const response = await backendRef.current!.respond(query, context)

        // Ignore responses that were superseded by a newer query
        if (requestId !== requestIdRef.current) return
        setIsPending(false)

        if (response.kind === "apply") {
            applyView(response.view, response.params, response.description)
        } else {
            setOptions(response.options)
            setNote(response.note)
        }
    }

    const handleOptionClick = (option: AssistantViewOption): void => {
        applyView(option.view, option.params, option.description)
    }

    // Before the first query (and while idle), offer default views that are
    // derived from the chart's actual entities, tabs and times
    const showDefaultOptions =
        !isPending && !confirmation && !options && !followUps && !hasSubmitted
    const displayedOptions = showDefaultOptions
        ? buildDefaultOptions(buildAssistantContext(manager)).slice(
              0,
              MAX_DEFAULT_OPTIONS
          )
        : options

    const renderOptionList = (
        optionList: AssistantViewOption[]
    ): React.ReactElement => (
        <ul className="assistant-panel__options">
            {optionList.map((option) => (
                <li key={`${option.headline}-${option.description}`}>
                    <button
                        type="button"
                        className="assistant-panel__option"
                        data-track-note="assistant_option"
                        onClick={(): void => handleOptionClick(option)}
                    >
                        <span className="assistant-panel__option-headline">
                            {option.headline}
                        </span>
                        <span className="assistant-panel__option-mapping">
                            {option.description}
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    )

    return (
        <div className="assistant-panel">
            <div className="assistant-panel__header">
                <FontAwesomeIcon
                    className="assistant-panel__title-icon"
                    icon={faWandMagicSparkles}
                />
                <span className="assistant-panel__title">AI assistant</span>
                <span className="assistant-panel__beta-tag">Beta</span>
            </div>
            <form
                className="assistant-panel__form"
                onSubmit={(event): void => {
                    event.preventDefault()
                    void submitQuery()
                }}
            >
                <SearchField
                    className="assistant-panel__input"
                    value={inputValue}
                    placeholder="Describe a view of this chart"
                    icon={faWandMagicSparkles}
                    trackNote="assistant_query_input"
                    onChange={setInputValue}
                    onClear={(): void => setInputValue("")}
                />
            </form>
            <div className="assistant-panel__outputs">
                {isPending && (
                    <div
                        className="assistant-panel__pending"
                        aria-live="polite"
                    >
                        Matching your request to a chart view…
                    </div>
                )}
                {confirmation && (
                    <div
                        className={cx("assistant-panel__confirmation", {
                            "assistant-panel__confirmation--fading":
                                isConfirmationFading,
                        })}
                        aria-live="polite"
                    >
                        <FontAwesomeIcon
                            className="assistant-panel__confirmation-icon"
                            icon={faCheck}
                        />
                        <span>
                            <strong>Applied:</strong> {confirmation}
                        </span>
                    </div>
                )}
                {note && <div className="assistant-panel__note">{note}</div>}
                {displayedOptions && displayedOptions.length > 0 && (
                    <>
                        {!note && (
                            <div className="assistant-panel__options-label">
                                {showDefaultOptions
                                    ? "Try one of these views:"
                                    : "Did you mean:"}
                            </div>
                        )}
                        {renderOptionList(displayedOptions)}
                    </>
                )}
                {followUps && followUps.length > 0 && (
                    <>
                        <div className="assistant-panel__options-label">
                            Keep exploring:
                        </div>
                        {renderOptionList(followUps)}
                    </>
                )}
            </div>
        </div>
    )
})
