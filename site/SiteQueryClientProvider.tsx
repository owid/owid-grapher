import { PropsWithChildren } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { getSiteQueryClient } from "./queryClient.js"

export const SiteQueryClientProvider = ({ children }: PropsWithChildren) => {
    const queryClient = getSiteQueryClient()

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}
