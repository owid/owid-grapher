import { TextareaControl } from "@wordpress/components"
const { withSelect, withDispatch } = wp.data
const { compose } = wp.compose

const SUBTITLE_META_FIELD = "owid_subtitle_meta_field"

const Subtitle = ({ subtitle = "", setSubtitle }) => {
    return (
        <TextareaControl
            label="The page subtitle"
            value={subtitle}
            onChange={(text) => setSubtitle(text)}
        />
    )
}

const mapSelectToProps = function (select, props) {
    return {
        subtitle: select("core/editor").getEditedPostAttribute("meta")[
            SUBTITLE_META_FIELD
        ],
    }
}

const mapDispatchToProps = function (dispatch, props) {
    return {
        setSubtitle: function (subtitle) {
            dispatch("core/editor").editPost({
                meta: { [SUBTITLE_META_FIELD]: subtitle },
            })
        },
    }
}

export default compose(
    withDispatch(mapDispatchToProps),
    withSelect(mapSelectToProps)
)(Subtitle)
