import Summary from "./Summary/Summary";
import ProminentLink from "./ProminentLink/ProminentLink";
const {
  registerBlockType,
  registerBlockStyle,
  unregisterBlockType
} = wp.blocks;
const { createHigherOrderComponent } = wp.compose;
const { addFilter } = wp.hooks;

// Temporary hack to facilitate conversion of classic posts to Gutenberg
// https://github.com/WordPress/gutenberg/issues/11723#issuecomment-439628591
// Recommended way (https://developer.wordpress.org/block-editor/developers/filters/block-filters/#using-a-blacklist) not working
window.onload = function() {
  unregisterBlockType("core/shortcode");
};

registerBlockType("owid/summary", Summary);
registerBlockType("owid/prominent-link", ProminentLink);

registerBlockStyle("core/columns", {
  name: "sticky-right",
  label: "Sticky right"
});

registerBlockStyle("core/columns", {
  name: "side-by-side",
  label: "Side by side"
});

// Temporary fix https://github.com/WordPress/gutenberg/issues/9897#issuecomment-478362380
const allowColumnStyle = createHigherOrderComponent(BlockEdit => {
  return props => {
    const { name, insertBlocksAfter = null } = props;
    return name === "core/columns" && insertBlocksAfter === null ? (
      <div />
    ) : (
      <BlockEdit {...props} />
    );
  };
}, "allowColumnStyle");

addFilter("editor.BlockEdit", "owid/blocks/columns", allowColumnStyle);
