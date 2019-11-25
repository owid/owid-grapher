import { InnerBlocks, RichText } from "@wordpress/block-editor";
import { createBlock } from "@wordpress/blocks";

const blockStyle = {
  border: "1px dashed lightgrey",
  padding: "0 1rem"
};

const AdditionalInformation = {
  title: "Additional information",
  icon: "info",
  category: "formatting",
  supports: {
    html: false
  },
  attributes: {
    title: {
      type: "string"
    }
  },
  transforms: {
    from: [
      {
        type: "block",
        blocks: ["core/paragraph"],
        transform: ({ content }) => {
          return createBlock("owid/additional-information", {}, [
            createBlock("core/paragraph", { content })
          ]);
        }
      }
    ]
  },
  edit: ({ attributes: { title }, setAttributes }) => {
    return (
      <div style={blockStyle}>
        <RichText
          tagName="h3"
          value={title}
          onChange={newTitle => {
            setAttributes({ title: newTitle });
          }}
          placeholder="Write heading..."
        />
        <InnerBlocks />
      </div>
    );
  },
  save: props => <InnerBlocks.Content />
};

export default AdditionalInformation;
