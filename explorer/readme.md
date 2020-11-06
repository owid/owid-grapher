# Explorers

The Explorer is our component that allows easy navigating through a set of authored charts or charts generated on the fly. With the Explorer a reader can quickly navigate across dozens or hundreds of different chart views without leaving the page.

The Explorer component adds a control bar above the chart with controls including radios, dropdowns and checkboxes that the reader can use to change the chart on the page. The Explorer also adds a standalone entity selection tool on the left.

The Explorer works best on desktop but is also designed to work decently on mobile devices.

## Implementation Notes

### Explorer DSL

Explorers are created in a DSL that authors can edit in a spreadsheet which is parsed to create an instance of the ExplorerProgram class.

### Folders

The `client/` folder contains all the code necessary for the browser to run Explorers.

The `admin/` folder contains the backend pages for authors to create explorers, and scripts for the baker to bake the Explorers to HTML pages for our static site.

The Explorer depends on our Chart library, but the Chart library does not have a dependency on the Explorer. You should be able to delete the `explorer` folder, remove a few links, and the rest of Grapher should still work fine.
