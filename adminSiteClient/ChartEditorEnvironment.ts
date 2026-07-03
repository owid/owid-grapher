import * as _ from "lodash-es"
import {
    observable,
    computed,
    runInAction,
    action,
    reaction,
    IReactionDisposer,
    makeObservable,
    comparer,
} from "mobx"
import {
    DetailDictionary,
    extractDetailsFromSyntax,
    getIndexableKeys,
} from "@ourworldindata/utils"
import {
    GrapherInterface,
    GrapherQueryParams,
    DimensionProperty,
    ORIGIN_URL_REGEX_PATTERNS,
} from "@ourworldindata/types"
import { initializeDetailsOnDemand } from "@ourworldindata/components"
import {
    GrapherState,
    hasValidConfigForBinningStrategy,
} from "@ourworldindata/grapher"
import { Admin } from "./Admin.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import {
    ErrorMessages,
    ErrorMessagesForDimensions,
    FieldWithDetailReferences,
} from "./ChartEditorTypes.js"

import { Dataset, EditorDatabase } from "./EditorDatabase.js"

// Re-exported for compatibility: these used to be defined in this module
// (and in ChartEditorView before that).
export { EditorDatabase } from "./EditorDatabase.js"
export type { Dataset, Namespace, NamespaceData } from "./EditorDatabase.js"

export type DetailReferences = Record<FieldWithDetailReferences, string[]>

export interface ChartEditorEnvironmentManager<Editor> {
    admin: Admin
    editor: Editor
    /**
     * Query params to apply to the grapher once, after the initial data load.
     * Used when creating a narrative chart from a customized chart, so that the
     * editor opens on the state the user was looking at. Managers that don't
     * set it get the authored config as before.
     */
    initialQueryParams?: GrapherQueryParams
}

/**
 * Editor-session state shared by every host of the chart editor form
 * (the standalone ChartEditorView pages and the rich editor's embedded
 * panel): the dataset/variable database, the details-on-demand dictionary,
 * validation error messages, and the reactions that keep the editor's
 * grapherState in sync with its config. Hosts own bounds and rendering.
 */
export class ChartEditorEnvironment<Editor extends AbstractChartEditor> {
    database = new EditorDatabase({})
    details: DetailDictionary = {}

    private readonly manager: ChartEditorEnvironmentManager<Editor>
    private readonly onGrapherUpdated?: () => void
    private readonly disposers: IReactionDisposer[] = []
    private _isDbSet = false
    private hasAppliedInitialQueryParams = false
    private cleanupDetailsOnDemand: (() => void) | undefined

    constructor(props: {
        manager: ChartEditorEnvironmentManager<Editor>
        /** called after the grapher was (re)initialized from the editor's config */
        onGrapherUpdated?: () => void
    }) {
        makeObservable<ChartEditorEnvironment<Editor>, "_isDbSet">(this, {
            database: observable.ref,
            details: observable,
            _isDbSet: observable,
        })
        this.manager = props.manager
        this.onGrapherUpdated = props.onGrapherUpdated
    }

    @computed get grapherState(): GrapherState {
        return this.manager.editor.grapherState
    }

    @computed get isReady(): boolean {
        return this._isDbSet
    }

    @computed get editor(): Editor | undefined {
        if (!this.isReady) return undefined

        return this.manager.editor
    }

    @action.bound async updateGrapher(): Promise<void> {
        // the embedded host's editor is created asynchronously (and cleared
        // between editing sessions), so it can legitimately be absent here
        if (!this.manager.editor) return
        const config = this.manager.editor.originalGrapherConfig
        this.manager.editor.grapherState.updateFromObject(config)
        await this.manager.editor.reloadGrapherData()
        this.onGrapherUpdated?.()

        // Applied after the data load because the time bounds are snapped to
        // the available times and the entity selection is gated on
        // `addCountryMode`. Applied at most once: `updateGrapher` re-runs
        // whenever the editor changes, and re-applying would overwrite edits
        // made in the editor since.
        const { initialQueryParams } = this.manager
        if (initialQueryParams && !this.hasAppliedInitialQueryParams) {
            this.hasAppliedInitialQueryParams = true
            this.grapherState.populateFromQueryParams(initialQueryParams)
        }
    }

    @action.bound private setDb(json: any): void {
        this.database = new EditorDatabase(json)
        this._isDbSet = true
    }

    async fetchData(): Promise<void> {
        const { admin } = this.manager

        const [namespaces, variables] = await Promise.all([
            admin.getJSON(`/api/editorData/namespaces.json`),
            admin.getJSON(`/api/editorData/variables.json`),
        ])

        this.setDb(namespaces)

        const groupedByNamespace = _.groupBy(
            variables.datasets,
            (d) => d.namespace
        )
        for (const namespace in groupedByNamespace) {
            this.database.dataByNamespace.set(namespace, {
                datasets: groupedByNamespace[namespace] as Dataset[],
            })
        }

        const usageData = await admin.getJSON<
            {
                variableId: number
                usageCount: number
            }[]
        >(`/api/variables.usages.json`)
        this.database.variableUsageCounts = new Map(
            usageData.map(({ variableId, usageCount }) => [
                variableId,
                +usageCount,
            ])
        )
    }

    async fetchDetails(): Promise<void> {
        const details = await this.manager.admin.getJSON<DetailDictionary>(
            "/api/parsed-dods.json"
        )

        this.cleanupDetailsOnDemand = initializeDetailsOnDemand({ details })

        runInAction(() => {
            this.details = details
        })
    }

