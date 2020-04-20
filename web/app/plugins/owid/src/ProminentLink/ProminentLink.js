import {
  InnerBlocks,
  RichText,
  URLInput,
  InspectorControls,
} from "@wordpress/block-editor";
import { createBlock } from "@wordpress/blocks";
import { Panel, PanelBody, PanelRow } from "@wordpress/components";
import MediaContainer from "../MediaContainer/MediaContainer";

const blockStyle = {
  border: "1px dashed lightgrey",
  padding: "1rem",
};

const ProminentLink = {
  title: "Prominent link",
  icon: "admin-links",
  category: "formatting",
  supports: {
    html: false,
  },
  attributes: {
    title: {
      type: "string",
    },
    linkUrl: {
      type: "string",
    },
    mediaId: {
      type: "integer",
    },
    mediaUrl: {
      type: "string",
    },
    mediaAlt: {
      type: "string",
    },
  },
  transforms: {
    from: [
      {
        type: "block",
        blocks: ["core/paragraph"],
        transform: ({ content }) => {
          return createBlock("owid/prominent-link", {}, [
            createBlock("core/paragraph", { content }),
          ]);
        },
      },
    ],
  },
  edit: ({
    attributes: { title, linkUrl, mediaId, mediaUrl, mediaAlt },
    setAttributes,
  }) => {
    return (
      <>
        <InspectorControls>
          <PanelBody title="Link" initialOpen={true}>
            <PanelRow>
              <URLInput
                label="URL"
                value={linkUrl}
                onChange={(linkUrl, post) => setAttributes({ linkUrl })}
              />
            </PanelRow>
          </PanelBody>
        </InspectorControls>
        <div style={blockStyle}>
          <RichText
            tagName="h3"
            value={title}
            onChange={(newTitle) => {
              setAttributes({ title: newTitle });
            }}
            placeholder="Write heading..."
          />
          <div style={{ display: "flex" }}>
            <div style={{ flex: "1 0 40%", marginRight: "1rem" }}>
              <MediaContainer
                onSelectMedia={(media) => {
                  // Try the "large" size URL, falling back to the "full" size URL below.
                  // const src = get( media, [ 'sizes', 'large', 'url' ] ) || get( media, [ 'media_details', 'sizes', 'large', 'source_url' ] );
                  setAttributes({
                    mediaId: media.id,
                    // mediaUrl: src || media.url,
                    mediaUrl: media.url,
                    mediaAlt: media.alt,
                  });
                }}
                mediaId={mediaId}
                mediaUrl={mediaUrl}
                mediaAlt={mediaAlt}
              />
            </div>
            <div style={{ flex: "1 0 60%" }}>
              <InnerBlocks />
            </div>
          </div>
        </div>
      </>
    );
  },
  save: (props) => {
    return <InnerBlocks.Content />;
  },
};

export default ProminentLink;
