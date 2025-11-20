import { PropsWithChildren } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { getSearchQueryClient } from "../../search/searchClients.js"

export const BlockQueryClientProvider = ({ children }: PropsWithChildren) => {
    const queryClient = getSearchQueryClient()

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}
