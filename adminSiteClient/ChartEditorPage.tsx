import React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    runInAction,
    action,
    makeObservable,
    toJS,
} from "mobx"
import {
    getParentVariableIdFromChartConfig,
    RawPageview,
} from "@ourworldindata/utils"
import {
    GrapherInterface,
    ChartRedirect,
    MinimalTagWithIsTopic,
    DbChartTagJoin,
    VariableDisplayDimension,
    MultiDimDataPageConfigRaw,
} from "@ourworldindata/types"
import { Admin } from "./Admin.js"
import {
    ChartEditor,
    Log,
    ChartEditorManager,
    fetchMergedGrapherConfigByVariableId,
} from "./ChartEditor.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ChartEditorView, ChartEditorViewManager } from "./ChartEditorView.js"
import { References } from "./AbstractChartEditor.js"

// Helper to generate a unique key for a dimension combination
function getDimensionKey(dimensions: Record<string, string>): string {
    return Object.entries(dimensions)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&")
}

export interface MultidimRelatedVariable {
    id: number
    name: string
    dimensions: VariableDisplayDimension
}

export interface MultidimData {
    currentVariable: MultidimRelatedVariable & { datasetId: number }
    relatedVariables: MultidimRelatedVariable[]
    dimensionChoices: Record<string, string[]>
}

interface ChartEditorPageProps {
    grapherId?: number
    grapherConfig?: GrapherInterface
    multidimVariableId?: number
}

