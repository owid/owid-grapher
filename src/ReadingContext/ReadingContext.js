import apiFetch from "@wordpress/api-fetch";
import Autocomplete from "../Autocomplete/Autocomplete";
const { RadioControl, SelectControl, Spinner } = wp.components;
const { withSelect, withDispatch } = wp.data;
const { compose } = wp.compose;
const { useEffect, useState } = wp.element;

const IN_SITU = 0;

const ReadingContext = ({ readingContext = 0, setReadingContext, editorBlocks }) => {
  const [entriesOptions, setEntriesOptions] = useState([]);
  // entryId is used to remember the id of the entry selected during an
  // editing session, when switching between reading contexts (blog or entry).
  // -1 is for preventing selecting the "Read on entry" option when
  // readingContext=0 (as both radio options would be 0 and the last one - the
  // entry option - would be selected)
  const [entryId, setEntryId] = useState(readingContext || -1);

  useEffect(() => {
    apiFetch({ path: "/wp/v2/pages?per_page=10&categories=44" }).then(entries => {
      setEntriesOptions(
        entries.map(entry => ({
          label: entry.title_raw,
          value: entry.id
        }))
      );
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
          { label: "Read on entry", value: entryId.toString() }
        ]}
        onChange={option => {
          setReadingContext(parseInt(option));
        }}
      />
      {readingContext !== IN_SITU ? (
        <Autocomplete
          options={entriesOptions}
          initialValue={entryId}
          onSelect={({ value }) => {
            setReadingContext(value);
            setEntryId(value);
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
