import { InnerBlocks } from "@wordpress/block-editor";

const blockStyle = {
  padding: "0 1rem",
  color: "#577291",
  backgroundColor: "#ebeef2",
};

const Byline = {
  title: "Byline",
  icon: "groups",
  category: "formatting",
  supports: {
    multiple: false,
    html: false,
  },
  edit: ({ className }) => {
    return (
      <div style={blockStyle} className={className}>
        <InnerBlocks />
      </div>
    );
  },
  save: (props) => <InnerBlocks.Content />,
};

export default Byline;
