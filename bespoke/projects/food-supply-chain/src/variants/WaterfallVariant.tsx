import { QueryClientProvider } from "@tanstack/react-query"

import { FoodSupplyChainConfig } from "../core/config.js"
import type { VariantProps } from "../../../../helpers/config.js"
import { queryClient } from "../core/data.js"

export function WaterfallVariant({
    config: _config,
    urls: _urls,
}: VariantProps<FoodSupplyChainConfig>): React.ReactElement {
    return (
        <QueryClientProvider client={queryClient}>
            <div>food-supply-chain</div>
        </QueryClientProvider>
    )
}
