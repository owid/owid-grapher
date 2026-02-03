import { useQuery } from "@tanstack/react-query"
import { useContext, useEffect, useState, useMemo } from "react"
import { Col, Row, Space, Typography, Select, Button, Alert } from "antd"
import { Link } from "react-router-dom"
import { Admin } from "./Admin.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    VariableDisplayDimension,
    GrapherInterface,
} from "@ourworldindata/types"
import { LoadingBlocker } from "./Forms.js"
import {
    Grapher,
    GrapherState,
    fetchInputTableForConfig,
} from "@ourworldindata/grapher"
import { OwidTable } from "@ourworldindata/core-table"
import { DATA_API_URL, CATALOG_URL } from "../settings/clientSettings.js"
import { loadCatalogVariableData, CatalogKey } from "@ourworldindata/utils"

interface RelatedVariablesResponse {
    currentVariable: {
        id: number
        name: string
        datasetId: number
        dimensions: VariableDisplayDimension
    }
    relatedVariables: Array<{
        id: number
        name: string
        dimensions: VariableDisplayDimension
    }>
    dimensionChoices: Record<string, string[]>
}

interface VariableWithConfig {
    id: number
    grapherConfig: GrapherInterface | undefined
}

function DimensionSelector({
    name,
    values,
    selectedValue,
    onChange,
}: {
    name: string
    values: string[]
    selectedValue: string
    onChange: (value: string) => void
}) {
    const options = values.map((value) => ({
        value: value,
        label: value,
    }))

    return (
        <div className="dimension-selector">
            <label className="dimension-selector__label">{name}</label>
            <Select
                className="w-100"
                value={selectedValue}
                onChange={onChange}
                options={options}
                disabled={values.length <= 1}
            />
        </div>
    )
}

async function fetchRelatedVariables(
    admin: Admin,
    variableId: number
): Promise<RelatedVariablesResponse | { error: string }> {
    return admin.getJSON<RelatedVariablesResponse | { error: string }>(
        `/api/variables/${variableId}/related.json`
    )
}

async function fetchVariableConfig(
    admin: Admin,
    variableId: number
): Promise<VariableWithConfig> {
    const { variable } = await admin.getJSON<{
        variable: { id: number; grapherConfig: GrapherInterface | undefined }
    }>(`/api/variables/${variableId}.json`)
    return {
        id: variable.id,
        grapherConfig: variable.grapherConfig,
    }
}

function ChartPreview({ config }: { config: GrapherInterface | undefined }) {
    const [grapherState, setGrapherState] = useState<GrapherState | undefined>()

    useEffect(() => {
        if (!config) {
            setGrapherState(undefined)
            return
        }

        const state = new GrapherState({
            ...config,
            additionalDataLoaderFn: (catalogKey: CatalogKey) =>
                loadCatalogVariableData(catalogKey, {
                    baseUrl: CATALOG_URL,
                }),
        })

        void fetchInputTableForConfig({
            dimensions: config.dimensions,
            selectedEntityColors: config.selectedEntityColors,
            dataApiUrl: DATA_API_URL,
            noCache: true,
        }).then((inputTable: OwidTable | undefined) => {
            if (inputTable) state.inputTable = inputTable
        })

        setGrapherState(state)
    }, [config])

    if (!grapherState) {
        return <div className="preview-placeholder">Loading preview...</div>
    }

    return <Grapher grapherState={grapherState} />
}

