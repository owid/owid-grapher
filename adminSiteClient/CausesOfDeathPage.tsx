import { EntityName as _EntityName, Time } from "@ourworldindata/types"
import { useQuery } from "@tanstack/react-query"
import * as d3 from "d3"
import { useState, useMemo } from "react"
import {
    CAUSE_OF_DEATH_INDICATOR_NAMES as _CAUSE_OF_DEATH_INDICATOR_NAMES,
    FetchedDataRow as _FetchedDataRow,
} from "./CausesOfDeathConstants"
import { CausesOfDeathCaptionedChart } from "./CausesOfDeathTreemap"
import { stackedSliceDiceTiling } from "./stackedSliceDiceTiling.js"

interface CausesOfDeathMetadata {
    dimensions: {
        entities: Array<{ id: number; name: string }>
        variables: Array<{ id: number; name: string }>
    }
}

interface EntityData {
    values: number[]
    variables: number[]
    years: number[]
}

interface EntityDataWithInfo extends EntityData {
    entityId: number
    entityName: string
}

const TILING_METHODS = [
    { value: "squarify", label: "Squarify", method: d3.treemapSquarify },
    { value: "binary", label: "Binary", method: d3.treemapBinary },
    { value: "dice", label: "Dice", method: d3.treemapDice },
    { value: "slice", label: "Slice", method: d3.treemapSlice },
    { value: "sliceDice", label: "Slice-Dice", method: d3.treemapSliceDice },
    {
        value: "custom",
        label: "Custom",
        method: (minThick: number, innerMinThick: number) =>
            stackedSliceDiceTiling({
                minSliceWidth: minThick,
                minStackHeight: innerMinThick,
            }),
    },
]

