import { ArchiveVersions } from "@ourworldindata/types"
import { QueryClient, useQuery } from "@tanstack/react-query"

// The convention is to use a single query client shared via
// QueryClientProvider, but currently we don't render the two components where
// we fetch versions in the same React tree (they are hydrated separately), so
// we share the query client this way.
const queryClient = new QueryClient()

export interface UseVersionsQueryOptions {
    enabled?: boolean
}

export async function fetchVersions(url: string): Promise<ArchiveVersions> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to fetch versions file: ${response.statusText}`)
    }
    return response.json()
}

export function useVersionsQuery(
    url?: string,
    options?: UseVersionsQueryOptions
) {
    return useQuery(
        {
            queryKey: ["archive-versions"],
            queryFn: () => {
                if (!url) {
                    throw new Error("URL is required")
                }
                return fetchVersions(url)
            },
            enabled: Boolean(url) && (options?.enabled ?? true),
            staleTime: "static", // Fetch only on page load.
        },
        queryClient
    )
}
