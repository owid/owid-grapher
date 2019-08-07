const { TextControl } = wp.components;
const { withSelect, withDispatch } = wp.data;
const { compose } = wp.compose;

const DeepLink = ({ metaFieldValue, setMetaFieldValue }) => {
  return (
    <TextControl
      label="Read on entry"
      value={metaFieldValue}
      onChange={content => setMetaFieldValue(content)}
    />
  );
};

const mapSelectToProps = function(select, props) {
  return {
    metaFieldValue: select("core/editor").getEditedPostAttribute("meta")[props.fieldName]
  };
};

const mapDispatchToProps = function(dispatch, props) {
  return {
    setMetaFieldValue: function(value) {
      dispatch("core/editor").editPost({ meta: { [props.fieldName]: value } });
    }
  };
};

export default compose(
  withDispatch(mapDispatchToProps),
  withSelect(mapSelectToProps)
)(DeepLink);
