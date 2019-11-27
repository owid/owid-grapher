import { InnerBlocks } from "@wordpress/block-editor";

const blockStyle = {
  border: "1px dashed lightgrey",
  padding: "0 1rem"
};

const TEMPLATE = [
  ["core/heading", { level: 3 }],
  [
    "core/columns",
    {},
    [
      ["core/column", { width: 25 }, [["core/image"]]],
      [
        "core/column",
        { width: 75 },
        [["core/paragraph", { placeholder: "Enter side content..." }]]
      ]
    ]
  ]
];

const AdditionalInformation = {
  title: "Additional information",
  icon: "info",
  category: "formatting",
  supports: {
    html: false
  },
  edit: () => {
    return (
      <div style={blockStyle}>
        <InnerBlocks template={TEMPLATE} />
      </div>
    );
  },
  save: props => <InnerBlocks.Content />
};

export default AdditionalInformation;
