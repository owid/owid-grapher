import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"
import { registerBlockType } from "@wordpress/blocks"
import block from "./block.json"

const blockStyle = {
    border: "1px dashed lightgrey",
    padding: "0 1rem",
    marginBottom: "1rem",
    color: "darkgrey",
}

const StickyNav = {
    edit: () => {
        const blockProps = useBlockProps({ style: blockStyle })
        return (
            <div {...blockProps}>
                <h4>Sticky nav</h4>
                <p>
                    For each menu item you want, add a "Custom Link" to this
                    block
                </p>
                <p>
                    Set the target to the{" "}
                    <a
                        href="https://wordpress.org/support/article/page-jumps/#put-a-html-anchor"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        HTML anchor
                    </a>{" "}
                    of the heading you want to link to
                </p>
                <p>e.g. #data-explorers</p>
                <p>
                    And then edit the link so that the title is "Data Explorers"
                    and not "#data-explorers"
                </p>
                <InnerBlocks allowedBlocks={["core/navigation-link"]} />
            </div>
        )
    },
    save: () => <InnerBlocks.Content />,
}

export const registerStickyNav = () => {
    registerBlockType(block.name, StickyNav)
}
