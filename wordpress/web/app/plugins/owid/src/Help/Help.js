import { InnerBlocks } from "@wordpress/block-editor";
import { createBlock } from "@wordpress/blocks";

const blockStyle = {
  border: "1px dashed lightgrey",
  padding: "0 1rem",
  color: "#6e87a2",
};

const BLOCK_TEMPLATE = [
  ["core/heading", { level: 4 }],
  ["core/paragraph", { placeholder: "Enter help content..." }],
];

const Help = {
  title: "Help",
  icon: "editor-help",
  category: "formatting",
  supports: {
    html: false,
  },
  transforms: {
    from: [
      {
        type: "block",
        blocks: ["core/paragraph"],
        transform: ({ content }) => {
          return createBlock("owid/help", {}, [
            createBlock("core/heading", { level: 4 }),
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

export default Help;
