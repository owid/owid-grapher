import { ToggleControl } from "@wordpress/components"
const { withSelect, withDispatch } = wp.data
const { compose } = wp.compose

const GLOSSARY_META_FIELD = "owid_glossary_meta_field"

const Glossary = ({ hasGlossary = false, setGlossary }) => {
    return (
        <ToggleControl
            label="Highlight terms"
            help={
                hasGlossary
                    ? "All glossary terms highlighted."
                    : "No glossary terms highlighted."
            }
            checked={hasGlossary}
            onChange={(glossary) => {
                setGlossary(glossary)
            }}
        />
    )
}

const mapSelectToProps = function (select, props) {
    return {
        hasGlossary: select("core/editor").getEditedPostAttribute("meta")[
            GLOSSARY_META_FIELD
        ],
    }
}

const mapDispatchToProps = function (dispatch, props) {
    return {
        setGlossary: function (hasGlossary) {
            dispatch("core/editor").editPost({
                meta: { [GLOSSARY_META_FIELD]: hasGlossary },
            })
        },
    }
}

export default compose(
    withDispatch(mapDispatchToProps),
    withSelect(mapSelectToProps)
)(Glossary)
