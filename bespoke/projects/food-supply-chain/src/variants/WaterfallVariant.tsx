import { FoodSupplyChainConfig } from "../core/config.js"
import type { VariantProps } from "../../../../helpers/config.js"

export function WaterfallVariant({
    config: _config,
    urls: _urls,
}: VariantProps<FoodSupplyChainConfig>): React.ReactElement {
    return <div>food-supply-chain</div>
}
