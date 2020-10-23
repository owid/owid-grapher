import { InnerBlocks } from "@wordpress/block-editor"

const blockStyle = {
    border: "1px dashed lightgrey",
    padding: "0 1rem",
    // see style.css for additional editor styles
}

const Grid = {
    title: "Grid",
    icon: "grid-view",
    category: "formatting",
    edit: ({ className }) => {
        return (
            <div style={blockStyle} className={className}>
                <InnerBlocks />
            </div>
        )
    },
    save: (props) => <InnerBlocks.Content />,
}

export default Grid
