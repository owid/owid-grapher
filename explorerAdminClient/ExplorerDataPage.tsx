import React, { useEffect, useState } from "react"
import { ExplorerProgram, makeFullPath } from "../explorer/ExplorerProgram.js"
import { AdminManager } from "./AdminManager.js"
import { GitCmsClient } from "../gitCms/GitCmsClient.js"
import { ExplorerControlPanel } from "../explorer/ExplorerControls.js"
import { GIT_CMS_BASE_ROUTE } from "../gitCms/GitCmsConstants.js"
import { observer } from "mobx-react"
import { action, computed, observable, reaction } from "mobx"
import { DebugProvider } from "../site/gdocs/DebugContext.js"
import { DataPageV2Content } from "../site/DataPageV2Content.js"
import { DataPageV2 } from "../site/DataPageV2.js"
import {
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
                    this.datapageDataFull = response.datapageDataFull
                }
            }
        )
    }

    @computed private get grapherConfig(): GrapherInterface | null {
        const { datapageDataFull, currentlySelectedYIndicatorId } = this
        if (!datapageDataFull || !currentlySelectedYIndicatorId) return null
        return {
            ...datapageDataFull.grapher,
            dimensions: [
                {
                    property: DimensionProperty.y,
                    variableId: currentlySelectedYIndicatorId,
                },
            ],
        }
    }

    render() {
        const { explorer, datapageDataFull, grapherConfig } = this
        const panel = explorer
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
                {panel}
                <DebugProvider debug={true}>
                    {datapageDataFull && (
                        <DataPageV2
                            datapageData={datapageDataFull.datapageData}
                            grapher={grapherConfig ?? undefined}
                            imageMetadata={datapageDataFull.imageMetadata}
                            isPreviewing={true}
                            faqEntries={datapageDataFull.faqEntries}
                            baseGrapherUrl="/grapher/"
                            baseUrl="/"
                            tagToSlugMap={datapageDataFull.tagToSlugMap}
                        />
                    )}
                </DebugProvider>
            </>
        )
    }
}
