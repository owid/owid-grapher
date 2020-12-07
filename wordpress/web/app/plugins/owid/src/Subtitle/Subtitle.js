import { InnerBlocks } from "@wordpress/block-editor"

const blockStyle = {
    padding: "0 1rem",
}

const Subtitle = {
    title: "Subtitle",
    icon: "heading",
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

export default Subtitle
