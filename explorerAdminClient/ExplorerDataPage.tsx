import React, { useEffect, useState } from "react"
import { ExplorerProgram, makeFullPath } from "../explorer/ExplorerProgram.js"
import { AdminManager } from "./AdminManager.js"
import { GitCmsClient } from "../gitCms/GitCmsClient.js"
import { ExplorerControlPanel } from "../explorer/ExplorerControls.js"
import { GIT_CMS_BASE_ROUTE } from "../gitCms/GitCmsConstants.js"
import { observer } from "mobx-react"
import { action, computed, observable } from "mobx"

export interface ExplorerDataPageProps {
    slug: string
}

@observer
export class ExplorerDataPage extends React.Component<ExplorerDataPageProps> {
    @observable private explorer: ExplorerProgram | null = null

    iframeRef = React.createRef<HTMLIFrameElement>()

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

    @action.bound private async fetchData() {
        const { slug } = this
        const gitCmsClient = new GitCmsClient(GIT_CMS_BASE_ROUTE)
        const explorerContent = await gitCmsClient.readRemoteFile({
            filepath: makeFullPath(slug),
        })
        this.explorer = new ExplorerProgram(slug, explorerContent.content)
    }
    componentDidMount() {
        void this.fetchData()
    }

    render() {
        const { explorer, currentlySelectedYIndicatorId, iframeRef } = this
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
                <iframe
                    ref={iframeRef}
                    src={`/admin/datapage-preview/${currentlySelectedYIndicatorId}?country=~OWID_WRL`}
                    style={{ width: "100%", border: "none", height: "100%" }}
                    // use `updatedAt` as a proxy for when database-level settings such as breadcrumbs have changed
                    key={currentlySelectedYIndicatorId}
                />
            </>
        )
    }
}
