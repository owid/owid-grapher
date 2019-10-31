import { InnerBlocks } from "@wordpress/block-editor";

const blockStyle = {
  border: "1px dashed lightgrey",
  padding: "0 1rem"
};

const Summary = {
  title: "Summary",
  icon: "editor-ul",
  category: "formatting",
  edit: ({ className }) => {
    return (
      <div style={blockStyle} className={className}>
        <InnerBlocks template={[["core/heading", { content: "Summary", level: 2 }]]} />
      </div>
    );
  },
  save: props => (
    <nav>
      <InnerBlocks.Content />
    </nav>
  )
};

export default Summary;
