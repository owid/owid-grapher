import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"

import { ChartBody } from "../components/ChartBody.js"
import { ChartSubtitle } from "../components/ChartSubtitle.js"
import { ModelFilterDropdown } from "../components/ModelFilterDropdown.js"
import { YScaleSwitch } from "../components/YScaleSwitch.js"
import { FRONTIER_TIME_RANGE } from "../core/frontier.js"
import { useViewState } from "../core/viewState.js"
import { initialViewFromConfig, useLabeledModels } from "../core/chartConfig.js"
import { NOTE, SOURCE } from "../components/ChartSource.js"
import type { AiTrainingComputeConfig } from "../index.js"

export function ScatterVariant({
    config,
}: {
    config: AiTrainingComputeConfig
}) {
    const { view, animate, updateView } = useViewState(
        initialViewFromConfig(config)
    )
    const labeledModels = useLabeledModels(config)

    return (
        <Frame className="ai-training-compute">
            <ChartHeader
                title={config.title}
                subtitle={
                    <ChartSubtitle
                        subtitle={config.subtitle}
                        onShowFrontier={() =>
                            updateView(
                                {
                                    showFrontier: true,
                                    timeRange: FRONTIER_TIME_RANGE,
                                },
                                { animate: true }
                            )
                        }
                    />
                }
            />
            <div className="ai-training-compute__controls">
                <ModelFilterDropdown
                    modelFilter={view.modelFilter}
                    onChange={(modelFilter) => updateView({ modelFilter })}
                />
                <YScaleSwitch
                    yScaleType={view.yScaleType}
                    onChange={(yScaleType) => updateView({ yScaleType })}
                />
            </div>
            <ChartBody
                view={view}
                animate={animate}
                labeledModels={labeledModels}
                onTimeRangeChange={
                    config.hideControls
                        ? undefined
                        : (timeRange) => updateView({ timeRange })
                }
            />
            <ChartFooter source={SOURCE} note={NOTE} />
        </Frame>
    )
}
