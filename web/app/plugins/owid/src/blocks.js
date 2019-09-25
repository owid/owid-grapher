const { registerBlockStyle } = wp.blocks;
const { createHigherOrderComponent } = wp.compose;
const { addFilter } = wp.hooks;

registerBlockStyle("core/columns", {
  name: "sticky-right",
  label: "Sticky right"
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
