import { LatestNewsletter, TagGraphRoot } from "@ourworldindata/types"
import { LatestSearch } from "./LatestSearch.js"
import { getLiteSearchClient } from "../search/searchClients.js"
import { SiteQueryClientProvider } from "../SiteQueryClientProvider.js"

export const LatestSearchWrapper = ({
    topicTagGraph,
    newsletters,
}: {
    topicTagGraph: TagGraphRoot
    newsletters: LatestNewsletter[]
}) => {
    const liteSearchClient = getLiteSearchClient()

    return (
        <SiteQueryClientProvider>
            <LatestSearch
                topicTagGraph={topicTagGraph}
                newsletters={newsletters}
                liteSearchClient={liteSearchClient}
            />
        </SiteQueryClientProvider>
    )
}
