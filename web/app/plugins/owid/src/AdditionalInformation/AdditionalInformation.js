import { InnerBlocks } from "@wordpress/block-editor";
import { useSelect } from "@wordpress/data";
import { useState } from "@wordpress/element";
import { SVG, Path } from "@wordpress/components";

const blockStyle = {
  border: "1px dashed lightgrey",
  padding: "0 1rem"
};

const TEMPLATE_OPTIONS = [
  {
    title: "Left aligned, with optional media",
    icon: (
      <SVG
        width="48"
        height="48"
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
      >
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M39 12C40.1046 12 41 12.8954 41 14V34C41 35.1046 40.1046 36 39 36H9C7.89543 36 7 35.1046 7 34V14C7 12.8954 7.89543 12 9 12H39ZM39 34V14H20V34H39ZM18 34H9V14H18V34Z"
        />
      </SVG>
    ),
    template: [
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
    ]
  },
  {
    title: "Full width, automatic layout",
    icon: (
      <SVG
        width="48"
        height="48"
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
      >
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M39 12C40.1046 12 41 12.8954 41 14V34C41 35.1046 40.1046 36 39 36H9C7.89543 36 7 35.1046 7 34V14C7 12.8954 7.89543 12 9 12H39ZM39 34V14H25V34H39ZM23 34H9V14H23V34Z"
        />
      </SVG>
    ),
    template: [
      ["core/heading", { level: 3 }],
      ["core/paragraph", { placeholder: "Enter content..." }]
    ]
  }
];

const AdditionalInformation = {
  title: "Additional information",
  icon: "info",
  category: "formatting",
  supports: {
    html: false
  },
  edit: ({ clientId }) => {
    // from https://github.com/WordPress/gutenberg/blob/master/packages/block-library/src/columns/edit.js
    const { count } = useSelect(select => {
      return {
        count: select("core/block-editor").getBlockCount(clientId)
      };
    });

    const [template, setTemplate] = useState(
      // As long as there is a block, we set the template to the first one in
      // the list to prevent the template selector from appearing.
      // Not accurate but no side-effects so far.
      count ? TEMPLATE_OPTIONS[0].template : null
    );

    return (
      <div style={blockStyle}>
        <InnerBlocks
          template={template}
          __experimentalTemplateOptions={TEMPLATE_OPTIONS}
          __experimentalOnSelectTemplateOption={setTemplate}
        />
      </div>
    );
  },
  save: props => <InnerBlocks.Content />
};

export default AdditionalInformation;
