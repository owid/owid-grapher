import { InnerBlocks } from "@wordpress/block-editor"

const blockStyle = {
    border: "1px dashed lightgrey",
    padding: "0 1rem",
}

const Summary = {
    title: "Summary",
    icon: "editor-ul",
    category: "formatting",
    supports: {
        multiple: false,
        html: false,
    },
    edit: ({ className }) => {
        return (
            <div style={blockStyle} className={className}>
                <InnerBlocks />
            </div>
        )
    },
    save: (props) => <InnerBlocks.Content />,
}

export default Summary
