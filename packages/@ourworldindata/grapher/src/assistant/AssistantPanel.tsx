import * as React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
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
import { Bounds } from "@ourworldindata/utils"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { SelectionArray } from "../selection/SelectionArray"
import { groupEntitiesByRegionType } from "../core/RegionGroups"
import { SearchField } from "../controls/SearchField"
import { Modal } from "../modal/Modal"
import { DEFAULT_GRAPHER_BOUNDS } from "../core/GrapherConstants"
import {
    AssistantBackend,
    AssistantChartContext,
    AssistantResponse,
    AssistantTrailingChange,
    AssistantView,
    AssistantViewOption,
    MockAssistantBackend,
    buildDefaultOptions,
    buildFollowUpOptions,
} from "./AssistantBackend"
import {
    CLAUDE_INVALID_KEY_NOTICE,
    ClaudeAssistantBackend,
    ClaudeInvalidKeyError,
    clearStoredClaudeApiKey,
    readDemoModeChoice,
    readStoredClaudeApiKey,
    rememberDemoModeChoice,
    storeClaudeApiKey,
} from "./ClaudeAssistantBackend"

export interface AssistantPanelManager {
    availableTabs: GrapherTabName[]
    activeTab: GrapherTabName
    times: Time[]
    selection: SelectionArray
    yColumnSlugs: ColumnSlug[]
    inputTable: OwidTable
    populateFromQueryParams: (params: GrapherQueryParams) => void
    displayTitle?: string
    currentSubtitle?: string
    frameBounds?: Bounds
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
        chartTitle: manager.displayTitle,
        chartSubtitle: manager.currentSubtitle,
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

/** State of the internal-demo API key modal */
type KeyModalState = "closed" | "connect" | "invalid-key"

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
    /** Canned backend-status line (e.g. "using demo matcher"), never prose */
    const [notice, setNotice] = useState<string | undefined>()
    const [hasSubmitted, setHasSubmitted] = useState(false)
    // Claude connection state. The key lives in localStorage so it survives
    // reloads; it is never rendered back into the DOM after saving.
    const [claudeKey, setClaudeKey] = useState<string | undefined>(() =>
        readStoredClaudeApiKey()
    )
    const [keyModalState, setKeyModalState] = useState<KeyModalState>("closed")
    const [keyDraft, setKeyDraft] = useState("")
    /** Query submitted while the key modal was open, run after a choice */
    const [pendingQuery, setPendingQuery] = useState<string | undefined>()
    const requestIdRef = useRef(0)
    const confirmationTimersRef = useRef<number[]>([])

