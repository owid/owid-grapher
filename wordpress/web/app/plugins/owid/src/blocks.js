import Summary from "./Summary/Summary.js"
import ProminentLink from "./ProminentLink/ProminentLink.js"
import AdditionalInformation from "./AdditionalInformation/AdditionalInformation.js"
import Help from "./Help/Help.js"
import LastUpdated from "./LastUpdated/LastUpdated.js"
import Byline from "./Byline/Byline.js"
import Grid from "./Grid/Grid.js"
import Card from "./Card/Card.js"
import { registerKeyInsightsSlider } from "./KeyInsightsSlider/KeyInsightsSlider.js"
import { registerKeyInsight } from "./KeyInsight/KeyInsight.js"
import { registerTechnicalText } from "./TechnicalText/TechnicalText.js"
import { registerAllCharts } from "./AllCharts/AllCharts.js"
import { registerExpandableParagraph } from "./ExpandableParagraph/ExpandableParagraph.js"
import { registerStickyNav } from "./StickyNav/StickyNav.js"
import { registerCitationSnippet } from "./CitationSnippet/CitationSnippet.js"
import { registerFrontMatter } from "./FrontMatter/FrontMatter.js"
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
registerBlockType("owid/card", Card)
registerKeyInsightsSlider()
registerKeyInsight()
registerTechnicalText()
registerAllCharts()
registerExpandableParagraph()
registerStickyNav()
registerCitationSnippet()
registerFrontMatter()

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

registerBlockStyle("core/media-text", {
    name: "biography",
    label: "Biography",
})