export function CreateMultidimChartPage({
    variableId,
}: {
    variableId: number
}) {
    const { admin } = useContext(AdminAppContext)
    const [selectedDimensions, setSelectedDimensions] = useState<
        Record<string, string>
    >({})

    useEffect(() => {
        admin.loadingIndicatorSetting = "off"
        return () => {
            admin.loadingIndicatorSetting = "default"
        }
    }, [admin])

    // Fetch related variables
    const {
        data: relatedData,
        isLoading: isLoadingRelated,
        isError: isErrorRelated,
    } = useQuery({
        queryKey: ["relatedVariables", variableId],
        queryFn: () => fetchRelatedVariables(admin, variableId),
    })

    // Initialize selected dimensions from current variable
    useEffect(() => {
        if (
            relatedData &&
            "currentVariable" in relatedData &&
            Object.keys(selectedDimensions).length === 0
        ) {
            const initialDimensions: Record<string, string> = {}
            for (const filter of relatedData.currentVariable.dimensions
                .filters) {
                initialDimensions[filter.name] = filter.value
            }
            setSelectedDimensions(initialDimensions)
        }
    }, [relatedData, selectedDimensions])

    // Find the matching variable based on selected dimensions
    const selectedVariable = useMemo(() => {
        if (!relatedData || "error" in relatedData) return null

        return relatedData.relatedVariables.find((v) => {
            // Check if all filters match the selected dimensions
            return v.dimensions.filters.every(
                (f: { name: string; value: string }) =>
                    selectedDimensions[f.name] === f.value
            )
        })
    }, [relatedData, selectedDimensions])

    // Fetch the config for the selected variable
    const { data: variableConfig, isLoading: isLoadingConfig } = useQuery({
        queryKey: ["variableConfig", selectedVariable?.id],
        queryFn: () =>
            selectedVariable
                ? fetchVariableConfig(admin, selectedVariable.id)
                : Promise.resolve(undefined),
        enabled: !!selectedVariable,
    })

    const handleDimensionChange = (name: string, value: string) => {
        setSelectedDimensions((prev) => ({
            ...prev,
            [name]: value,
        }))
    }

    // Get or generate a grapher config for the selected variable
    const effectiveGrapherConfig = useMemo((): GrapherInterface | undefined => {
        if (!selectedVariable) return undefined

        // Use existing config if available
        if (variableConfig?.grapherConfig) {
            return variableConfig.grapherConfig
        }

        // Generate a default config for variables without one
        return {
            dimensions: [
                {
                    variableId: selectedVariable.id,
                    property: "y" as const,
                },
            ],
            selectedEntityNames: ["World"],
        }
    }, [selectedVariable, variableConfig])

    // Build config URL params for creating chart
    const configUrlParams = useMemo(() => {
        if (!effectiveGrapherConfig || !selectedVariable) return undefined
        const grapherConfigJson = JSON.stringify(effectiveGrapherConfig)
        const params = new URLSearchParams({
            config: grapherConfigJson,
            multidimVariableId: selectedVariable.id.toString(),
        })
        return params.toString()
    }, [effectiveGrapherConfig, selectedVariable])

    if (isLoadingRelated) {
        return (
            <AdminLayout>
                <main className="CreateMultidimChartPage">
                    <LoadingBlocker />
                </main>
            </AdminLayout>
        )
    }

    if (isErrorRelated) {
        return (
            <AdminLayout title="Error">
                <main className="CreateMultidimChartPage">
                    <Alert
                        type="error"
                        message="Failed to load related variables"
                    />
                </main>
            </AdminLayout>
        )
    }

    if (!relatedData || "error" in relatedData) {
        return (
            <AdminLayout title="Error">
                <main className="CreateMultidimChartPage">
                    <Alert
                        type="warning"
                        message={
                            relatedData && "error" in relatedData
                                ? relatedData.error
                                : "Variable not found"
                        }
                        description={
                            <Link to={`/variables/${variableId}`}>
                                Return to variable page
                            </Link>
                        }
                    />
                </main>
            </AdminLayout>
        )
    }

    const { currentVariable, dimensionChoices } = relatedData
    const dimensionNames = Object.keys(dimensionChoices)

    return (
        <AdminLayout title="Create Chart from Multidimensional Indicator">
            <main className="CreateMultidimChartPage">
                <Row
                    className="p-3 admin-bar"
                    justify="space-between"
                    align="middle"
                >
                    <Col flex={1}>
                        <Space direction="vertical" size="small">
                            <Typography.Title className="mb-0" level={4}>
                                Create Chart from Multidimensional Indicator
                            </Typography.Title>
                            <Typography.Text type="secondary">
                                Original indicator:{" "}
                                {currentVariable.dimensions.originalShortName}
                            </Typography.Text>
                        </Space>
                    </Col>
                    <Col>
                        <Space>
                            <Link
                                className="ant-btn ant-btn-default"
                                to={`/variables/${variableId}`}
                            >
                                Cancel
                            </Link>
                            {configUrlParams && (
                                <Link
                                    className="ant-btn ant-btn-primary"
                                    to={`/charts/create?${configUrlParams}`}
                                >
                                    Create chart
                                </Link>
                            )}
                        </Space>
                    </Col>
                </Row>

                <div className="content-container">
                    <div className="dimensions-sidebar">
                        <Typography.Title level={5}>
                            Select dimensions
                        </Typography.Title>
                        <Typography.Paragraph type="secondary">
                            Choose the dimension values to select a specific
                            indicator variant.
                        </Typography.Paragraph>

                        <div className="dimension-selectors-vertical">
                            {dimensionNames.map((name) => (
                                <DimensionSelector
                                    key={name}
                                    name={name}
                                    values={dimensionChoices[name]}
                                    selectedValue={
                                        selectedDimensions[name] || ""
                                    }
                                    onChange={(value) =>
                                        handleDimensionChange(name, value)
                                    }
                                />
                            ))}
                        </div>

                        {selectedVariable && (
                            <div className="selected-variable-info">
                                <Typography.Title level={5}>
                                    Selected indicator
                                </Typography.Title>
                                <Typography.Text>
                                    {selectedVariable.name}
                                </Typography.Text>
                                <br />
                                <Typography.Text type="secondary">
                                    ID: {selectedVariable.id}
                                </Typography.Text>
                            </div>
                        )}

                        {!selectedVariable &&
                            Object.keys(selectedDimensions).length > 0 && (
                                <Alert
                                    type="warning"
                                    message="No indicator matches the selected dimensions"
                                    description="Try a different combination of dimension values."
                                />
                            )}
                    </div>

                    <div className="preview-container">
                        <div className="preview-wrapper">
                            {isLoadingConfig && (
                                <div className="preview-loading">
                                    Loading chart preview...
                                </div>
                            )}
                            {!isLoadingConfig && effectiveGrapherConfig && (
                                <ChartPreview config={effectiveGrapherConfig} />
                            )}
                            {!isLoadingConfig &&
                                !effectiveGrapherConfig &&
                                selectedVariable && (
                                    <div className="preview-placeholder">
                                        Unable to generate chart preview.
                                    </div>
                                )}
                        </div>
                    </div>
                </div>
            </main>
        </AdminLayout>
    )
}
