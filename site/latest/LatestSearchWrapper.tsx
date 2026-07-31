import { TagGraphRoot } from "@ourworldindata/types"
import { LatestSearch } from "./LatestSearch.js"
import { getTypesenseClient } from "../search/typesense/typesenseClient.js"
import { SiteQueryClientProvider } from "../SiteQueryClientProvider.js"

export const LatestSearchWrapper = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const typesenseClient = getTypesenseClient()

    return (
        <SiteQueryClientProvider>
            <LatestSearch
                topicTagGraph={topicTagGraph}
                typesenseClient={typesenseClient}
            />
        </SiteQueryClientProvider>
    )
}