@observer
export class ChartEditorPage
    extends React.Component<ChartEditorPageProps>
    implements ChartEditorManager, ChartEditorViewManager<ChartEditor>
{
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    constructor(props: ChartEditorPageProps) {
        super(props)

        makeObservable(this, {
            logs: observable,
            references: observable,
            redirects: observable,
            pageviews: observable,
            tags: observable,
            availableTags: observable,
            multidimData: observable,
            selectedDimensions: observable,
            patchConfig: observable,
            viewConfigs: observable,
        })
    }

    logs: Log[] = []
    references: References | undefined = undefined
    redirects: ChartRedirect[] = []
    pageviews: RawPageview | undefined = undefined
    tags: DbChartTagJoin[] | undefined = undefined
    availableTags: MinimalTagWithIsTopic[] | undefined = undefined

    patchConfig: GrapherInterface = {}
    parentConfig: GrapherInterface | undefined = undefined

    isInheritanceEnabled: boolean | undefined = undefined

    // Multidimensional variable data
    multidimData: MultidimData | undefined = undefined
    selectedDimensions: Record<string, string> = {}

    // Store configs for each dimension combination (for multidim mode)
    viewConfigs: Map<string, GrapherInterface> = new Map()

    get isMultidimMode(): boolean {
        return this.multidimData !== undefined
    }

    async fetchGrapherConfig(): Promise<void> {
        const { grapherId, grapherConfig } = this.props
        if (grapherId !== undefined) {
            this.patchConfig = await this.context.admin.getJSON(
                `/api/charts/${grapherId}.patchConfig.json`
            )
        } else if (grapherConfig) {
            this.patchConfig = grapherConfig
        }

        // After loading config, check if we should enter multidim mode
        // by detecting if the variable has dimensions
        await this.tryFetchMultidimData()
    }

    // Get the primary variable ID from the current config
    private getPrimaryVariableId(): number | undefined {
        const dims = this.patchConfig?.dimensions
        if (dims && dims.length > 0) {
            return dims[0].variableId
        }
        return undefined
    }

    async fetchParentConfig(): Promise<void> {
        const { grapherId, grapherConfig } = this.props
        if (grapherId !== undefined) {
            const parent = await this.context.admin.getJSON(
                `/api/charts/${grapherId}.parent.json`
            )
            this.parentConfig = parent?.config
            this.isInheritanceEnabled = parent?.isActive ?? true
        } else if (grapherConfig) {
            const parentIndicatorId =
                getParentVariableIdFromChartConfig(grapherConfig)
            if (parentIndicatorId) {
                this.parentConfig = await fetchMergedGrapherConfigByVariableId(
                    this.context.admin,
                    parentIndicatorId
                )
            }
            this.isInheritanceEnabled = true
        } else {
            this.isInheritanceEnabled = true
        }
    }

    async fetchLogs(): Promise<void> {
        const { grapherId } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? {}
                : await admin.getJSON(`/api/charts/${grapherId}.logs.json`)
        runInAction(() => (this.logs = json.logs))
    }

    async fetchRefs(): Promise<void> {
        const { grapherId } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? {}
                : await admin.getJSON(
                      `/api/charts/${grapherId}.references.json`
                  )
        runInAction(() => (this.references = json.references))
    }

    async fetchRedirects(): Promise<void> {
        const { grapherId } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? {}
                : await admin.getJSON(`/api/charts/${grapherId}.redirects.json`)
        runInAction(() => (this.redirects = json.redirects))
    }

    async fetchPageviews(): Promise<void> {
        const { grapherId } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? {}
                : await admin.getJSON(`/api/charts/${grapherId}.pageviews.json`)
        runInAction(() => (this.pageviews = json.pageviews))
    }

    async fetchTags(): Promise<void> {
        const { grapherId } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? {}
                : await admin.getJSON(`/api/charts/${grapherId}.tags.json`)
        runInAction(() => (this.tags = json.tags))
    }

    async fetchAvailableTags() {
        const json = (await this.admin.getJSON("/api/tags.json")) as any
        this.availableTags = json.tags
    }

    async tryFetchMultidimData(): Promise<void> {
        // Get variable ID from props or from the grapher config
        const variableId =
            this.props.multidimVariableId ?? this.getPrimaryVariableId()
        if (variableId === undefined) return

        const { admin } = this.context
        const json = await admin.getJSON(
            `/api/variables/${variableId}/related.json`
        )

        if ("error" in json) {
            // Not an error - just means this variable doesn't have related dimensions
            console.log("No multidim data for variable:", variableId)
            return
        }

        // Only enter multidim mode if there are related variables (more than just the current one)
        if (
            !json.relatedVariables ||
            json.relatedVariables.length <= 1 ||
            !json.currentVariable?.dimensions?.originalShortName
        ) {
            console.log("Variable doesn't have multidim siblings")
            return
        }

        runInAction(() => {
            this.multidimData = json as MultidimData
            // Initialize selected dimensions from current variable
            const initialDimensions: Record<string, string> = {}
            for (const filter of json.currentVariable.dimensions.filters) {
                initialDimensions[filter.name] = filter.value
            }
            this.selectedDimensions = initialDimensions
        })
    }

    @action.bound handleDimensionChange(name: string, value: string): void {
        // Save current config to viewConfigs before switching
        const currentKey = getDimensionKey(this.selectedDimensions)
        if (currentKey) {
            this.viewConfigs.set(currentKey, toJS(this.patchConfig))
        }

        // Update selected dimensions
        const newDimensions = {
            ...this.selectedDimensions,
            [name]: value,
        }
        this.selectedDimensions = newDimensions

        // Find the matching variable for the new dimensions
        const matchingVariable = this.multidimData?.relatedVariables.find((v) =>
            v.dimensions.filters.every((f) => newDimensions[f.name] === f.value)
        )

        if (matchingVariable) {
            const newKey = getDimensionKey(newDimensions)

            // Check if we have a saved config for this dimension combination
            const savedConfig = this.viewConfigs.get(newKey)

            if (savedConfig) {
                // Load the saved config
                this.patchConfig = savedConfig
            } else {
                // Create a new config with the matching variable
                this.patchConfig = {
                    ...this.patchConfig,
                    // Reset view-specific properties to defaults
                    title: undefined,
                    subtitle: undefined,
                    note: undefined,
                    // Set the new variable
                    dimensions: [
                        {
                            variableId: matchingVariable.id,
                            property: "y" as const,
                        },
                    ],
                }
            }
        }
    }

    // Get the variable ID for a given dimension combination
    private getVariableForDimensions(
        dimensions: Record<string, string>
    ): MultidimRelatedVariable | undefined {
        return this.multidimData?.relatedVariables.find((v) =>
            v.dimensions.filters.every((f) => dimensions[f.name] === f.value)
        )
    }

    // Generate the full multidim config for saving
    generateMultidimConfig(): MultiDimDataPageConfigRaw | undefined {
        if (!this.multidimData) return undefined

        // Save current config first (always save, even if key is empty)
        const currentKey = getDimensionKey(this.selectedDimensions)
        this.viewConfigs.set(currentKey, toJS(this.patchConfig))

        // Build dimensions array from dimensionChoices
        const dimensions = Object.entries(
            this.multidimData.dimensionChoices
        ).map(([name, values]) => ({
            slug: name,
            name: name,
            choices: values.map((value) => ({
                slug: value,
                name: value,
            })),
        }))

        // Build views array - one for each related variable
        const views = this.multidimData.relatedVariables.map((variable) => {
            // Build the dimension key for this variable
            const dimChoices: Record<string, string> = {}
            for (const filter of variable.dimensions.filters) {
                dimChoices[filter.name] = filter.value
            }
            const viewKey = getDimensionKey(dimChoices)

            // Get saved config for this view, or use default
            const savedConfig = this.viewConfigs.get(viewKey) || {}

            return {
                dimensions: dimChoices,
                indicators: {
                    y: [{ id: variable.id, display: {} }],
                },
                config: {
                    title: savedConfig.title,
                    subtitle: savedConfig.subtitle,
                    note: savedConfig.note,
                    chartTypes: savedConfig.chartTypes,
                    hasMapTab: savedConfig.hasMapTab,
                },
            }
        })

        const config: MultiDimDataPageConfigRaw = {
            title: {
                title:
                    this.multidimData.currentVariable.dimensions
                        .originalShortName || "Untitled",
            },
            dimensions,
            views,
        }

        console.log("Generated multidim config:", config)
        console.log("Number of views:", views.length)
        console.log("Dimensions:", dimensions)

        return config
    }

    @action.bound async saveAsMultidim(): Promise<void> {
        const config = this.generateMultidimConfig()
        if (!config || !this.multidimData) {
            console.error("No multidim config to save")
            alert("Cannot save: no multidim data available")
            return
        }

        // Validate we have at least one view with indicators
        if (config.views.length === 0) {
            console.error("No views to save")
            alert("Cannot save: no views generated")
            return
        }

        const hasEmptyIndicators = config.views.some(
            (v) => !v.indicators.y || v.indicators.y.length === 0
        )
        if (hasEmptyIndicators) {
            console.error("Some views have no indicators")
            alert("Cannot save: some views have no indicators")
            return
        }

        // Generate a catalogPath from the dataset info
        // Format: grapher/admin#<originalShortName>
        // Use snake_case sanitized version of originalShortName
        const originalShortName =
            this.multidimData.currentVariable.dimensions.originalShortName
        if (!originalShortName) {
            console.error("No originalShortName found")
            alert("Cannot save: variable has no originalShortName")
            return
        }

        // Sanitize for catalog path: only allow alphanumeric, underscores, hyphens
        const sanitizedName = originalShortName
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "_")
        const catalogPath = `grapher/admin#${sanitizedName}`

        console.log("Saving multidim with catalogPath:", catalogPath)
        console.log("Config:", JSON.stringify(config, null, 2))

        try {
            const response = await this.admin.requestJSON(
                `/api/multi-dims/${encodeURIComponent(catalogPath)}`,
                { config },
                "PUT"
            )
            console.log("Multidim saved:", response)

            if (response.success && response.id) {
                // Navigate to the multidim detail page
                window.location.href = `/admin/multi-dims/${response.id}`
            } else {
                console.error("Unexpected response:", response)
                alert(`Save failed: ${JSON.stringify(response)}`)
            }
        } catch (error) {
            console.error("Failed to save multidim:", error)
            alert(`Failed to save multidim: ${error}`)
        }
    }

    @computed get admin(): Admin {
        return this.context.admin
    }

    @computed get editor(): ChartEditor {
        return new ChartEditor({ manager: this })
    }

    @action.bound refresh(): void {
        // fetchGrapherConfig will also call tryFetchMultidimData after loading
        void this.fetchGrapherConfig()
        void this.fetchParentConfig()
        void this.fetchLogs()
        void this.fetchRefs()
        void this.fetchRedirects()
        void this.fetchPageviews()
        void this.fetchTags()
        void this.fetchAvailableTags()
    }

    override componentDidMount(): void {
        this.refresh()
    }

    override componentDidUpdate(
        prevProps: Readonly<{
            grapherId?: number
            grapherConfig?: GrapherInterface
        }>
    ): void {
        if (prevProps.grapherId !== this.props.grapherId) {
            void this.fetchTags()
        }
    }

    override render(): React.ReactElement {
        return (
            <ChartEditorView
                manager={this}
                multidimData={this.multidimData}
                selectedDimensions={this.selectedDimensions}
                onDimensionChange={this.handleDimensionChange}
                onSaveAsMultidim={
                    this.isMultidimMode ? this.saveAsMultidim : undefined
                }
            />
        )
    }
}
