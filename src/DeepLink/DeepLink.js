import apiFetch from "@wordpress/api-fetch";
const { RadioControl, SelectControl, Spinner } = wp.components;
const { withSelect, withDispatch } = wp.data;
const { compose } = wp.compose;
const { useEffect, useState } = wp.element;

const DeepLink = ({ metaFieldValue, setMetaFieldValue, editorBlocks }) => {
  const [entriesOptions, setEntriesOptions] = useState([]);
  const [transientEntryId, setTransientEntryId] = useState();

  useEffect(() => {
    apiFetch({ path: "/wp/v2/posts" }).then(entries => {
      setEntriesOptions(
        entries.map(entry => ({
          label: entry.title.rendered,
          value: entry.id
        }))
      );
      setTransientEntryId(entries[0].id);
    });
  }, []);

  return entriesOptions.length === 0 ? (
    <Spinner />
  ) : (
    <>
      <RadioControl
        label="Reading context"
        selected={metaFieldValue}
        options={[
          { label: "Read on blog post", value: 0 },
          { label: "Read on entry", value: transientEntryId }
        ]}
        onChange={option => {
          setMetaFieldValue(parseInt(option));
        }}
      />
      {metaFieldValue !== 0 ? (
        <SelectControl
          value={metaFieldValue}
          options={entriesOptions}
          onChange={entryId => {
            const entryIdInt = parseInt(entryId);
            setMetaFieldValue(entryIdInt);
            setTransientEntryId(entryIdInt);
          }}
        />
      ) : null}
    </>
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
