import React from "react"
import { ExplorerProgram, makeFullPath } from "../explorer/ExplorerProgram.js"
import { GitCmsClient } from "../gitCms/GitCmsClient.js"
import {
    ExplorerControlBar,
    ExplorerControlPanel,
} from "../explorer/ExplorerControls.js"
import { GIT_CMS_BASE_ROUTE } from "../gitCms/GitCmsConstants.js"
import { observer } from "mobx-react"
import { action, computed, observable, reaction } from "mobx"
import { DebugProvider } from "../site/gdocs/DebugContext.js"
import { DataPageV2Body } from "../site/DataPageV2Body.js"
import {
    ChartTypeName,
    DimensionProperty,
    FullDatapageData,
    GrapherInterface,
} from "@ourworldindata/types"

export interface ExplorerDataPageProps {
    slug: string
}

@observer
export class ExplorerDataPage extends React.Component<ExplorerDataPageProps> {
    @observable private explorer: ExplorerProgram | null = null
    @observable private datapageDataFull: FullDatapageData | null = null

    // iframeRef = React.createRef<HTMLIFrameElement>()

    @computed private get slug() {
        return this.props.slug
    }

    // @computed private get currentChoice(): string | null {
    //     const { explorer } = this
    //     if (!explorer) return null
    //     return Object.entries(explorer.decisionMatrix.currentParams)
    //         .map(([key, value]) => `${key}=${value}`)
    //         .join("-")
    // }

    @computed private get currentlySelectedYIndicatorIds(): number[] {
        const { explorer } = this
        if (!explorer) return []
        if (!("yVariableIds" in explorer.currentlySelectedGrapherRowContent))
            return []
        const yVariableIds =
            explorer.currentlySelectedGrapherRowContent.yVariableIds
                .split(" ")
                .map((str: string) => parseInt(str))
        return yVariableIds
    }

    @computed private get currentlySelectedChartType(): ChartTypeName {
        const { explorer } = this
        if (!explorer) return ChartTypeName.LineChart
        return (
            explorer.currentlySelectedGrapherRowContent.type ??
            ChartTypeName.LineChart
        )
    }

    @computed private get currentlySelectedYIndicatorId(): number | null {
        const { currentlySelectedYIndicatorIds } = this
        return currentlySelectedYIndicatorIds.length > 0
            ? currentlySelectedYIndicatorIds[0]
            : null
    }
    private async fetchData() {
        const { slug } = this
        const gitCmsClient = new GitCmsClient(GIT_CMS_BASE_ROUTE)
        const explorerContent = await gitCmsClient.readRemoteFile({
            filepath: makeFullPath(slug),
        })
        this.explorer = new ExplorerProgram(slug, explorerContent.content)
    }
    componentDidMount() {
        void this.fetchData()
        reaction(
            () => this.currentlySelectedYIndicatorId,
            async (currentlySelectedYIndicatorId) => {
                if (currentlySelectedYIndicatorId) {
                    const response = await fetch(
                        `/admin/api/explorer/datapagepreview/${currentlySelectedYIndicatorId}.json`
                    ).then((res) => res.json())
                    const datapageDataFull = response.datapageDataFull
                    console.log("explorertitle", this.explorer?.explorerTitle)
                    datapageDataFull.datapageData.title = {
                        title:
                            this.explorer?.explorerTitle ??
                            datapageDataFull.datapageData.title,
                    }
                    this.datapageDataFull = datapageDataFull
                }
            }
        )
    }

    @computed private get grapherConfig(): GrapherInterface | null {
        const {
            datapageDataFull,
            currentlySelectedYIndicatorIds,
            currentlySelectedChartType,
        } = this
        if (!datapageDataFull || !currentlySelectedYIndicatorIds) return null
        return {
            ...datapageDataFull.grapher,
            type: currentlySelectedChartType,
            yAxis: {
                ...datapageDataFull.grapher.yAxis,
                min: 0,
            },
            selectedEntityNames: this.explorer?.selection ?? ["World"],
            dimensions: currentlySelectedYIndicatorIds.map((indicatorId) => ({
                property: DimensionProperty.y,
                variableId: indicatorId,
            })),
        }
    }

    render() {
        const { explorer, datapageDataFull, grapherConfig } = this
        const panels = explorer
            ? explorer.decisionMatrix.choicesWithAvailability.map((choice) => (
                  <ExplorerControlPanel
                      key={choice.title}
                      choice={choice}
                      isMobile={false}
                      onChange={(val) =>
                          explorer.decisionMatrix.setValueCommand(
                              choice.title,
                              val
                          )
                      }
                  />
              ))
            : null
        return (
            <>
                <ExplorerControlBar isMobile={false} showControls={false}>
                    {panels}
                </ExplorerControlBar>

                <DebugProvider debug={true}>
                    {datapageDataFull && (
                        <DataPageV2Body
                            datapageData={datapageDataFull.datapageData}
                            grapher={grapherConfig ?? undefined}
                            imageMetadata={datapageDataFull.imageMetadata}
                            isPreviewing={true}
                            faqEntries={datapageDataFull.faqEntries}
                            baseGrapherUrl="/grapher/"
                            baseUrl="/"
                            canonicalUrl="/"
                            tagToSlugMap={datapageDataFull.tagToSlugMap}
                            grapherKey={this.currentlySelectedYIndicatorIds
                                .map((i) => i.toString())
                                .join("-")}
                        />
                        // <></>
                    )}
                </DebugProvider>
            </>
        )
    }
}
