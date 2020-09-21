import {
  InnerBlocks,
  InspectorControls,
  __experimentalBlockVariationPicker,
} from "@wordpress/block-editor";
import { useSelect, useDispatch } from "@wordpress/data";
import {
  SVG,
  Path,
  PanelBody,
  PanelRow,
  ToggleControl,
} from "@wordpress/components";
import { createBlock } from "@wordpress/blocks";
import { get, map } from "lodash";

const blockStyle = {
  border: "1px dashed lightgrey",
  padding: "0 1rem",
};

const variationsTemplates = [
  {
    name: "left-column-media",
    title: "Left column, with optional media",
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
    innerBlocks: [
      ["core/heading", { level: 3 }],
      [
        "core/columns",
        { className: "is-style-merge-left" },
        [
          ["core/column", { width: 25 }, [["core/image"]]],
          [
            "core/column",
            { width: 75 },
            [["core/paragraph", { placeholder: "Enter side content..." }]],
          ],
        ],
      ],
    ],
  },
  {
    name: "full-width-sticky-right",
    title: "Full width, sticky right",
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
    innerBlocks: [
      ["core/heading", { level: 3 }],
      [
        "core/columns",
        { className: "is-style-sticky-right" },
        [
          ["core/column", {}, [["core/paragraph"]]],
          ["core/column", {}, [["core/html"]]],
        ],
      ],
    ],
  },
];

const AdditionalInformation = {
  title: "Additional information",
  icon: "info",
  category: "formatting",
  supports: {
    html: false,
  },
  attributes: {
    defaultOpen: {
      type: "boolean",
    },
  },
  // Use of variations (previously template options) is still experimental and now undocumented.
  // Some useful references in the meantime:
  // - core columns blocks (where most of the following code comes from):
  //   https://github.com/WordPress/gutenberg/blob/master/packages/block-library/src/columns/edit.js
  // - https://plugins.trac.wordpress.org/changeset/2243801/nhsblocks (00-dashboard/index.js)
  edit: ({ clientId, name, attributes: { defaultOpen }, setAttributes }) => {
    const {
      blockType,
      defaultVariation,
      hasInnerBlocks,
      variations,
    } = useSelect(
      (select) => {
        const {
          getBlockVariations,
          getBlockType,
          getDefaultBlockVariation,
        } = select("core/blocks");

        return {
          blockType: getBlockType(name),
          defaultVariation: getDefaultBlockVariation(name, "block"),
          hasInnerBlocks:
            select("core/block-editor").getBlocks(clientId).length > 0,
          variations: getBlockVariations(name, "block"),
        };
      },
      [clientId, name]
    );

    const { replaceInnerBlocks } = useDispatch("core/block-editor");

    const createBlocksFromInnerBlocksTemplate = (innerBlocksTemplate) => {
      return map(innerBlocksTemplate, ([name, attributes, innerBlocks = []]) =>
        createBlock(
          name,
          attributes,
          createBlocksFromInnerBlocksTemplate(innerBlocks)
        )
      );
    };

    return (
      <>
        <InspectorControls>
          <PanelBody title="Default visibility" initialOpen={true}>
            <PanelRow>
              <ToggleControl
                label={`${defaultOpen ? "Open" : "Closed"} by default`}
                help="Defines whether the block is open (expanded) or closed (collapsed) by default. The reader will still be able to toggle the block's visibility independently of that setting."
                checked={!!defaultOpen}
                onChange={(isChecked) => {
                  setAttributes({ defaultOpen: isChecked });
                }}
              />
            </PanelRow>
          </PanelBody>
        </InspectorControls>
        <div style={blockStyle}>
          {hasInnerBlocks ? (
            <InnerBlocks />
          ) : (
            <__experimentalBlockVariationPicker
              icon={get(blockType, ["icon", "src"])}
              label={get(blockType, ["title"])}
              variations={variationsTemplates}
              onSelect={(nextVariation = defaultVariation) => {
                if (nextVariation.attributes) {
                  setAttributes(nextVariation.attributes);
                }
                if (nextVariation.innerBlocks) {
                  replaceInnerBlocks(
                    clientId,
                    createBlocksFromInnerBlocksTemplate(
                      nextVariation.innerBlocks
                    )
                  );
                }
              }}
              allowSkip={false}
            />
          )}
        </div>
      </>
    );
  },

  save: (props) => <InnerBlocks.Content />,
};

export default AdditionalInformation;