    @action.bound refresh(): void {
        void this.fetchDetails()
        void this.fetchData()
    }

    /** fetch data and register the reactions that keep grapherState in sync */
    start(): void {
        this.refresh()
        this.disposers.push(
            reaction(
                () => this.editor,
                () => {
                    void this.updateGrapher()
                }
            )
        )
        this.disposers.push(
            reaction(
                () => this.editor?.fullConfig,
                () => {
                    // Update the authoredVersion, as it's being used for "author's minTime & maxTime" in some places.
                    if (this.editor?.fullConfig)
                        this.editor?.grapherState.setAuthoredVersion(
                            this.editor?.fullConfig
                        )
                },
                { equals: comparer.structural }
            )
        )
    }

    dispose(): void {
        this.disposers.forEach((dispose) => dispose())
        this.disposers.length = 0
        this.cleanupDetailsOnDemand?.()
        this.cleanupDetailsOnDemand = undefined
    }

    // unvalidated terms extracted from the subtitle and note fields
    // these may point to non-existent details e.g. ["not_a_real_term", "pvotery"]
    @computed
    get currentDetailReferences(): DetailReferences {
        const { grapherState } = this.manager.editor
        return {
            subtitle: extractDetailsFromSyntax(grapherState.effectiveSubtitle),
            note: extractDetailsFromSyntax(grapherState.note ?? ""),
            axisLabelX: extractDetailsFromSyntax(
                grapherState.xAxisConfig.label ?? ""
            ),
            axisLabelY: extractDetailsFromSyntax(
                grapherState.yAxisConfig.label ?? ""
            ),
        }
    }

    // the actual Detail objects, indexed by category.term
    @computed get currentlyReferencedDetails(): GrapherInterface["details"] {
        const grapherConfigDetails: GrapherInterface["details"] = {}
        const allReferences = Object.values(this.currentDetailReferences).flat()

        allReferences.forEach((term) => {
            const detail = _.get(this.details, term)
            if (detail) {
                _.set(grapherConfigDetails, term, detail)
            }
        })

        return grapherConfigDetails
    }

    @computed
    get invalidDetailReferences(): DetailReferences {
        const { subtitle, note, axisLabelX, axisLabelY } =
            this.currentDetailReferences
        return {
            subtitle: subtitle.filter((term) => !this.details[term]),
            note: note.filter((term) => !this.details[term]),
            axisLabelX: axisLabelX.filter((term) => !this.details[term]),
            axisLabelY: axisLabelY.filter((term) => !this.details[term]),
        }
    }

    @computed get errorMessages(): ErrorMessages {
        const { invalidDetailReferences } = this

        const errorMessages: ErrorMessages = {}

        // add error messages for each field with invalid detail references
        getIndexableKeys(invalidDetailReferences).forEach(
            (key: FieldWithDetailReferences) => {
                const references = invalidDetailReferences[key]
                if (references.length) {
                    errorMessages[key] =
                        `Invalid DoD(s) specified: ${references.join(", ")}`
                }
            }
        )

        // add an error message if any focused series names are invalid
        const { invalidFocusedSeriesNames = [] } = this.editor ?? {}
        if (invalidFocusedSeriesNames.length > 0) {
            const invalidNames = invalidFocusedSeriesNames.join(", ")
            const message = `Invalid focus state. The following entities/indicators are not plotted: ${invalidNames}`
            errorMessages.focusedSeriesNames = message
        }

        // Check the two colorScale configs (esp. binning strategies) for any errors
        const colorScaleKeys = ["colorScale", "map.colorScale"] as const
        colorScaleKeys.forEach((key) => {
            const colorScaleConfig = _.get(this.grapherState, key)

            if (colorScaleConfig.binningStrategy === "manual") return

            const validationResult = hasValidConfigForBinningStrategy(
                colorScaleConfig.binningStrategy,
                colorScaleConfig
            )
            if (!validationResult.valid) {
                errorMessages[`${key}.${validationResult.field}`] =
                    validationResult.reason
            }
        })

        if (
            this.grapherState.originUrl &&
            !ORIGIN_URL_REGEX_PATTERNS.some((regex) =>
                regex.test(this.grapherState.originUrl ?? "")
            )
        ) {
            errorMessages.originUrl =
                "Invalid origin URL. If it's a relative URL, make sure it starts with /"
        }

        return errorMessages
    }

    @computed
    get errorMessagesForDimensions(): ErrorMessagesForDimensions {
        const errorMessages: ErrorMessagesForDimensions = {
            [DimensionProperty.y]: [],
            [DimensionProperty.x]: [],
            [DimensionProperty.color]: [],
            [DimensionProperty.size]: [],
            [DimensionProperty.table]: [], // not used
        }

        this.grapherState.dimensionSlots.forEach((slot) => {
            slot.dimensions.forEach((dimension, dimensionIndex) => {
                const details = extractDetailsFromSyntax(
                    dimension.display.name ?? ""
                )
                const hasDetailsInDisplayName = details.length > 0

                // add error message if details are referenced in the display name
                if (hasDetailsInDisplayName) {
                    errorMessages[slot.property][dimensionIndex] =
                        `Detail syntax is not supported for display names of indicators: ${dimension.display.name}`
                }
            })
        })

        return errorMessages
    }
}
