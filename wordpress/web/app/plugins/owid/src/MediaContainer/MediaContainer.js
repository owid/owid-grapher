// Simplified version of Wordpress's MediaContainer
// https://github.com/WordPress/gutenberg/blob/master/packages/block-library/src/media-text/media-container.js

import { IconButton, Toolbar } from "@wordpress/components";
import {
  BlockControls,
  MediaPlaceholder,
  MediaUpload
} from "@wordpress/block-editor";
import { Component } from "@wordpress/element";

class MediaContainer extends Component {
  renderToolbarEditButton() {
    const { mediaId, onSelectMedia } = this.props;
    return (
      <BlockControls>
        <Toolbar>
          <MediaUpload
            onSelect={onSelectMedia}
            allowedTypes={["image"]}
            value={mediaId}
            render={({ open }) => (
              <IconButton
                className="components-toolbar__control"
                label="Edit media"
                icon="edit"
                onClick={open}
              />
            )}
          />
        </Toolbar>
      </BlockControls>
    );
  }

  renderImage() {
    const { mediaAlt, mediaUrl, className } = this.props;
    return (
      <>
        {this.renderToolbarEditButton()}
        <figure className={className}>
          <img src={mediaUrl} alt={mediaAlt} />
        </figure>
      </>
    );
  }

  renderPlaceholder() {
    const { onSelectMedia, className } = this.props;
    return (
      <MediaPlaceholder
        className={className}
        onSelect={onSelectMedia}
        accept="image/*"
        allowedTypes={["image"]}
      />
    );
  }

  render() {
    const { mediaUrl } = this.props;
    if (mediaUrl) {
      return this.renderImage();
    }
    return this.renderPlaceholder();
  }
}

export default MediaContainer;
