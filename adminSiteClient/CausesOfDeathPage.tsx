import { EntityName, Time } from "@ourworldindata/types"
import { useQuery } from "@tanstack/react-query"
import * as d3 from "d3"
import { useState, useMemo } from "react"
import {
    CAUSE_OF_DEATH_INDICATOR_NAMES,
    FetchedDataRow,
} from "./CausesOfDeathConstants"
import {
    CausesOfDeathComponent,
    CausesOfDeathCountrySelector,
} from "./CausesOfDeathComponent"
// @ts-expect-error - JavaScript module without type definitions
import { hybridSliceDiceSmartStack } from "./customTiling.js"

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
            hybridSliceDiceSmartStack({
                minThickness: minThick,
                innerMinThickness: innerMinThick,
            }),
    },
]

export function CausesOfDeathPage() {
    // const [selectedEntity, setSelectedEntity] = useState<EntityName>("World")
    const [selectedYear, setSelectedYear] = useState<Time>(2023)
    const [selectedTiling, setSelectedTiling] = useState<string>("custom")
    const [_minThickness, _setMinThickness] = useState<number>(120)
    const [_innerMinThickness, _setInnerMinThickness] = useState<number>(40)
    const [debug, setDebug] = useState<boolean>(false)

    const result = useQuery({
        queryKey: ["causesOfDeath"],
        queryFn: async () => {
            const response = await fetch("/deaths-by-cause.csv")
            const csvText = await response.text()
            return d3.csvParse<FetchedDataRow, string>(csvText, d3.autoType)
        },
    })

    // Extract unique entities and years from the data
    const { entities, years } = useMemo(() => {
        if (!result.data) return { entities: [], years: [] }

        const uniqueEntities = Array.from(
            new Set(result.data.map((d) => d.Entity))
        ).sort()
        const uniqueYears = Array.from(
            new Set(result.data.map((d) => d.Year))
        ).sort((a, b) => b - a)

        return { entities: uniqueEntities, years: uniqueYears }
    }, [result.data])

    // Set default entity when data loads
    // useMemo(() => {
    //     if (entities.length > 0 && !selectedEntity) {
    //         setSelectedEntity(entities[0])
    //     }
    // }, [entities, selectedEntity])

    const data = useMemo(() => {
        return parseFetchedData(result.data)
    }, [result.data])

    return (
        <div style={{ paddingBottom: "60px" }}>
            {result.isLoading && <p>Loading...</p>}
            {result.isError && <p>Error: {String(result.error)}</p>}

            {/* <EntitySelect
                entities={entities}
                selectedEntity={selectedEntity}
                onEntityChange={setSelectedEntity}
            /> */}

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
                        <YearSelect
                            years={years}
                            selectedYear={selectedYear}
                            onYearChange={setSelectedYear}
                        />
                    </div>

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
                        <CausesOfDeathCountrySelector
                            data={data}
                            year={selectedYear}
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

function parseFetchedData(data: FetchedDataRow[] | undefined) {
    if (!data) return undefined

    return data.flatMap((row) =>
        CAUSE_OF_DEATH_INDICATOR_NAMES.map((indicatorName) => ({
            entityName: row.Entity,
            year: row.Year,
            variable: indicatorName,
            value: row[indicatorName],
        }))
    )
}

interface EntitySelectProps {
    entities: EntityName[]
    selectedEntity: EntityName
    onEntityChange: (entity: EntityName) => void
}

function _EntitySelect({
    entities,
    selectedEntity,
    onEntityChange,
}: EntitySelectProps) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label
                htmlFor="entity-select"
                style={{
                    fontWeight: "bold",
                }}
            >
                Country:
            </label>
            <select
                id="entity-select"
                value={selectedEntity}
                onChange={(e) => onEntityChange(e.target.value as EntityName)}
                style={{ padding: "5px", minWidth: "200px" }}
            >
                {entities.map((entity) => (
                    <option key={entity} value={entity}>
                        {entity}
                    </option>
                ))}
            </select>
        </div>
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

interface YearSelectProps {
    years: Time[]
    selectedYear: Time
    onYearChange: (year: Time) => void
}

function YearSelect({ years, selectedYear, onYearChange }: YearSelectProps) {
    return (
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
            <label
                htmlFor="year-select"
                style={{
                    fontWeight: "600",
                    fontSize: "14px",
                    minWidth: "120px",
                }}
            >
                Year:
            </label>
            <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => onYearChange(parseInt(e.target.value) as Time)}
                style={{
                    padding: "8px 12px",
                    minWidth: "100px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "14px",
                }}
            >
                {years.map((year) => (
                    <option key={year} value={year}>
                        {year}
                    </option>
                ))}
            </select>
        </div>
    )
}
