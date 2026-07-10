import * as React from "react"
import { useRef, useState } from "react"
import { observer } from "mobx-react"
import { runInAction } from "mobx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCheck } from "@fortawesome/free-solid-svg-icons"
import {
    ColumnSlug,
    EntityName,
    GrapherQueryParams,
    GrapherTabName,
    Time,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { SelectionArray } from "../selection/SelectionArray"
import { groupEntitiesByRegionType } from "../core/RegionGroups"
import { SearchField } from "../controls/SearchField"
import {
    AssistantBackend,
    AssistantChartContext,
    AssistantViewOption,
    MockAssistantBackend,
    buildDefaultOptions,
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
    return {
        availableEntityNames: manager.inputTable.availableEntityNames,
        availableTabs: manager.availableTabs,
        activeTab: manager.activeTab,
        availableTimes,
        selectedEntityNames: manager.selection.selectedEntityNames,
        latestValueByEntityName: computeLatestValuesByCountry(manager),
    }
}

/**
 * Latest data value per country entity (used for "top/bottom N" queries).
 * Aggregates like "Africa" or "World" are excluded so rankings are
 * country-to-country comparisons.
 */
function computeLatestValuesByCountry(
    manager: AssistantPanelManager
): Map<EntityName, number> {
    const latestValues = new Map<EntityName, number>()
    const columnSlug = manager.yColumnSlugs[0]
    if (!columnSlug) return latestValues

    const column = manager.inputTable.get(columnSlug)
    const regionGroups = groupEntitiesByRegionType(
        manager.inputTable.availableEntityNames
    )
    const countryEntities = new Set(
        regionGroups.find((group) => group.regionGroupKey === "countries")
            ?.entityNames ?? []
    )

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

export const AssistantPanel = observer(function AssistantPanel({
    manager,
}: {
    manager: AssistantPanelManager
}): React.ReactElement {
    const [inputValue, setInputValue] = useState("")
    const [isPending, setIsPending] = useState(false)
    const [confirmation, setConfirmation] = useState<string | undefined>()
    const [options, setOptions] = useState<AssistantViewOption[] | undefined>()
    const [note, setNote] = useState<string | undefined>()
    const [hasSubmitted, setHasSubmitted] = useState(false)
    const requestIdRef = useRef(0)
    const backendRef = useRef<AssistantBackend>(undefined)
    backendRef.current ??= new MockAssistantBackend()

    const applyParams = (params: GrapherQueryParams): void => {
        runInAction(() => manager.populateFromQueryParams(params))
    }

    const submitQuery = async (): Promise<void> => {
        const query = inputValue.trim()
        if (!query) return
        const requestId = ++requestIdRef.current

        setHasSubmitted(true)
        setIsPending(true)
        setConfirmation(undefined)
        setOptions(undefined)
        setNote(undefined)

        const context = buildAssistantContext(manager)
        const response = await backendRef.current!.respond(query, context)

        // Ignore responses that were superseded by a newer query
        if (requestId !== requestIdRef.current) return
        setIsPending(false)

        if (response.kind === "apply") {
            applyParams(response.params)
            setConfirmation(response.description)
        } else {
            setOptions(response.options)
            setNote(response.note)
        }
    }

    const handleOptionClick = (option: AssistantViewOption): void => {
        applyParams(option.params)
        setHasSubmitted(true)
        setConfirmation(option.description)
        setOptions(undefined)
        setNote(undefined)
    }

    // Before the first query (and while idle), offer default views that are
    // derived from the chart's actual entities, tabs and times
    const showDefaultOptions =
        !isPending && !confirmation && !options && !hasSubmitted
    const displayedOptions = showDefaultOptions
        ? buildDefaultOptions(buildAssistantContext(manager))
        : options

    return (
        <div className="assistant-panel">
            <div className="assistant-panel__header">
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
                    trackNote="assistant_query_input"
                    onChange={setInputValue}
                    onClear={(): void => setInputValue("")}
                />
            </form>
            <div className="assistant-panel__outputs">
                <div className="assistant-panel__outputs-inner">
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
                            className="assistant-panel__confirmation"
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
                    {note && (
                        <div className="assistant-panel__note">{note}</div>
                    )}
                    {displayedOptions && displayedOptions.length > 0 && (
                        <>
                            {!note && (
                                <div className="assistant-panel__options-label">
                                    {showDefaultOptions
                                        ? "Try one of these views:"
                                        : "Did you mean:"}
                                </div>
                            )}
                            <ul className="assistant-panel__options">
                                {displayedOptions.map((option) => (
                                    <li key={option.description}>
                                        <button
                                            type="button"
                                            className="assistant-panel__option"
                                            data-track-note="assistant_option"
                                            onClick={(): void =>
                                                handleOptionClick(option)
                                            }
                                        >
                                            {option.description}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
})
