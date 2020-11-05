import { TextareaControl } from "@wordpress/components"
const { withSelect, withDispatch } = wp.data
const { compose } = wp.compose
const md = require("markdown-it")()

const KEY_PERFORMANCE_INDICATORS_META_FIELD =
    "owid_key_performance_indicators_meta_field"

const KeyPerformanceIndicators = ({
    keyPerformanceIndicators = { raw: "", rendered: "" },
    setKeyPerformanceIndicators,
}) => {
    const helpText = `Example:<br />
  KPI with some <strong>**bold text**</strong><br />
  [EMPTY LINE]<br />
  KPI subtitle`

    return (
        <>
            <TextareaControl
                label="List some Key Performance Indicators"
                help={
                    <span dangerouslySetInnerHTML={{ __html: helpText }}></span>
                }
                value={keyPerformanceIndicators.raw}
                onChange={(kpiRaw) => setKeyPerformanceIndicators(kpiRaw)}
            />
            <h3>Preview</h3>
            <div
                className="md-preview"
                dangerouslySetInnerHTML={{
                    __html: keyPerformanceIndicators.rendered,
                }}
            />
        </>
    )
}

const mapSelectToProps = function (select, props) {
    return {
        keyPerformanceIndicators: select("core/editor").getEditedPostAttribute(
            "meta"
        )[KEY_PERFORMANCE_INDICATORS_META_FIELD],
    }
}

const mapDispatchToProps = function (dispatch, props) {
    return {
        setKeyPerformanceIndicators: function (raw) {
            dispatch("core/editor").editPost({
                meta: {
                    [KEY_PERFORMANCE_INDICATORS_META_FIELD]: {
                        raw,
                        rendered: md.render(raw),
                    },
                },
            })
        },
    }
}

export default compose(
    withDispatch(mapDispatchToProps),
    withSelect(mapSelectToProps)
)(KeyPerformanceIndicators)
