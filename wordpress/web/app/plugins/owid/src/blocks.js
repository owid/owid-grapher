import Summary from "./Summary/Summary"
import ProminentLink from "./ProminentLink/ProminentLink"
import AdditionalInformation from "./AdditionalInformation/AdditionalInformation"
import Help from "./Help/Help"
import LastUpdated from "./LastUpdated/LastUpdated"
import Byline from "./Byline/Byline"
import Grid from "./Grid/Grid"
const { registerBlockType, registerBlockStyle } = wp.blocks
const { createHigherOrderComponent } = wp.compose
const { addFilter } = wp.hooks

registerBlockType("owid/summary", Summary)
registerBlockType("owid/prominent-link", ProminentLink)
registerBlockType("owid/additional-information", AdditionalInformation)
registerBlockType("owid/help", Help)
registerBlockType("owid/last-updated", LastUpdated)
registerBlockType("owid/byline", Byline)
registerBlockType("owid/grid", Grid)

registerBlockStyle("core/columns", {
    name: "sticky-right",
    label: "Sticky right",
})
registerBlockStyle("core/columns", {
    name: "sticky-left",
    label: "Sticky left",
})

registerBlockStyle("core/columns", {
    name: "merge-left",
    label: "Merge left",
})
registerBlockStyle("core/columns", {
    name: "side-by-side",
    label: "Side by side",
})

// Temporary fix https://github.com/WordPress/gutenberg/issues/9897#issuecomment-478362380
const allowColumnStyle = createHigherOrderComponent((BlockEdit) => {
    return (props) => {
        const { name, insertBlocksAfter = null } = props
        return name === "core/columns" && insertBlocksAfter === null ? (
            <div />
        ) : (
            <BlockEdit {...props} />
        )
    }
}, "allowColumnStyle")

addFilter("editor.BlockEdit", "owid/blocks/columns", allowColumnStyle)

registerBlockStyle("owid/prominent-link", {
    name: "thin",
    label: "Thin",
})
