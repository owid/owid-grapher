import { InnerBlocks, RichText } from "@wordpress/block-editor";
import { createBlock } from "@wordpress/blocks";
import MediaContainer from "../MediaContainer/MediaContainer";

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
    },
    mediaId: {
      type: "integer"
    },
    mediaUrl: {
      type: "string"
    },
    mediaAlt: {
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
  edit: ({
    attributes: { title, mediaId, mediaUrl, mediaAlt },
    setAttributes
  }) => {
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
        <div style={{ display: "flex" }}>
          <div style={{ flex: "1 0 40%", marginRight: "1rem" }}>
            <MediaContainer
              onSelectMedia={media => {
                // Try the "large" size URL, falling back to the "full" size URL below.
                // const src = get( media, [ 'sizes', 'large', 'url' ] ) || get( media, [ 'media_details', 'sizes', 'large', 'source_url' ] );
                setAttributes({
                  mediaId: media.id,
                  // mediaUrl: src || media.url,
                  mediaUrl: media.url,
                  mediaAlt: media.alt
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
    );
  },
  save: props => <InnerBlocks.Content />
};

export default AdditionalInformation;
