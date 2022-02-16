import {
    InnerBlocks,
    RichText,
    URLInput,
    InspectorControls,
} from "@wordpress/block-editor"
import { createBlock } from "@wordpress/blocks"
import { Panel, PanelBody, PanelRow } from "@wordpress/components"
import MediaContainer from "../MediaContainer/MediaContainer.js"

const linkColor = "#2271b1"
const blockStyle = {
    border: `1px dashed ${linkColor}`,
    padding: "0.5rem",
}

const parser = new DOMParser()

const isLink = (text) => {
    return /^(https?:\/\/|\/)[\S]+$/.test(text)
}

const isInternalLink = (text) => {
    // Discouraging the use of protocol-less urls, e.g.
    // ourworldindata.org/child-mortality (not necessary, adds complexity). They
    // render fine fine however thanks to esc_url() on link url (see
    // prominent-link.php), which adds a protocol when missing.
    const BAKED_BASE_URL_REGEX = /^(https?:\/\/|\/)ourworldindata.org[\S]+$/
    return BAKED_BASE_URL_REGEX.test(text)
}

const isAnchorNode = (node) => {
    return node?.nodeName === "A"
}

const isTextNode = (node) => {
    return node?.nodeName === "#text"
}

const isInternalLinkNode = (node) => {
    return (
        (isAnchorNode(node) && isInternalLink(node.getAttribute("href"))) ||
        (isTextNode(node) && isInternalLink(node.textContent))
    )
}

export const getProminentLinkTitleAndUrl = (node) => {
    if (!node) return {}

    const textContent = node.textContent

    const url = isAnchorNode(node)
        ? node.getAttribute("href")
        : isLink(textContent)
        ? textContent
        : ""

    const title = textContent !== url ? textContent : ""

    return { title, url }
}

const getProminentLinkBlock = (node, content) => {
    const { title, url: linkUrl } = getProminentLinkTitleAndUrl(node)
    const blockContent = []

    if (content)
        blockContent.push(
            createBlock("core/paragraph", {
                content,
            })
        )

    return createBlock(
        "owid/prominent-link",
        {
            title,
            linkUrl,
        },
        blockContent
    )
}

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
                isMultiBlock: true,
                transform: (blocks) => {
                    return blocks.map(({ content }) => {
                        const parsed = parser.parseFromString(
                            content,
                            "text/html"
                        )

                        const body = parsed.querySelector("body")
                        const anchorNode = parsed.querySelector("body > a")

                        let node, blockContent
                        if (anchorNode) {
                            node = anchorNode.parentNode.removeChild(anchorNode)
                            blockContent = body.textContent
                        } else {
                            node = body
                        }

                        return getProminentLinkBlock(node, blockContent)
                    })
                },
            },
            {
                type: "raw",
                isMatch: (node) => {
                    return (
                        node?.nodeName === "P" &&
                        node.hasChildNodes() &&
                        node.childNodes.length === 1 &&
                        isInternalLinkNode(node.firstChild)
                    )
                },
                transform: (paragraphNode) => {
                    return getProminentLinkBlock(paragraphNode.firstChild)
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
                                onChange={(linkUrl, post) =>
                                    setAttributes({ linkUrl })
                                }
                            />
                        </PanelRow>
                        <PanelRow>
                            <MediaContainer
                                onSelectMedia={(media) => {
                                    // Try the "large" size URL, falling back to the "full" size URL below.
                                    // const src = get( media, [ 'sizes', 'large', 'url' ] ) || get( media, [ 'media_details', 'sizes', 'large', 'source_url' ] );
                                    setAttributes({
                                        mediaId: media.id,
                                        // mediaUrl: src || media.url,
                                        mediaUrl: media.url,
                                        mediaAlt: media.alt,
                                    })
                                }}
                                mediaId={mediaId}
                                mediaUrl={mediaUrl}
                                mediaAlt={mediaAlt}
                            />
                        </PanelRow>
                    </PanelBody>
                </InspectorControls>
                <div style={blockStyle}>
                    <RichText
                        tagName="h5"
                        value={title}
                        onChange={(newTitle) => {
                            setAttributes({ title: newTitle })
                        }}
                        placeholder={`Override title for ${linkUrl}`}
                        style={{
                            marginTop: 0,
                            marginBottom: 0,
                            color: isLink(linkUrl) ? linkColor : "red",
                            fontWeight: "normal",
                        }}
                    />
                    <div>
                        <InnerBlocks />
                    </div>
                </div>
            </>
        )
    },
    save: (props) => {
        return <InnerBlocks.Content />
    },
}

export default ProminentLink