    const mockBackend = useMemo(() => new MockAssistantBackend(), [])
    const backend = useMemo<AssistantBackend>(
        () => (claudeKey ? new ClaudeAssistantBackend(claudeKey) : mockBackend),
        [claudeKey, mockBackend]
    )

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
        description: string,
        backendFollowUps?: AssistantViewOption[]
    ): void => {
        runInAction(() => manager.populateFromQueryParams(params))
        setHasSubmitted(true)
        setOptions(undefined)
        setNote(undefined)
        showConfirmation(description)
        // Prefer validated backend-suggested follow-ups; otherwise build
        // deterministic ones from the context after applying the view
        const effectiveFollowUps =
            backendFollowUps && backendFollowUps.length > 0
                ? backendFollowUps
                : buildFollowUpOptions(view, buildAssistantContext(manager))
        setFollowUps(effectiveFollowUps.slice(0, MAX_FOLLOW_UP_OPTIONS))
    }

    const runQuery = async (
        query: string,
        queryBackend: AssistantBackend
    ): Promise<void> => {
        const requestId = ++requestIdRef.current

        setHasSubmitted(true)
        setIsPending(true)
        clearConfirmationTimers()
        setConfirmation(undefined)
        setIsConfirmationFading(false)
        setOptions(undefined)
        setFollowUps(undefined)
        setNote(undefined)
        setNotice(undefined)

        const context = buildAssistantContext(manager)
        let response: AssistantResponse
        try {
            response = await queryBackend.respond(query, context)
        } catch (error) {
            // Ignore responses that were superseded by a newer query
            if (requestId !== requestIdRef.current) return
            setIsPending(false)
            if (error instanceof ClaudeInvalidKeyError) {
                // The stored key is invalid: forget it and re-open the modal
                // so the user can paste a fresh one (or use demo responses)
                clearStoredClaudeApiKey()
                setClaudeKey(undefined)
                setPendingQuery(query)
                setKeyModalState("invalid-key")
            }
            return
        }

        if (requestId !== requestIdRef.current) return
        setIsPending(false)

        if (response.kind === "apply") {
            applyView(
                response.view,
                response.params,
                response.description,
                response.followUps
            )
        } else {
            setOptions(response.options)
            setNote(response.note)
        }
        setNotice(response.notice)
    }

    const submitQuery = async (): Promise<void> => {
        const query = inputValue.trim()
        if (!query) return
        // Without a connected key (and no explicit "demo responses" choice
        // this session), ask for one via the internal-demo modal first
        if (!claudeKey && !readDemoModeChoice()) {
            setPendingQuery(query)
            setKeyDraft("")
            setKeyModalState("connect")
            return
        }
        await runQuery(query, backend)
    }

    const handleOptionClick = (option: AssistantViewOption): void => {
        setNotice(undefined)
        applyView(option.view, option.params, option.description)
    }

    // --- internal-demo key modal actions ---------------------------------

    const resumePendingQuery = (queryBackend: AssistantBackend): void => {
        const query = pendingQuery
        setPendingQuery(undefined)
        if (query) void runQuery(query, queryBackend)
    }

    const connectClaude = (): void => {
        const key = keyDraft.trim()
        if (!key) return
        storeClaudeApiKey(key)
        setClaudeKey(key)
        // The key is never rendered back into the DOM after saving
        setKeyDraft("")
        setKeyModalState("closed")
        resumePendingQuery(new ClaudeAssistantBackend(key))
    }

    const useDemoResponses = (): void => {
        // Remember the choice for this session so we don't re-prompt on
        // every query; a fresh visit prompts again
        rememberDemoModeChoice()
        setKeyDraft("")
        setKeyModalState("closed")
        resumePendingQuery(mockBackend)
    }

    // Escape / outside click: answer the query with the demo matcher, but
    // don't remember the choice — the next query prompts again
    const dismissKeyModal = (): void => {
        setKeyDraft("")
        setKeyModalState("closed")
        resumePendingQuery(mockBackend)
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

    // The key modal is centered over the grapher frame, matching the
    // entity selector modal's sizing approach
    const frameBounds = manager.frameBounds ?? DEFAULT_GRAPHER_BOUNDS
    const keyModalMaxWidth = 420
    const keyModalBounds = frameBounds
        .padHeight(24)
        .padWidth(Math.max(16, (frameBounds.width - keyModalMaxWidth) / 2))

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
                {notice && (
                    <div className="assistant-panel__notice" aria-live="polite">
                        {notice}
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
            {keyModalState !== "closed" && (
                <Modal bounds={keyModalBounds} onDismiss={dismissKeyModal}>
                    <div className="assistant-key-modal">
                        <h3 className="assistant-key-modal__title">
                            Internal demo setup
                        </h3>
                        <p className="assistant-key-modal__text">
                            This dialog isn&rsquo;t part of the prototype. To
                            power the assistant for this internal demo, paste an
                            Anthropic API key &mdash; it&rsquo;s stored only in
                            your browser.
                        </p>
                        {keyModalState === "invalid-key" && (
                            <p className="assistant-key-modal__error">
                                {CLAUDE_INVALID_KEY_NOTICE}
                            </p>
                        )}
                        <form
                            className="assistant-key-modal__form"
                            onSubmit={(event): void => {
                                event.preventDefault()
                                connectClaude()
                            }}
                        >
                            <input
                                className="assistant-key-modal__input"
                                type="password"
                                autoComplete="off"
                                autoFocus
                                placeholder="Anthropic API key (sk-ant-…)"
                                value={keyDraft}
                                onChange={(event): void =>
                                    setKeyDraft(event.target.value)
                                }
                            />
                            <div className="assistant-key-modal__actions">
                                <button
                                    type="submit"
                                    className="assistant-key-modal__connect"
                                    disabled={!keyDraft.trim()}
                                    data-track-note="assistant_connect_claude"
                                >
                                    Connect
                                </button>
                                <button
                                    type="button"
                                    className="assistant-key-modal__demo"
                                    onClick={useDemoResponses}
                                    data-track-note="assistant_demo_responses"
                                >
                                    Use demo responses
                                </button>
                            </div>
                        </form>
                    </div>
                </Modal>
            )}
        </div>
    )
})
