import { EntityName as _EntityName } from "@ourworldindata/types"
import * as d3 from "d3"
import { useState } from "react"
import {
    CAUSE_OF_DEATH_INDICATOR_NAMES as _CAUSE_OF_DEATH_INDICATOR_NAMES,
    FetchedDataRow as _FetchedDataRow,
} from "./CausesOfDeathConstants"
import { CausesOfDeathCaptionedChart } from "./CausesOfDeathTreemap"
import { stackedSliceDiceTiling } from "./stackedSliceDiceTiling.js"

const availableTilingMethods = {
    squarify: { label: "Squarify", method: d3.treemapSquarify },
    binary: { label: "Binary", method: d3.treemapBinary },
    dice: { label: "Dice", method: d3.treemapDice },
    slice: { label: "Slice", method: d3.treemapSlice },
    sliceDice: { label: "Slice-Dice", method: d3.treemapSliceDice },
    custom: {
        label: "Custom",
        method: (minThick: number, innerMinThick: number) =>
            stackedSliceDiceTiling({
                minSliceWidth: minThick,
                minStackHeight: innerMinThick,
            }),
    },
} as const

type TilingMethodKey = keyof typeof availableTilingMethods

export function CausesOfDeathPage() {
    const [selectedTilingMethod, setSelectedTilingMethod] =
        useState<TilingMethodKey>("custom")
    const [minThickness, setMinThickness] = useState<number>(120)
    const [innerMinThickness, setInnerMinThickness] = useState<number>(40)
    const [debug, setDebug] = useState<boolean>(false)

    const tilingMethod =
        selectedTilingMethod === "custom"
            ? availableTilingMethods["custom"].method(
                  minThickness,
                  innerMinThickness
              )
            : availableTilingMethods[selectedTilingMethod].method

    return (
        <div style={{ paddingBottom: "60px" }}>
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
                            selectedTiling={selectedTilingMethod}
                            onTilingChange={setSelectedTilingMethod}
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

            {selectedTilingMethod === "custom" && (
                <div style={{ marginTop: "15px" }}>
                    <CustomTilingControls
                        show={false}
                        minThickness={minThickness}
                        innerMinThickness={innerMinThickness}
                        onMinThicknessChange={setMinThickness}
                        onInnerMinThicknessChange={setInnerMinThickness}
                    />
                </div>
            )}

            <div style={{ padding: "0 20px" }}>
                <CausesOfDeathCaptionedChart
                    tilingMethod={tilingMethod}
                    debug={debug}
                />
            </div>
        </div>
    )
}

interface TilingSelectProps {
    selectedTiling: TilingMethodKey
    onTilingChange: (tiling: TilingMethodKey) => void
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
                onChange={(e) =>
                    onTilingChange(e.target.value as TilingMethodKey)
                }
                style={{
                    padding: "8px 12px",
                    minWidth: "150px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    fontSize: "14px",
                }}
            >
                {Object.entries(availableTilingMethods).map(([key, method]) => (
                    <option key={key} value={key}>
                        {method.label}
                    </option>
                ))}
            </select>
        </div>
    )
}

interface CustomTilingControlsProps {
    show: boolean
    minThickness: number
    innerMinThickness: number
    onMinThicknessChange: (value: number) => void
    onInnerMinThicknessChange: (value: number) => void
}

function CustomTilingControls({
    show,
    minThickness,
    innerMinThickness,
    onMinThicknessChange,
    onInnerMinThicknessChange,
}: CustomTilingControlsProps) {
    if (!show) return null
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
