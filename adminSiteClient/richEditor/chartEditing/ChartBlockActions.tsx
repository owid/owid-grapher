import { useContext, useState } from "react"
import * as _ from "lodash-es"
import { Button, Popconfirm, Space, Typography, message } from "antd"
import { useQueryClient } from "@tanstack/react-query"
import { NARRATIVE_CHART_PROPS_TO_OMIT } from "@ourworldindata/types"
import { AdminAppContext } from "../../AdminAppContext.js"
import { NarrativeChartNameModal } from "../../NarrativeChartNameModal.js"
import { InspectedBlock } from "../inspection.js"
import { parseGrapherUrl } from "../grapherUrls.js"
import { useChartList } from "../useChartList.js"
import { useChartEditing } from "./ChartEditingContext.js"
import { useNarrativeChartInfo } from "./useNarrativeChartInfo.js"

// In-situ chart editing entry points in the block inspector (stage B of the
// plan): edit the parent chart or a narrative chart in the rail's embedded
// chart editor, or derive a new narrative chart from the embedded chart.

/** Actions for a selected `chart` block */
export function ChartBlockActions(props: {
    inspected: InspectedBlock
    chartUrl: string
}): React.ReactElement | null {
    const { inspected, chartUrl } = props
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()
    const chartEditing = useChartEditing()
    const charts = useChartList()
    const [nameModalOpen, setNameModalOpen] = useState(false)
    const [nameError, setNameError] = useState<string | undefined>(undefined)

    const parsedUrl = parseGrapherUrl(chartUrl)
    const chart = parsedUrl
        ? charts.find((item) => item.slug === parsedUrl.slug)
        : undefined

    if (!parsedUrl) return null

    const unresolvedHint = !chart
        ? charts.length
            ? "This chart couldn’t be matched to an editable chart (redirected slugs aren’t supported yet) — use the full chart editor instead."
            : "Loading the chart list…"
        : undefined

    const openEditor = (): void => {
        const blockPos = inspected.getPos()
        if (!chart || blockPos === null) return
        void chartEditing.openChartSession({
            chartId: chart.id,
            slug: parsedUrl.slug,
            blockPos,
        })
    }

    const createNarrativeChart = async (name: string): Promise<void> => {
        if (!chart) return
        try {
            const fullConfig = await admin.getJSON(
                `/api/charts/${chart.id}.config.json`
            )
            const response = await admin.requestJSON(
                "/api/narrative-charts",
                {
                    type: "chart",
                    name,
                    parentChartId: chart.id,
                    config: _.omit(fullConfig, NARRATIVE_CHART_PROPS_TO_OMIT),
                },
                "POST"
            )
            if (!response.success) {
                setNameError(response.errorMsg as string)
                return
            }
            setNameModalOpen(false)
            const blockPos = inspected.convertToNarrativeChart?.(name) ?? null
            await queryClient.invalidateQueries({
                queryKey: ["richEditorNarrativeChart", name],
            })
            if (blockPos !== null) {
                await chartEditing.openNarrativeChartSession({
                    narrativeChartId: response.narrativeChartId as number,
                    name,
                    blockPos,
                })
            } else {
                void message.warning(
                    "Narrative chart created, but the block could not be converted"
                )
            }
        } catch (error) {
            console.error(error)
            void message.error("Couldn’t create the narrative chart")
        }
    }

    return (
        <div className="rich-editor-inspector__chart-actions">
            <Space orientation="vertical" style={{ width: "100%" }}>
                <Space wrap>
                    <Popconfirm
                        title="Edit the chart itself?"
                        description={
                            <div style={{ maxWidth: 320 }}>
                                Changes affect the chart everywhere it appears —
                                its grapher page and every article that embeds
                                it. To customize it only for this article,
                                create a narrative chart instead.
                            </div>
                        }
                        okText="Edit chart"
                        onConfirm={openEditor}
                        disabled={!chart}
                    >
                        <Button
                            size="small"
                            disabled={!chart}
                            loading={chartEditing.isOpeningSession}
                        >
                            Edit chart…
                        </Button>
                    </Popconfirm>
                    <Button
                        size="small"
                        type="primary"
                        ghost
                        disabled={!chart}
                        onClick={() => {
                            setNameError(undefined)
                            setNameModalOpen(true)
                        }}
                    >
                        Create narrative chart…
                    </Button>
                    {chart && (
                        <a
                            href={`/admin/charts/${chart.id}/edit`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open in full editor
                        </a>
                    )}
                </Space>
                {unresolvedHint && (
                    <Typography.Text type="secondary">
                        {unresolvedHint}
                    </Typography.Text>
                )}
            </Space>
            <NarrativeChartNameModal
                isOpen={nameModalOpen}
                initialName={parsedUrl.slug}
                errorMsg={nameError}
                onSubmit={createNarrativeChart}
                onCancel={() => setNameModalOpen(false)}
            />
        </div>
    )
}

/** Actions for a selected `narrative-chart` block */
export function NarrativeChartBlockActions(props: {
    inspected: InspectedBlock
    name: string
}): React.ReactElement | null {
    const { inspected, name } = props
    const chartEditing = useChartEditing()
    const { info, isLoading } = useNarrativeChartInfo(name)

    if (!name) return null

    const openEditor = (): void => {
        const blockPos = inspected.getPos()
        if (!info || blockPos === null) return
        void chartEditing.openNarrativeChartSession({
            narrativeChartId: info.id,
            name,
            blockPos,
        })
    }

    return (
        <div className="rich-editor-inspector__chart-actions">
            <Space wrap>
                <Button
                    size="small"
                    type="primary"
                    ghost
                    disabled={!info}
                    loading={isLoading || chartEditing.isOpeningSession}
                    onClick={openEditor}
                >
                    Edit narrative chart…
                </Button>
                {info && (
                    <a
                        href={`/admin/narrative-charts/${info.id}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open in full editor
                    </a>
                )}
            </Space>
        </div>
    )
}
