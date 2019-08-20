import React from "react";
import Downshift from "downshift";
import matchSorter from "match-sorter";

export default ({ options, onSelect, initialValue }) => (
  <Downshift
    onChange={onSelect}
    initialSelectedItem={options.filter(item => item.value === initialValue)[0]}
    itemToString={item => (item ? item.label : "")}
  >
    {({
      getInputProps,
      getItemProps,
      getLabelProps,
      getMenuProps,
      isOpen,
      inputValue,
      highlightedIndex,
      selectedItem
    }) => {
      return (
        <div>
          <input
            {...getInputProps({
              placeholder: "Enter entry title..."
            })}
          />
          <ul {...getMenuProps()}>
            {isOpen
              ? matchSorter(options, inputValue, { keys: ["label"] }).map((item, index) => (
                  <li
                    {...getItemProps({
                      key: item.label,
                      index,
                      item,
                      style: {
                        backgroundColor: highlightedIndex === index ? "#f3f4f5" : null,
                        padding: "0.3rem 0.5rem",
                        fontWeight: selectedItem === item ? "bold" : "normal"
                      }
                    })}
                  >
                    {item.label}
                  </li>
                ))
              : null}
          </ul>
        </div>
      );
    }}
  </Downshift>
);
