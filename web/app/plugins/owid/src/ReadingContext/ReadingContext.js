// Uncomment to reactivate ReadingContext + yarn add entities

// import Autocomplete from "../Autocomplete/Autocomplete";
// const { RadioControl, Spinner } = wp.components;
// const { withSelect, withDispatch } = wp.data;
// const { compose } = wp.compose;
// const { useEffect, useState } = wp.element;
// import { decodeHTML } from "entities";

// const IN_SITU = 0;

// const ReadingContext = ({ readingContext = 0, setReadingContext }) => {
//   const [entriesOptions, setEntriesOptions] = useState([]);
//   // entryId is used to remember the id of the entry selected during an
//   // editing session, when switching between reading contexts (blog or entry).
//   // -1 is for preventing selecting the "Read on entry" option when
//   // readingContext=0 (as both radio options would be 0 and the last one - the
//   // entry option - would be selected)
//   const [entryId, setEntryId] = useState(readingContext || -1);

//   useEffect(() => {
//     (async () => {
//       const first = 200; // Hardcoded number of entries to be retrieved.
//       // Considered acceptable given the nature of entries
//       // and how many are exposed at a given time on the frontend.
//       const where = { categoryId: 44 };
//       const query = `query GetEntries($first: Int, $where: RootQueryToPageConnectionWhereArgs!) {
//           pages(first: $first, where: $where) {
//             edges {
//               node {
//                 pageId
//                 title
//               }
//             }
//           }
//         }`;

//       const response = await fetch(`/graphql`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Accept: "application/json"
//         },
//         body: JSON.stringify({
//           query,
//           variables: { first, where }
//         })
//       });
//       const json = await response.json();

//       setEntriesOptions(
//         // decodeHTML is just for presentational purposes only as only the
//         // pageId is stored in the meta field.
//         // Wating for GraphQL endpoint to expose a rendered / raw (?) version of the title
//         json.data.pages.edges.map(edge => ({
//           label: decodeHTML(edge.node.title),
//           value: edge.node.pageId
//         }))
//       );
//     })();
//   }, []);

//   return entriesOptions.length === 0 ? (
//     <Spinner />
//   ) : (
//     <>
//       <RadioControl
//         selected={readingContext.toString()}
//         options={[
//           { label: "Read in situ", value: IN_SITU.toString() },
//           { label: "Read on entry", value: entryId.toString() }
//         ]}
//         onChange={option => {
//           setReadingContext(parseInt(option));
//         }}
//       />
//       {readingContext !== IN_SITU ? (
//         <Autocomplete
//           options={entriesOptions}
//           initialValue={entryId}
//           onSelect={({ value }) => {
//             setReadingContext(value);
//             setEntryId(value);
//           }}
//         />
//       ) : null}
//     </>
//   );
// };

// const mapSelectToProps = function(select, props) {
//   return {
//     readingContext: select("core/editor").getEditedPostAttribute("meta")[
//       props.fieldName
//     ]
//   };
// };

// const mapDispatchToProps = function(dispatch, props) {
//   return {
//     setReadingContext: function(value) {
//       dispatch("core/editor").editPost({ meta: { [props.fieldName]: value } });
//     }
//   };
// };

// export default compose(
//   withDispatch(mapDispatchToProps),
//   withSelect(mapSelectToProps)
// )(ReadingContext);
