import { useMemo, useState } from "react"
import * as R from "remeda"

import { Checkbox } from "@ourworldindata/components"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { ResponsiveContainer } from "../../../../components/ResponsiveContainer/ResponsiveContainer.js"
import {
    Controls,
    ControlsRow,
    LabeledControl,
} from "../../../../components/Controls/Controls.js"
import { Switcher } from "../../../../components/Switcher/Switcher.js"

import { ComputeScatter } from "../components/ComputeScatter.js"
import { Legend } from "../components/Legend.js"
import { TimeRangeSlider } from "../components/TimeRangeSlider.js"
import { AI_MODELS } from "../core/data.js"
import {
    COLOR_SCHEMES,
    ColorScheme,
    FIRST_YEAR,
    LAST_YEAR,
} from "../core/constants.js"
import { COLOR_SCHEME_DEFINITIONS } from "../core/colorSchemes.js"
import { COMPUTER_SYSTEMS } from "../core/computers.js"
import { REFERENCE_POINTS } from "../core/referencePoints.js"
import { getTimePresets } from "../core/timeline.js"
import type { AiTrainingComputeConfig } from "../index.js"

const SOURCE = (
    <>
        <a
            href="https://epoch.ai/data/ai-models"
            target="_blank"
            rel="noopener noreferrer"
        >
            Epoch AI, “Notable AI models”
        </a>{" "}
        (2026); TOP500 and manufacturer specifications for computers
    </>
)

const NOTE =
    "Computation is measured in total floating-point operations (FLOP), estimated from each model's published details or reporting. Computers are shown at the computation they would do running nonstop for one month: supercomputers at their measured 64-bit LINPACK speed, other machines at their rated peak, AI chips at 16-bit precision."

const TIME_PRESETS = getTimePresets(LAST_YEAR)

export function ScatterVariant({
    config,
}: {
    config: AiTrainingComputeConfig
}) {
    const [colorScheme, setColorScheme] = useState<ColorScheme>(config.colorBy)
    const [showComputers, setShowComputers] = useState(config.showComputers)
    const [showReferenceLines, setShowReferenceLines] = useState(
        config.showReferenceLines
    )
    const [timeRange, setTimeRange] = useState<[number, number]>(() => [
        clampYear(config.startYear),
        clampYear(config.endYear ?? LAST_YEAR),
    ])
    const [focusedGroup, setFocusedGroup] = useState<string | undefined>()

    const labeledModels = useMemo(
        () =>
            config.labeledModels
                .split(",")
                .map((name) => name.trim())
                .filter(Boolean),
        [config.labeledModels]
    )

    const visibleModels = AI_MODELS.filter(
        (m) => m.year >= timeRange[0] && m.year <= timeRange[1]
    )
    const counts = new Map(
        Object.entries(R.countBy(visibleModels, (m) => m.groups[colorScheme]))
    )
    const computers = showComputers ? COMPUTER_SYSTEMS : []
    const computerKinds = R.unique(
        computers
            .filter((c) => c.year >= timeRange[0] && c.year <= timeRange[1])
            .map((c) => c.kind)
    )

    return (
        <div className="ai-training-compute">
            {!config.hideControls && (
                <Controls>
                    <ControlsRow>
                        <LabeledControl label="Color by">
                            <Switcher
                                ariaLabel="Color by"
                                items={COLOR_SCHEMES.map((scheme) => ({
                                    key: scheme,
                                    element:
                                        COLOR_SCHEME_DEFINITIONS[scheme].label,
                                }))}
                                selectedKey={colorScheme}
                                onChange={(scheme) => {
                                    setColorScheme(scheme)
                                    setFocusedGroup(undefined)
                                }}
                            />
                        </LabeledControl>
                        <div className="ai-training-compute__toggles">
                            <Checkbox
                                checked={showComputers}
                                onChange={(e) =>
                                    setShowComputers(e.target.checked)
                                }
                                label="Show computers"
                            />
                            <Checkbox
                                checked={showReferenceLines}
                                onChange={(e) =>
                                    setShowReferenceLines(e.target.checked)
                                }
                                label="Show human and legal reference lines"
                            />
                        </div>
                    </ControlsRow>
                    <TimeRangeSlider
                        min={FIRST_YEAR}
                        max={LAST_YEAR}
                        range={timeRange}
                        onChange={setTimeRange}
                        presets={TIME_PRESETS}
                    />
                </Controls>
            )}
            <Frame className="ai-training-compute__frame">
                <ChartHeader title={config.title} subtitle={config.subtitle} />
                <Legend
                    colorScheme={colorScheme}
                    counts={counts}
                    focusedGroup={focusedGroup}
                    onFocusChange={setFocusedGroup}
                    computerKinds={computerKinds}
                />
                <div className="ai-training-compute__chart-area">
                    <ResponsiveContainer>
                        {({ width, height }) => (
                            <ComputeScatter
                                width={width}
                                height={height}
                                models={AI_MODELS}
                                computers={computers}
                                referencePoints={
                                    showReferenceLines ? REFERENCE_POINTS : []
                                }
                                labeledModels={labeledModels}
                                timeRange={timeRange}
                                colorScheme={colorScheme}
                                focusedGroup={focusedGroup}
                            />
                        )}
                    </ResponsiveContainer>
                </div>
                <ChartFooter source={SOURCE} note={NOTE} />
            </Frame>
        </div>
    )
}

function clampYear(year: number): number {
    return Math.min(LAST_YEAR, Math.max(FIRST_YEAR, year))
}