export function CausesOfDeathPage() {
    const [selectedTiling, setSelectedTiling] = useState<string>("custom")
    const [_minThickness, _setMinThickness] = useState<number>(120)
    const [_innerMinThickness, _setInnerMinThickness] = useState<number>(40)
    const [debug, setDebug] = useState<boolean>(false)

    // This is only needed for the commented-out sections below
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const selectedYear: Time = 2023

    // Fetch metadata
    const metadataResult = useQuery({
        queryKey: ["causesOfDeathMetadata"],
        queryFn: async (): Promise<CausesOfDeathMetadata> => {
            const response = await fetch("/causes-of-death.metadata.json")
            return response.json()
        },
    })

    // Fetch data for all entities
    const allEntitiesDataResult = useQuery({
        queryKey: ["causesOfDeathAllData"],
        queryFn: async (): Promise<EntityDataWithInfo[]> => {
            if (!metadataResult.data) return []

            const entityPromises = metadataResult.data.dimensions.entities.map(
                async (entity) => {
                    const response = await fetch(
                        `/causes-of-death.${entity.id}.data.json`
                    )
                    const data = await response.json()
                    return {
                        ...data,
                        entityId: entity.id,
                        entityName: entity.name,
                    }
                }
            )

            return Promise.all(entityPromises)
        },
        enabled: !!metadataResult.data,
    })

    const data = useMemo(() => {
        return parseAllEntitiesData(
            metadataResult.data,
            allEntitiesDataResult.data
        )
    }, [metadataResult.data, allEntitiesDataResult.data])

    return (
        <div style={{ paddingBottom: "60px" }}>
            {(metadataResult.isLoading || allEntitiesDataResult.isLoading) && (
                <p>Loading...</p>
            )}
            {(metadataResult.isError || allEntitiesDataResult.isError) && (
                <p>
                    Error:{" "}
                    {String(
                        metadataResult.error || allEntitiesDataResult.error
                    )}
                </p>
            )}

            <div style={{ marginTop: "15px", paddingLeft: "20px" }}>
                <div
                    className="settings-box"
                    style={{
                        padding: "15px",
                        border: "1px solid #e0e0e0",
                        borderRadius: "4px",
                        backgroundColor: "#fafafa",
                    }}
                >
                    <h3
                        style={{
                            margin: "0 0 15px 0",
                            fontSize: "16px",
                            fontWeight: "600",
                            color: "#333",
                        }}
                    >
                        Settings
                    </h3>

                    <div style={{ marginBottom: "15px" }}>
                        <TilingSelect
                            selectedTiling={selectedTiling}
                            onTilingChange={setSelectedTiling}
                        />
                    </div>

                    <div>
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={debug}
                                onChange={(e) => setDebug(e.target.checked)}
                            />
                            <span style={{ fontSize: "14px", color: "#333" }}>
                                Debug
                            </span>
                        </label>
                    </div>
                </div>
            </div>

            {/* {selectedTiling === "custom" && (
                <div style={{ marginTop: "15px" }}>
                    <CustomTilingControls
                        minThickness={minThickness}
                        innerMinThickness={innerMinThickness}
                        onMinThicknessChange={setMinThickness}
                        onInnerMinThicknessChange={setInnerMinThickness}
                    />
                </div>
            )} */}

            {data && (
                <>
                    {/* Country selector section */}
                    <div style={{ padding: "0 20px" }}>
                        <CausesOfDeathCaptionedChart
                            debug={debug}
                            tilingMethod={
                                selectedTiling === "custom"
                                    ? (
                                          TILING_METHODS.find(
                                              (m) => m.value === selectedTiling
                                          )?.method as any
                                      )(120, 40)
                                    : TILING_METHODS.find(
                                          (m) => m.value === selectedTiling
                                      )?.method || d3.treemapSquarify
                            }
                        />
                    </div>

                    {/* Small treemaps grid */}
                    {/* <div style={{ padding: "0 20px", marginTop: "80px" }}>
                        <h2
                            style={{
                                margin: "0 0 20px 0",
                                fontSize: "20px",
                                fontWeight: "600",
                                color: "#333",
                            }}
                        >
                            Small multiple treemaps
                        </h2>
                    </div>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fit, minmax(300px, 350px))",
                            gap: "20px",
                            marginBottom: "60px",
                            padding: "0 20px",
                            justifyContent: "center",
                        }}
                    >
                        {entities.map((entityName) => (
                            <div
                                key={entityName}
                                style={{ textAlign: "center" }}
                            >
                                <h3
                                    style={{
                                        margin: "0 0 10px 0",
                                        fontSize: "16px",
                                    }}
                                >
                                    {entityName}
                                </h3>
                                <CausesOfDeathComponent
                                    data={data}
                                    entityName={entityName}
                                    year={selectedYear}
                                    dimensionsConfig={{
                                        initialWidth: 350,
                                        ratio: 4 / 3,
                                        minHeight: 200,
                                        maxHeight: 250,
                                    }}
                                    tilingMethod={
                                        selectedTiling === "custom"
                                            ? (
                                                  TILING_METHODS.find(
                                                      (m) =>
                                                          m.value ===
                                                          selectedTiling
                                                  )?.method as any
                                              )(120, 40)
                                            : TILING_METHODS.find(
                                                  (m) =>
                                                      m.value === selectedTiling
                                              )?.method || d3.treemapSquarify
                                    }
                                />
                            </div>
                        ))}
                    </div> */}

                    {/* Large individual treemaps */}
                    {/* <div style={{ padding: "0 20px" }}>
                        {entities.map((entityName) => (
                            <div
                                key={`large-${entityName}`}
                                style={{
                                    marginBottom: "80px",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                }}
                            >
                                <h3
                                    style={{
                                        margin: "0 0 20px 0",
                                        fontSize: "24px",
                                        fontWeight: "600",
                                    }}
                                >
                                    {entityName}
                                </h3>
                                <div
                                    style={{
                                        transform: "scale(1.1)",
                                        transformOrigin: "center",
                                        margin: "60px 0",
                                    }}
                                >
                                    <CausesOfDeathComponent
                                        data={data}
                                        entityName={entityName}
                                        year={selectedYear}
                                        dimensionsConfig={{
                                            initialWidth: 800,
                                            ratio: 3 / 2,
                                            minHeight: 400,
                                            maxHeight: 600,
                                        }}
                                        tilingMethod={
                                            selectedTiling === "custom"
                                                ? (
                                                      TILING_METHODS.find(
                                                          (m) =>
                                                              m.value ===
                                                              selectedTiling
                                                      )?.method as any
                                                  )(120, 40)
                                                : TILING_METHODS.find(
                                                      (m) =>
                                                          m.value ===
                                                          selectedTiling
                                                  )?.method ||
                                                  d3.treemapSquarify
                                        }
                                    />
                                </div>
                            </div>
                        ))}
                    </div> */}
                </>
            )}
        </div>
    )
}

