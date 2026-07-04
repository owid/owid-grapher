// Hand-curated one-line descriptions for every authorable ArchieML
// component, seeded from the official OWID authoring documentation (gdoc
// 1OLoTWloy4VecOjKTjB1wLV6tEphHJIMXfexrf1ZYJzU; entries with source
// "inferred" had no doc section and were written from the component name and
// code). Data only — consumed by catalog.ts and (later) a component gallery.
// A test asserts every member of the enriched-block union has an entry.

import type { ComponentDescription } from "./componentCatalog.js";

export const componentDescriptions: Record<
  string,
  ComponentDescription & { source?: "docs" | "inferred" }
> = {
  "additional-charts": {
    description: "A subtle block listing links to multiple additional charts.",
    whenToUse: "Use to point readers at extra charts without full embeds.",
    notes: "Contains a [.list] of links.",
    source: "docs",
  },
  align: {
    description:
      "Aligns the text (including headings) inside the block — but not images, charts, or other media.",
    whenToUse: "Use to center or right-align a passage of text.",
    notes: "alignment: left|center|right; content in [.+content].",
    source: "docs",
  },
  "all-charts": {
    description:
      "Lists all Grapher charts that share a tag with the document, with key charts shown first.",
    whenToUse: "Use on topic pages to surface every interactive chart on the topic.",
    notes:
      "Requires the doc to be tagged; optional heading and [.top] list of grapher URLs to prioritize (must belong to the tag).",
    pageTypes: "topic pages",
    source: "docs",
  },
  aside: {
    description:
      "A short plaintext caption placed in the margin to the left or right of body text.",
    whenToUse: "Place before a paragraph for left, after it for right.",
    notes: "caption is plaintext only; position: left|right (default right).",
    source: "docs",
  },
  "bespoke-component": {
    description:
      "Embeds a custom one-off ('bespoke') interactive visualization built by developers for a specific page.",
    whenToUse: "Only with developer involvement; see the dedicated 'Bespoke viz' GDoc for details.",
    source: "inferred",
  },
  blockquote: {
    description: "A quoted excerpt from another source, with an optional citation.",
    whenToUse: "Use to cite an excerpt verbatim.",
    notes:
      "citation optional; if it's a URL it must start with http and becomes an HTML cite attribute, otherwise it's appended as a footer; text in [.+text].",
    source: "docs",
  },
  callout: {
    description:
      "A small gray-background block drawing attention to meta-textual information, such as a data-update notice.",
    whenToUse:
      "Use for notices like 'this data was last updated in...'; inside a key insight, start the text with an h5 'What you should know about this data'.",
    notes:
      "title and icon optional (only icon: info supported); [.+text] may contain only text, headings, and lists.",
    source: "docs",
  },
  chart: {
    description:
      "Embeds an interactive Grapher chart, explorer, or multidimensional chart (mdim) by URL.",
    whenToUse:
      "Use for standard chart embeds; prefer narrative-chart when you want a fixed narrative framing.",
    notes:
      "size: narrow|wide(default)|widest; visibility: mobile|desktop; peerCountries: parentRegions|gdpPerCapita|population|dataRange|defaultSelection|neighbors; ?hideControls=true hides explorer/mdim controls; query params select mdim views.",
    source: "docs",
  },
  "chart-story": {
    description:
      "A carousel (slides) of charts, each with a narrative line and technical bullet-point text below.",
    whenToUse: "Use to walk readers through several views of related charts.",
    notes: "Each slide: narrative, chart (URL), and a {.technical} block containing a list.",
    source: "docs",
  },
  code: {
    description: "Displays a block of code verbatim (e.g. an example of OWID embed HTML).",
    whenToUse: "Use for showing code snippets to readers.",
    notes: "Written as a freeform [.+code] block.",
    source: "docs",
  },
  "conditional-section": {
    description:
      "A section whose content only renders when a condition is met (e.g. data availability for the current entity).",
    whenToUse: "Use in templated pages like country profiles to hide sections that don't apply.",
    pageTypes: "country profiles (likely)",
    source: "inferred",
  },
  "cookie-notice": {
    description: "Renders the cookie notice / cookie-preferences management block.",
    whenToUse: "Only on the privacy/cookie policy page.",
    pageTypes: "cookie/privacy page only",
    source: "inferred",
  },
  "country-profile-selector": {
    description:
      "A selector (search/dropdown) letting readers pick a country and jump to its country profile.",
    whenToUse: "Use on pages that link into the country-profile system.",
    pageTypes: "country profiles (likely)",
    source: "inferred",
  },
  cta: {
    description: "A very simple call-to-action link with an arrow to its right.",
    whenToUse: "Use for a single prominent 'check this out' style link.",
    notes: "Fields: url, text; colored blue in data insights, red everywhere else.",
    source: "docs",
  },
  "data-callout": {
    description:
      "Writes automatically generated statements about chart data into text, e.g. 'In 2025, Canada's life expectancy was 85'.",
    whenToUse:
      "Usable in articles, (linear) topic pages, data insights, and country profiles; if the chart lacks data for the entity, the whole section won't render (useful in profiles).",
    notes:
      "url is a grapher URL (use ?time=... for a specific year, $entityCode in profiles); [.+content] may use $latestTime() and $latestValue(), optionally with an indicator slug argument for multi-indicator charts; any content including charts allowed; group multiple with data-callout-group.",
    source: "docs",
  },
  "data-callout-group": {
    description:
      "Groups several data-callout blocks so they render as one unit.",
    whenToUse:
      "Use when multiple data callouts belong together, e.g. several auto-generated statements about the same entity.",
    notes: "content is a list of data-callout blocks.",
    source: "inferred",
  },
  "chart-rows": {
    description:
      "A list of rows, each pairing a chart thumbnail image with a link and short accompanying text.",
    whenToUse:
      "Use to present several related charts compactly with a one-line takeaway each.",
    notes:
      "optional kicker/title/source; each row needs image (filename) and url, with text content alongside.",
    source: "inferred",
  },
  "pull-chart": {
    description:
      "A chart thumbnail pulled into the margin next to body text, linking to the full chart.",
    whenToUse:
      "Use to reference a chart without interrupting the text flow with a full embed.",
    notes:
      "image (filename) and url required; align: left-center|right-center; text content accompanies the thumbnail.",
    source: "inferred",
  },
  donors: {
    description:
      "Renders the list of OWID donors stored in the database; the block itself is empty and only marks placement.",
    whenToUse: "Use on the relevant about page.",
    pageTypes: "about pages",
    source: "docs",
  },
  "entry-summary": {
    description: "An in-page summary / table of contents listing the sections of a (legacy) entry.",
    whenToUse: "Legacy component for older entries; not part of current authoring docs.",
    source: "inferred",
  },
  "expandable-paragraph": {
    description:
      "Shows a short portion of content with a 'Show More' button that reveals the rest when clicked.",
    whenToUse:
      "Use for long technical explanations (e.g. below an explorer) — but only if you have a lot to say.",
    notes: "Freeform block; any Archie block is supported inside.",
    source: "docs",
  },
  expander: {
    description:
      "A rectangular box that conceals optional content and reveals it when clicked/toggled.",
    whenToUse: "Handy for large tables and other long technical text.",
    notes: "Fields: heading, title, subtitle, [.+content].",
    source: "docs",
  },
  "explore-data-section": {
    description:
      "A blue-background section with a chart icon and a title (default 'Explore the data') that can contain any other Gdoc blocks.",
    whenToUse: "Use on linear topic pages, similar in spirit to gray-section.",
    notes: "title optional (defaults to 'Explore the data'); content in [.+content].",
    pageTypes: "linear topic pages",
    source: "docs",
  },
  "explorer-tiles": {
    description: "A grid of 4 link tiles to data explorers, with title and subtitle.",
    whenToUse: "Use on the homepage to feature explorers.",
    notes:
      "Explorers must be tagged in the admin and the tag needs an icon in the tag-icons folder.",
    pageTypes: "homepage",
    source: "docs",
  },
  "featured-data-insights": {
    description:
      "Displays data insights related to the document's topic, equivalent to a filtered search.",
    whenToUse: "Use on linear topic pages.",
    notes: "No parameters; requires a topic tag on the document.",
    pageTypes: "linear topic pages",
    source: "docs",
  },
  "featured-metrics": {
    description:
      "Displays featured metrics related to the document's topic, equivalent to a filtered search.",
    whenToUse: "Use on linear topic pages.",
    notes: "No parameters; requires a topic tag on the document.",
    pageTypes: "linear topic pages",
    source: "docs",
  },
  "gray-section": {
    description:
      "A full-width gray-background section that can contain any other valid ArchieML content.",
    whenToUse: "Use to visually set off a section, e.g. an explorer with an explanation.",
    notes: "Freeform [.+gray-section] block.",
    source: "docs",
  },
  "guided-chart": {
    description:
      "A wrapper section containing exactly one grapher or mdim chart that can be 'remote controlled' by special #guide: links in the surrounding text.",
    whenToUse:
      "Best inside a two-column layout (sticky left/right); use when paragraph links should update the chart in place.",
    notes:
      "Links are #guide:<grapher URL>; all links must share the same slug (only query params vary); exactly one chart per section; explorers not supported; chart-rows inside become buttons.",
    source: "docs",
  },
  heading: {
    description:
      "A section heading at level 1-3, written via Google Docs heading styles or an explicit {.heading} block with text and level.",
    whenToUse: "Start primary sections with level 1, nest level 2 then 3; max 3 levels.",
    notes: "Horizontal rules may separate level-1 sections.",
    source: "docs",
  },
  "homepage-intro": {
    description:
      "A large block of links to featured OWID content plus hard-coded mission-statement text.",
    whenToUse: "Use on the homepage only.",
    notes:
      "[.featured-work] must contain exactly 4 articles; each has a free-text kicker; isNew: true shows a red 'NEW' pill.",
    pageTypes: "homepage only",
    source: "docs",
  },
  "homepage-search": {
    description: "A wide section containing a search bar.",
    whenToUse: "Must be added to the homepage, since the nav search bar disappears there.",
    notes: "Empty block, no parameters.",
    pageTypes: "homepage only",
    source: "docs",
  },
  "horizontal-rule": {
    description: "A thin, light gray line dividing two large sections.",
    whenToUse: "Generally place before any h1 that starts a new primary section.",
    notes: "Empty block; Google Docs' own 'Horizontal line' element also works.",
    source: "docs",
  },
  html: {
    description: "An escape hatch for raw inline HTML, e.g. styled spans or iframes.",
    whenToUse: "Only for special cases that no other component covers.",
    notes: "Inline HTML elsewhere is no longer allowed; iframes are supported here.",
    source: "docs",
  },
  image: {
    description:
      "Embeds an image uploaded via the admin, with optional caption and a separate mobile variant.",
    whenToUse:
      "Standard image embed; set hasOutline: true for images with white backgrounds (e.g. static grapher exports).",
    notes:
      "filename required; size: narrow|wide(default)|widest; visibility: mobile|desktop; smallFilename for mobile (still >=1600px wide); alt overrides admin alt text.",
    source: "docs",
  },
  "key-indicator": {
    description:
      "A single key-indicator entry pairing a datapage chart with a title, source, and explanatory text.",
    whenToUse: "Use only inside a key-indicator-collection.",
    notes:
      "datapageUrl must link to a grapher that is a datapage; fields: title, source (optional), [.+text].",
    pageTypes: "homepage",
    source: "docs",
  },
  "key-indicator-collection": {
    description: "An accordion displaying an array of key-indicator items.",
    whenToUse: "Use on the homepage to feature key indicators.",
    notes: "Contains [.+indicators] of {.key-indicator} blocks.",
    pageTypes: "homepage",
    source: "docs",
  },
  "key-insights": {
    description:
      "A slideshow of key insights, each with a title, a chart/image/narrative chart, and rich content.",
    whenToUse:
      "Use the 'Key Insights' section of topic pages; the sticky nav auto-detects this heading.",
    notes:
      "heading plus [.insights]; each insight has title and one of url (grapher), filename (image), or narrativeChartName, plus [.+content]; callouts inside should start with an h5 'What you should know about this data'.",
    pageTypes: "topic pages",
    source: "docs",
  },
  "latest-data-insights": {
    description: "A grey section displaying the latest 4 published data insights.",
    whenToUse: "Only add if there are at least 4 published data insights.",
    notes: "Empty block, no parameters.",
    pageTypes: "homepage",
    source: "docs",
  },
  list: {
    description: "An unordered (bulleted) list.",
    whenToUse: "Write with Google Docs bullet formatting inside [.list].",
    notes: "Nested lists are not supported.",
    source: "docs",
  },
  "ltp-toc": {
    description:
      "A specialized table of contents for linear topic pages, with page-content links plus cards linking to all data and writing on the topic.",
    whenToUse:
      "Use on linear topic pages; avoid combining with the sidebar ToC (repetitive, discouraged).",
    notes: "title defaults to 'Sections'.",
    pageTypes: "linear topic pages",
    source: "docs",
  },
  "missing-data": {
    description:
      "A block highlighting data that is missing or unavailable for the topic (companion to the all-charts block).",
    whenToUse: "Use on topic pages to acknowledge data gaps.",
    pageTypes: "topic pages (likely)",
    source: "inferred",
  },
  "narrative-chart": {
    description:
      "Embeds a narrative chart — a chart derivative with fixed title/selection that only exists inside articles, referenced by name.",
    whenToUse:
      "The preferred way to embed charts in articles, since data updates won't change the narrative framing.",
    notes:
      "Required field: name (the narrative chart's name); create via grapher's share menu ('Create narrative chart').",
    source: "docs",
  },
  "numbered-list": {
    description: "An ordered (numbered) list.",
    whenToUse:
      "Write items with literal asterisks inside [.numbered-list]; don't let Google Docs auto-convert them to bullets.",
    notes: "Nested lists are not supported.",
    source: "docs",
  },
  people: {
    description:
      "A list container holding one or more person blocks, used to present team members, former staff, or board members.",
    whenToUse:
      "Use on about pages to present groups of people; wrap in people-rows for multi-column layout.",
    notes: "[.+people] must contain only {.person} blocks.",
    pageTypes: "about pages",
    source: "docs",
  },
  "people-rows": {
    description:
      "An optional wrapper around a people list that lays the people out in multiple columns.",
    whenToUse: "Use when a people list should display in 2 or 4 columns on large screens.",
    notes: "Only property: columns (2 or 4); falls back to fewer columns on smaller screens.",
    pageTypes: "about pages",
    source: "docs",
  },
  person: {
    description:
      "Presents one person with name, optional photo, title, author-page link, bio text, and social links.",
    whenToUse: "Use inside a people list on about pages.",
    notes:
      "name required; optional: image (admin filename), title, url (author-page GDoc), [.+text] bio, [.socials].",
    pageTypes: "about pages",
    source: "docs",
  },
  "pill-row": {
    description: "A small grey bar of link pills with a title.",
    whenToUse:
      "Sits at the top of the homepage below the nav; also used for the topics section of author pages (keep to ~5-7 pills so they fit one line).",
    notes: "title plus [.pills] of text+url entries.",
    pageTypes: "homepage and author pages",
    source: "docs",
  },
  "prominent-link": {
    description:
      "A prominent link card with title, description, and thumbnail, auto-populated when pointing at a registered Google Doc.",
    whenToUse:
      "Use to feature a related article or external resource; fields can be overridden for non-GDoc URLs.",
    notes:
      "url required; title, description, thumbnail optional (required in practice for external URLs).",
    source: "docs",
  },
  "pull-quote": {
    description:
      "A centered, italicized h1-style quote used to re-emphasize a phrase from the article.",
    whenToUse: "Use to visually highlight a key phrase alongside the paragraph it belongs to.",
    notes:
      "align: left|left-center|right-center|right; [.+content] holds the paragraph the quote is inserted into (required due to CSS limitations).",
    source: "docs",
  },
  recirc: {
    description:
      "A small gray block of links (to graphers, explorers, mdims, articles, or external sources) placed beside or within the text.",
    whenToUse: "Use to recirculate readers to related content.",
    notes:
      "align: left|center|right; external links can't be mixed with internal ones (no thumbnails); title/subtitle per link optional.",
    source: "docs",
  },
  "research-and-writing": {
    description:
      "A mosaic of article tiles organized into primary, secondary, 'more', and row sections.",
    whenToUse:
      "Use for the Research & Writing section of topic pages and for featured/all-work sections on author pages.",
    notes:
      "Primary section mandatory; links can be gdoc or external (external need title/filename except in 'more'); hide-date: true, hide-authors: true; variant: featured for linear topic pages; {.latest} auto-pulls an author's latest articles.",
    source: "docs",
  },
  "resource-panel": {
    description:
      "A sidebar call-to-action panel linking to charts and (if the article is tagged) the data catalog pre-filtered to the tag.",
    whenToUse:
      "Intended for the introduction section of linear topic pages; place at least after the first paragraph.",
    notes:
      "Fields: kicker, icon, title, buttonText, [.links] with url+subtitle; on desktop it pins to the top-right of the section regardless of placement, on mobile it appears where placed.",
    pageTypes: "linear topic pages",
    source: "docs",
  },
  script: {
    description:
      "Embeds a raw script for custom one-off interactive behavior (developer escape hatch).",
    whenToUse: "Only with developer involvement; not part of normal authoring.",
    source: "inferred",
  },
  "sdg-grid": {
    description: "A grid of tiles linking to the 17 Sustainable Development Goal tracker pages.",
    whenToUse: "Use on the SDG Tracker overview page.",
    pageTypes: "SDG Tracker pages",
    source: "inferred",
  },
  "sdg-toc": {
    description: "A table of contents specific to the Sustainable Development Goal tracker pages.",
    whenToUse: "Use on SDG Tracker pages only.",
    pageTypes: "SDG Tracker pages",
    source: "inferred",
  },
  "side-by-side": {
    description: "Two equal-width columns of content displayed side by side.",
    whenToUse: "Use for parallel content of similar length.",
    notes: "[.+left] and [.+right]; collapses to single column at the smartphone breakpoint.",
    source: "docs",
  },
  socials: {
    description: "A list of links to social media profiles (and email/website).",
    whenToUse: "Use in author-page headers and inside person blocks.",
    notes:
      "Each entry: url, text, type; allowed types: link, email, x, facebook, instagram, youtube, linkedin, threads, mastodon, bluesky.",
    pageTypes: "author pages and about pages",
    source: "docs",
  },
  "static-viz": {
    description:
      "An 'enhanced image' for flagship static data visualizations that opens a download modal with description and source-data links.",
    whenToUse: "Use for flagship static graphics that deserve downloadable metadata.",
    notes: "Created in the admin at /admin/static-viz/; referenced by name.",
    source: "docs",
  },
  "sticky-left": {
    description:
      "A two-column layout where the left column (typically a chart) sticks in place as the user scrolls past the right column's text.",
    whenToUse: "Use to keep a chart visible alongside long explanatory text.",
    notes:
      "[.+left] and [.+right] freeform blocks; collapses to single column at the tablet breakpoint.",
    source: "docs",
  },
  "sticky-right": {
    description:
      "A two-column layout where the right column (typically a chart) sticks in place as the user scrolls past the left column's text.",
    whenToUse: "Use to keep a chart visible alongside long explanatory text.",
    notes:
      "[.+left] and [.+right] freeform blocks; collapses to single column at the tablet breakpoint.",
    source: "docs",
  },
  "subscribe-banner": {
    description: "A small gray newsletter-subscribe block placed inline, left, or right of text.",
    whenToUse:
      "One is auto-added before the last h1 of every article and linear topic page; add manually only for custom placement.",
    notes:
      "align: left|center|right; disable the automatic one with hide-subscribe-banner: true in front matter.",
    source: "docs",
  },
  table: {
    description:
      "A simple table built from a Google Docs table element wrapped in Archie, with header templates and optional caption.",
    whenToUse: "Use for small data tables; consider wrapping very large tables in an expander.",
    notes:
      "template: header-row|header-column|header-column-row; default 6-column span, size: wide for full width; caption supports links; rows as {.table-row} of [.+table-cell] blocks.",
    source: "docs",
  },
  text: {
    description:
      "A regular rich-text paragraph in the article body, supporting bold, italic, links, super/subscript, refs, and details-on-demand links.",
    whenToUse: "The default for all body prose; just write text inside [+body].",
    notes:
      "Escape a leading colon (Blah\\:); use #dod:id links for details on demand; refs via {ref}id{/ref} or inline {ref}text{/ref}.",
    source: "docs",
  },
  "topic-page-intro": {
    description:
      "The introduction block for topic pages, with intro content plus optional download button and related-topics links.",
    whenToUse: "Should be included in all topic pages.",
    notes:
      "Optional {.download-button} (text, url) and [.related-topics] (gdoc links, or external links with a text property); intro prose in [+.content].",
    pageTypes: "topic pages",
    source: "docs",
  },
  video: {
    description:
      "Embeds a short video hosted on Cloudflare (uploaded by a dev), with a poster image from the images admin.",
    whenToUse: "Use for short clips; compress with Handbrake first.",
    notes:
      "url (video) and filename (poster, first frame at same aspect ratio) required; shouldLoop, shouldAutoplay, visibility, caption (links allowed) optional.",
    source: "docs",
  },
};
