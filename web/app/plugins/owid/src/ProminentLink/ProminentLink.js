import { InnerBlocks } from "@wordpress/block-editor";

const blockStyle = {
  border: "1px dashed lightgrey",
  padding: "0 1rem"
};

const ProminentLink = {
  title: "Prominent link",
  icon: "admin-links",
  category: "formatting",
  supports: {
    html: false
  },
  edit: ({ className }) => {
    return (
      <div style={blockStyle} className={className}>
        <InnerBlocks
          template={[
            ["core/heading", { level: 2 }],
            [
              "core/columns",
              {},
              [["core/column", {}, [["core/image"]]], ["core/column", {}, [["core/paragraph"]]]]
            ]
          ]}
        />
      </div>
    );
  },
  save: props => (
    <div>
      <InnerBlocks.Content />
    </div>
  )
};

export default ProminentLink;
