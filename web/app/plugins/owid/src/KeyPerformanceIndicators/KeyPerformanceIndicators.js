import { TextareaControl } from "@wordpress/components";
const { withSelect, withDispatch } = wp.data;
const { compose } = wp.compose;
const md = require("markdown-it")();

const KeyPerformanceIndicators = ({
  keyPerformanceIndicators = "",
  setKeyPerformanceIndicators
}) => {
  return (
    <>
      <TextareaControl
        label="Text"
        help="Enter some text"
        value={keyPerformanceIndicators}
        onChange={keyPerformanceIndicators =>
          setKeyPerformanceIndicators(keyPerformanceIndicators)
        }
      />
      <div
        dangerouslySetInnerHTML={{
          __html: md.render(keyPerformanceIndicators)
        }}
      />
    </>
  );
};

const mapSelectToProps = function(select, props) {
  return {
    keyPerformanceIndicators: select("core/editor").getEditedPostAttribute(
      "meta"
    )[props.fieldName]
  };
};

const mapDispatchToProps = function(dispatch, props) {
  return {
    setKeyPerformanceIndicators: function(value) {
      dispatch("core/editor").editPost({ meta: { [props.fieldName]: value } });
    }
  };
};

export default compose(
  withDispatch(mapDispatchToProps),
  withSelect(mapSelectToProps)
)(KeyPerformanceIndicators);
