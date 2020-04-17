import { InnerBlocks } from "@wordpress/block-editor";
import { createBlock } from "@wordpress/blocks";

const blockStyle = {
  border: "1px dashed lightgrey",
  padding: "0 1rem",
};

const BLOCK_TEMPLATE = [
  ["core/paragraph", { placeholder: "Enter last updated information..." }],
];

const LastUpdated = {
  title: "Last updated",
  icon: "clock",
  category: "formatting",
  supports: {
    html: false,
    multiple: false,
  },
  transforms: {
    from: [
      {
        type: "block",
        blocks: ["core/paragraph"],
        transform: ({ content }) => {
          return createBlock("owid/last-updated", {}, [
            createBlock("core/paragraph", { content }),
          ]);
        },
      },
    ],
  },
  edit: ({ className }) => {
    return (
      <div style={blockStyle} className={className}>
        <InnerBlocks template={BLOCK_TEMPLATE} />
      </div>
    );
  },
  save: (props) => <InnerBlocks.Content />,
};

export default LastUpdated;
