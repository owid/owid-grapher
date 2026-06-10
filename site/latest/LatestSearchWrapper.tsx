import { TagGraphRoot } from "@ourworldindata/types"
import { LatestSearch } from "./LatestSearch.js"
import { getLiteSearchClient } from "../search/searchClients.js"
import { SiteQueryClientProvider } from "../SiteQueryClientProvider.js"

export const LatestSearchWrapper = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const liteSearchClient = getLiteSearchClient()

    return (
        <SiteQueryClientProvider>
            <LatestSearch
                topicTagGraph={topicTagGraph}
                liteSearchClient={liteSearchClient}
            />
        </SiteQueryClientProvider>
    )
}
