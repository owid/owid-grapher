// Uncomment to reactivate ReadingContext + yarn add downshift match-sorter

// import React from "react";
// import Downshift from "downshift";
// import matchSorter from "match-sorter";

// export default ({ options, onSelect, initialValue }) => (
//   <Downshift
//     onChange={onSelect}
//     initialSelectedItem={options.filter(item => item.value === initialValue)[0]}
//     itemToString={item => (item ? item.label : "")}
//   >
//     {({
//       getInputProps,
//       getItemProps,
//       getLabelProps,
//       getMenuProps,
//       isOpen,
//       inputValue,
//       highlightedIndex,
//       selectedItem
//     }) => {
//       return (
//         <div>
//           {/* Mimic Wordpress <TextControl /> component (could not get it to integrate with Downshift)*/}
//           <div className="components-base-control">
//             <div class="components-base-control__field">
//               <input
//                 type="text"
//                 className="components-text-control__input"
//                 {...getInputProps({
//                   placeholder: "Enter entry title..."
//                 })}
//               />
//             </div>
//           </div>
//           <ul {...getMenuProps()}>
//             {isOpen
//               ? matchSorter(options, inputValue, { keys: ["label"] }).map(
//                   (item, index) => (
//                     <li
//                       {...getItemProps({
//                         key: item.label,
//                         index,
//                         item,
//                         style: {
//                           backgroundColor:
//                             highlightedIndex === index ? "#f3f4f5" : null,
//                           padding: "0.3rem 0.5rem",
//                           fontWeight: selectedItem === item ? "bold" : "normal",
//                           cursor: "pointer"
//                         }
//                       })}
//                     >
//                       {item.label}
//                     </li>
//                   )
//                 )
//               : null}
//           </ul>
//         </div>
//       );
//     }}
//   </Downshift>
// );
