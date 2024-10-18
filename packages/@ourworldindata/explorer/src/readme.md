# Explorers

The Explorer is our component that allows easy navigating through a set of authored charts or charts generated on the fly. With the Explorer a reader can quickly navigate across dozens or hundreds of different chart views without leaving the page.

The Explorer component adds a control bar above the chart with controls including radios, dropdowns and checkboxes that the reader can use to change the chart on the page. The Explorer also adds a standalone entity selection tool on the left.

The Explorer works best on desktop but is also designed to work decently on mobile devices.

## Implementation Notes

The Explorer depends on our Chart library, but the Chart library does not have a dependency on the Explorer. You should be able to delete the `explorer` folder, remove a few links, and the rest of Grapher should still work fine.

### Explorer DSL

Explorers are created in a DSL that authors can edit in a spreadsheet which is parsed to create an instance of the ExplorerProgram class.

# Explorer Grammars

This folder also contains the declarative grammars that defines all the keywords and values authors can have in their Explorer programs.