function parseAllEntitiesData(
    metadata: CausesOfDeathMetadata | undefined,
    allEntitiesData: EntityDataWithInfo[] | undefined
) {
    if (!metadata || !allEntitiesData) return undefined

    // Map variable IDs to the original indicator names
    const variableIdToIndicatorName = new Map<number, string>([
        [1, "Total number of deaths from heart diseases"],
        [2, "Total number of deaths from cancers"],
        [3, "Total number of deaths from chronic respiratory diseases"],
        [4, "Total number of deaths from digestive diseases"],
        [5, "Total number of deaths from diabetes and kidney diseases"],
        [6, "Total number of deaths from neurological disorders"],
        [7, "Total number of deaths from other non-communicable diseases"],
        [8, "Total number of deaths from pneumonia"],
        [9, "Total number of deaths from diarrheal diseases"],
        [10, "Total number of deaths from tuberculosis"],
        [11, "Total number of deaths from HIV/AIDS"],
        [12, "Total number of deaths from malaria"],
        [13, "Total number of deaths from neonatal disorders"],
        [14, "Total number of deaths from maternal disorders"],
        [15, "Total number of deaths from nutritional deficiencies"],
        [16, "Total number of deaths from transport injuries"],
        [17, "Total number of deaths from other injuries"],
        [18, "Total number of deaths from suicide"],
        [19, "Total number of deaths from other infectious diseases"],
        [20, "Total number of deaths from interpersonal violence"],
    ])

    return allEntitiesData.flatMap(
        (entityData) =>
            entityData.values
                .map((value, index) => {
                    const variableId = entityData.variables[index]
                    const year = entityData.years[index]
                    const indicatorName =
                        variableIdToIndicatorName.get(variableId)

                    return {
                        entityName: entityData.entityName,
                        year,
                        variable: indicatorName as any,
                        value,
                    }
                })
                .filter((item) => item.variable) // Filter out any items where variable name wasn't found
    )
}

interface TilingSelectProps {
    selectedTiling: string
    onTilingChange: (tiling: string) => void
}

function TilingSelect({ selectedTiling, onTilingChange }: TilingSelectProps) {
    return (
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
            <label
                htmlFor="tiling-select"
                style={{
                    fontWeight: "600",
                    fontSize: "14px",
                    minWidth: "120px",
                }}
            >
                Tiling Method:
            </label>
            <select
                id="tiling-select"
                value={selectedTiling}
                onChange={(e) => onTilingChange(e.target.value)}
                style={{
                    padding: "8px 12px",
                    minWidth: "150px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "14px",
                }}
            >
                {TILING_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                        {method.label}
                    </option>
                ))}
            </select>
        </div>
    )
}

interface CustomTilingControlsProps {
    minThickness: number
    innerMinThickness: number
    onMinThicknessChange: (value: number) => void
    onInnerMinThicknessChange: (value: number) => void
}

function _CustomTilingControls({
    minThickness,
    innerMinThickness,
    onMinThicknessChange,
    onInnerMinThicknessChange,
}: CustomTilingControlsProps) {
    return (
        <div
            style={{
                padding: "15px",
                border: "1px solid #ccc",
                borderRadius: "5px",
                backgroundColor: "#f9f9f9",
            }}
        >
            <h4 style={{ margin: "0 0 15px 0" }}>Custom Tiling Parameters</h4>

            <div style={{ marginBottom: "15px" }}>
                <label
                    htmlFor="min-thickness-slider"
                    style={{
                        fontWeight: "bold",
                        display: "block",
                        marginBottom: "5px",
                    }}
                >
                    Min Thickness: {minThickness}px
                </label>
                <input
                    id="min-thickness-slider"
                    type="range"
                    min="20"
                    max="200"
                    value={minThickness}
                    onChange={(e) =>
                        onMinThicknessChange(parseInt(e.target.value))
                    }
                    style={{ width: "300px" }}
                />
            </div>

            <div>
                <label
                    htmlFor="inner-min-thickness-slider"
                    style={{
                        fontWeight: "bold",
                        display: "block",
                        marginBottom: "5px",
                    }}
                >
                    Inner Min Thickness: {innerMinThickness}px
                </label>
                <input
                    id="inner-min-thickness-slider"
                    type="range"
                    min="10"
                    max="100"
                    value={innerMinThickness}
                    onChange={(e) =>
                        onInnerMinThicknessChange(parseInt(e.target.value))
                    }
                    style={{ width: "300px" }}
                />
            </div>
        </div>
    )
}
