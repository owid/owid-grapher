import { TextareaControl } from "@wordpress/components";
const { withSelect, withDispatch } = wp.data;
const { compose } = wp.compose;
const md = require("markdown-it")();

const KeyPerformanceIndicators = ({
  keyPerformanceIndicators,
  setKeyPerformanceIndicators
}) => {
  const helpText = `Example:<br /> 
  - KPI with some <strong>**bold text**</strong><br />
  - another KPI`;

  return (
    <>
      <TextareaControl
        label="List some Key Performance Indicators"
        help={<span dangerouslySetInnerHTML={{ __html: helpText }}></span>}
        value={keyPerformanceIndicators.raw || ""}
        onChange={kpi => setKeyPerformanceIndicators(kpi)}
      />
      {keyPerformanceIndicators.rendered && (
        <>
          <h3>Preview</h3>
          <div
            dangerouslySetInnerHTML={{
              __html: keyPerformanceIndicators.rendered
            }}
          />
        </>
      )}
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
      dispatch("core/editor").editPost({
        meta: { [props.fieldName]: { raw: value, rendered: md.render(value) } }
      });
    }
  };
};

export default compose(
  withDispatch(mapDispatchToProps),
  withSelect(mapSelectToProps)
)(KeyPerformanceIndicators);
