import React, { useEffect, useState } from "react"
import { ExplorerProgram, makeFullPath } from "../explorer/ExplorerProgram.js"
import { AdminManager } from "./AdminManager.js"
import { GitCmsClient } from "../gitCms/GitCmsClient.js"
import { ExplorerControlPanel } from "../explorer/ExplorerControls.js"
import { GIT_CMS_BASE_ROUTE } from "../gitCms/GitCmsConstants.js"

export interface ExplorerDataPageProps {
    slug: string
    gitCmsBranchName: string
    manager?: AdminManager
}

export const ExplorerDataPage = ({
    slug,
    gitCmsBranchName,
    manager,
}: ExplorerDataPageProps) => {
    const [explorer, setExplorer] = useState<ExplorerProgram | undefined>(
        undefined
    )
    useEffect(() => {
        let ignore = false
        const fetchData = async () => {
            const gitCmsClient = new GitCmsClient(GIT_CMS_BASE_ROUTE)
            return gitCmsClient.readRemoteFile({
                filepath: makeFullPath(slug),
            })
        }
        void fetchData().then((gitCmsData) => {
            if (!ignore)
                setExplorer(new ExplorerProgram(slug, gitCmsData.content))
        })
        return () => {
            ignore = true
        }
    }, [slug, setExplorer])
    const panel = explorer
        ? explorer.decisionMatrix.choicesWithAvailability.map((choice) => (
              <ExplorerControlPanel
                  key={choice.title}
                  choice={choice}
                  isMobile={false}
              />
          ))
        : null
    return <>{panel}</>
}
