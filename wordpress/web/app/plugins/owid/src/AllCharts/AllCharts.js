import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"
import { registerBlockType } from "@wordpress/blocks"
import block from "./block.json"

const blockStyle = {
    border: "1px dashed lightgrey",
    padding: "0 1rem",
    marginBottom: "1rem",
    color: "darkgrey",
}

const AllCharts = {
    edit: () => {
        const blockProps = useBlockProps({ style: blockStyle })

        return (
            <div {...blockProps}>
                <h3>All our interactive charts</h3>
                <p>
                    <em>
                        All charts sharing a grapher tag with this page will be
                        automatically listed here.{" "}
                        <a
                            href="https://www.notion.so/owid/All-our-charts-block-126cf21d679341ae94269218373c0451"
                            target="_blank"
                        >
                            Read more
                        </a>
                    </em>
                </p>
            </div>
        )
    },
}

export const registerAllCharts = () => {
    registerBlockType(block.name, AllCharts)
}
