import apiFetch from "@wordpress/api-fetch";
const { RadioControl, SelectControl, Spinner } = wp.components;
const { withSelect, withDispatch } = wp.data;
const { compose } = wp.compose;
const { useEffect, useState } = wp.element;

const IN_SITU = 0;

const ReadingContext = ({ readingContext = 0, setReadingContext, editorBlocks }) => {
  const [entriesOptions, setEntriesOptions] = useState([]);
  // transientEntryId is used to remember the id of the entry selected during an
  // editing session, when switching between reading contexts (blog or entry).
  const [transientEntryId, setTransientEntryId] = useState(-1);

  useEffect(() => {
    apiFetch({ path: "/wp/v2/pages?per_page=100&categories=44" }).then(entries => {
      setEntriesOptions(
        entries.map(entry => ({
          label: entry.title.rendered,
          value: entry.id.toString()
        }))
      );
      setTransientEntryId(readingContext || entries[0].id.toString());
    });
  }, []);

  return entriesOptions.length === 0 ? (
    <Spinner />
  ) : (
    <>
      <RadioControl
        selected={readingContext.toString()}
        options={[
          { label: "Read in situ", value: IN_SITU.toString() },
          { label: "Read on entry", value: transientEntryId.toString() }
        ]}
        onChange={option => {
          setReadingContext(parseInt(option));
        }}
      />
      {readingContext !== IN_SITU ? (
        <SelectControl
          value={readingContext.toString()}
          options={entriesOptions}
          onChange={entryId => {
            const entryIdInt = parseInt(entryId);
            setReadingContext(entryIdInt);
            setTransientEntryId(entryIdInt);
          }}
        />
      ) : null}
    </>
  );
};

const mapSelectToProps = function(select, props) {
  return {
    readingContext: select("core/editor").getEditedPostAttribute("meta")[props.fieldName]
  };
};

const mapDispatchToProps = function(dispatch, props) {
  return {
    setReadingContext: function(value) {
      dispatch("core/editor").editPost({ meta: { [props.fieldName]: value } });
    }
  };
};

export default compose(
  withDispatch(mapDispatchToProps),
  withSelect(mapSelectToProps)
)(ReadingContext);
