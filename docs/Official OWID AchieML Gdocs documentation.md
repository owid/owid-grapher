df: skip

You can add notes here (they don’t show up in the article).

The URL of the preview of a google doc is https://admin.owid.io/admin/gdocs/**\[GDOC\_ID\]**/preview  
Where **GDOC\_ID** is the long part of the URL of the GDoc you are working on, i.e. https://docs.google.com/document/d/**\[GDOC\_ID\]**

[See the admin preview for this article](https://admin.owid.io/admin/gdocs/1OLoTWloy4VecOjKTjB1wLV6tEphHJIMXfexrf1ZYJzU/preview)

Throughout this document, we’ve written example archie syntax with a monospace typeface. This isn’t actually necessary in your documents \- it’s just to help visually distinguish the sections that have specific syntactic requirements.

The article background is gray so that you don’t accidentally mistake this article for the one you’re meant to be editing.

:endskip

title: Writing OWID Articles With Google Docs  
subtitle: This article documents how to use and configure the various built in features of our template system  
authors: Matthew Conlen, Matthieu Bergel, Ike Saunders  
type: article  
excerpt: A demonstration of all our article components  
dateline: This article was first published in 2013, and last revised in January 2024\.  
hide-citation: true  
featured-image: default-featured-image.png

\[.refs\]

id: example\_id  
\[.+content\]  
I am the text content of the ref with the ID “example\_id”  
\[\]

\[\]

\[+body\]

# General information

## Linking to Documents

When linking to another document, we prefer that you link via the Google Docs link instead of the ourworldindata.org one. 

This won’t be possible when you need to link to an article that hasn’t yet been converted, but as we migrate more and more articles across this should become easier.

Here’s a link to our article on Optimism and Pessimism: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk

We could link to that document within this document with an [inline link](https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk) or simply by pasting the link as we did above.

If it’s via a component written in archie, it will almost always be done with a property named url

e.g.

url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk

As long as the document is registered with the admin server via the /admin/gdocs page, we’ll be able to resolve it and render links to it with the actual slug used by that document. You can copy these Google Doc links either from your browser’s URL bar, or by using Google Docs’ own “Insert Link” dialogue box, which has a glitchy search which may or may not find your documents at any given time. 🙃

# Part One: Basics

## Text

Write it inside of the “\[+body\]” tag. Any text that you put in there will show up in the body of the article.

If you want to add a comment to a section, we recommend using Google Docs’ built-in commenting feature.

But if you’re writing inside the “\[+body\]” block, you can also write Archie comments as follows:

:skip this line will be ignored  
:skip and this line  
:endskip

If you want to begin a paragraph with a word followed by a colon, the colon must be escaped:

Blah\\: an explanation of blah

## Styling text {#styling-text}

Use the Google Docs editor to make text **bold**, *italic,* or a [link](https://ourworldindata.org/).

There is also superscript like m2 and subscript like CO2

Inline HTML is no longer allowed unless for very special cases \- if you need the escape hatch, then you have to create an html block, as shown below. Inside of it you can use inline html for advanced styling in case you need unusual features, like so:

html: This is text that can use features like \<span style="color:red"\>this will be red\</span\>.

## Code

Use this component to include a block of code to be displayed verbatim, e.g. an example of our embed HTML:

\[.+code\]  
\<iframe src="https://ourworldindata.org/grapher/children-per-woman-un?tab=map" loading="lazy" style="width: 100%; height: 600px; border: 0px none;" allow="web-share; clipboard-write"\>\</iframe\>  
\[\]

## HTML embeds

Iframes are supported:

:skip  
html: \<iframe src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" /\>   
:endskip

## Refs

There are two ways to write refs: with an ID, and inline.

### ID-based

I am some claim with an ID ref{ref}example\_id{/ref}

If the text inside the ref  tag has no whitespace, we assume it’s an ID and will find its content from the corresponding entry in the \[.refs\] block defined in the front-matter of the article. This allows you to easily reference the same ref multiple times.

### Inline

I am some claim that needs to be cited {ref}This text will feature in the endnotes section and will automatically generate a superscript reference number{/ref}

You can still write inline refs if you’d prefer to keep them close to their context.

If you write the same inline ref multiple times (with the *exact* same content) then it will use the same footnote number for each instance in the article, but in general, it’s probably best to use an ID for these cases.

## Details on demand

To include a detail on demand, use a normal link, but set the target to *\#dod:your\_dod\_id*

e.g. [Primary energy](#dod:primaryenergy)[\#dod:primaryenergy](https://docs.google.com/document/d/1OLoTWloy4VecOjKTjB1wLV6tEphHJIMXfexrf1ZYJzU/edit#dod:primaryenergy)

The subtitles and footers of graphers and explorers can now also use these dods. They use markdown syntax instead

e.g. 

\[Primary energy\](\#dod:primaryenergy)

## Lists

Unordered lists can be written using Google Docs formatting.

- Apples  
- Pears  
- Oranges

Ordered lists can be written like so, just be careful to keep the asterisk and not have Google Docs automatically convert it into a bulleted list.

\[.numbered-list\]  
\* Numbered  
\* List  
\[\]

**Note.** Nested lists are currently [not supported](https://github.com/owid/owid-grapher/issues/2468).

## Headers

Use the Google Docs text options to select the various header levels. 

A general rule of thumb is to start a section with Heading 1, and then for nested sections go down to Heading 2 and then finally to Heading 3 if necessary.

# Heading One

Used for the title of main sections in an article (primary sections). This is the largest text heading that can be used within body text so it is best to use it for the title of the first section of an article, that way nested headings will be Heading 2 \> Heading 3 (for a maximum of 3 levels of importance)

Note that horizontal rules (see Part Two: Components) can be used between 2 primary sections — a  primary section being a section that starts with Heading 1\.

## Heading Two

Used for subtitles within the main section of an article (secondary sections). This means that Heading 2 should only be used if it is contained in a section that already has Heading 1 as a title.

### Heading Three

Used for subtitles within sub-sections in an article. This means that Heading 3 should only be used if it is contained in a section that already has Heading 2 as a title.

# Part Two: Components

## Grapher Chart

All charts can have a size attribute specified. Its possible values are: narrow, wide (default), and widest.

visibility is optional. It has two options, mobile, and desktop. Its intended use is to insert an image into an article in 2 different positions: once for the mobile layout, and once for the desktop layout.

{.chart}  
url: [https://ourworldindata.org/grapher/military-expenditure-share-gdp](https://ourworldindata.org/grapher/military-expenditure-share-gdp)  
visibility: desktop  
{}

The chart component can also display MDims, both with controls and without. See [Multidimensional Chart](#multidimensional-chart) below for details.

## Narrative Chart

A narrative chart is a chart derivative that can only ever be viewed inside an article – it does not have a standalone page. Narrative charts are the preferred way of embedding charts inside articles as they let you use a narrative title, fix the country selection etc and these will not be changed automatically by future data updates.

{.narrative-chart}  
name: global-life-expectancy-has-doubled  
{}

## Explorer

{.chart}  
url: https://ourworldindata.org/explorers/food-footprints  
{}

If you’d like to hide the controls for an explorer, include the ?hideControls=true query string at the end of the URL.

If it’s the only query string parameter, it’s written with a question mark preceding it.   
{.chart}  
url: https://ourworldindata.org/explorers/food-footprints?hideControls=true  
{}

If there are multiple query strings, they’re separated by ampersands

{.chart}  
url: https://ourworldindata.org/explorers/food-footprints?country=Broccoli\~Tofu\&hideControls=true  
{}

## Multidimensional Chart {#multidimensional-chart}

You can include multidimensional charts, also known as mdims, in a similar way as grapher charts.

If you don’t specify any query parameters in the URL, the default mdim view will be shown, with the default grapher settings and with control drop-downs to switch to different views

{.chart}  
url: https://ourworldindata.org/grapher/vaccination-coverage-who-unicef  
{}

To select a specific view, include the dimension query params, optionally also with any other changes to the default selection/settings:

{.chart}  
url: https://ourworldindata.org/grapher/vaccination-coverage-who-unicef?metric=unvaccinated\&antigen=comparison  
{}

And to hide the mdim controls (dropdowns), include the hideControls=true query parameter:

{.chart}  
url: https://ourworldindata.org/grapher/vaccination-coverage-who-unicef?metric=unvaccinated\&antigen=comparison\&hideControls=true  
{}

You can also use the other capabilities of the chart component, e.g. override the title that is shown \- although usually it is preferred to create a narrative view for such cases. 

To create a narrative view for a Mutli-dim, click the share menu of grapher on the datapage with the right view selected and choose "​​Create narrative chart".

## Guided Chart

A guided chart is a grapher or MDIM (explorers are not currently supported) that can be controlled with links in paragraph text.

Any valid ArchieML content can go between the \[.+guided-chart\] tags (e.g. sticky-left columns, gray-sections, etc)

The syntax for the link is \#guide:[https://ourworldindata.org/grapher/life-expectancy?country=\~NZL](https://ourworldindata.org/grapher/life-expectancy?country=~NZL)

i.e. a grapher link prefixed by \#guide:

The links must all go to the same slug, only the query params can change

There can only be one chart within a guided-chart section, but you can have multiple guided-chart sections in one page. You can think of it like this: The guided-chart component creates an invisible area in the Gdoc, within which exactly one chart is expected that can then be "remote controlled" by the special \#guide links.

It’s expected that the component will be used within a two-column layout (e.g. sticky right/left), but it also works in standard single-column layout.

\[.+guided-chart\]  
{.sticky-left}  
\[.+left\]  
{.chart}  
url: https://ourworldindata.org/grapher/life-expectancy  
{}  
\[\]  
\[+.right\]  
[I am a link that will update the chart to show New Zealand when clicked](#guide:https://ourworldindata.org/grapher/life-expectancy?country=~NZL)  
\[\]  
{}  
\[\]

## Aside

Asides can be placed to the right or the left of the body text. The default is right.

The caption can only contain plaintext.

If you want to have an aside be to the left of a paragraph, place it before the paragraph text, after for right.

{.aside}  
caption: I will be to the left of the following paragraph. 🤡  
position: left  
{}

I am a paragraph that has asides left and right of me.

{.aside}  
caption: I will be to the right of the preceding paragraph. 🃏  
{}

## Pull Quote

A pull quote is a centered, italicized h1 used to re-emphasize a phrase in the article.

Values for align are: left, left-center, right-center, right

Content is for the paragraph you want the pull quote to be inserted into. It has to be done this way (unlike asides) because of limitations with CSS.

{.pull-quote}  
quote: I am a left-center aligned quote that should span multiple lines.  
align: left-center  
\[.+content\]  
Suspendisse commodo turpis nunc, sit amet cursus odio porttitor scelerisque. Ut vel vehicula mauris. Suspendisse maximus ut enim gravida luctus. Nunc aliquam mi et viverra gravida. Etiam ac volutpat urna. Nam nisl nisi, malesuada eget lorem non, posuere mollis mauris. Pellentesque tristique erat ut turpis tristique, condimentum faucibus metus mattis. Donec non erat justo. Vivamus velit nulla, iaculis vel metus et, tincidunt pharetra justo. Quisque lacinia fringilla odio, vitae semper urna semper quis. Sed aliquam ipsum quam, in suscipit purus fringilla et. In congue commodo cursus.   
\[\]  
{}

## Blockquote

A way to cite an excerpt from another source. The source can optionally be cited with the citation property. 

If the citation is a URL, it must begin with http (https:// is therefore also valid). URL citations will be referenced as an attribute of the HTML that gets generated.

Non-URL citations will be appended to the block quote as a footer.

{.blockquote}  
citation: Bastian Herre  
\[.+text\]  
Measuring the state of democracy across the world helps us understand the extent to which people have political rights and freedoms.  
\[\]  
{}

## Recirc

The recirc block is a small gray block that is placed to the right of the text. align can be one of: left, center, right.

Links to graphers, explorers, mdims, articles, and external sources are supported.

If you use an external source, it can’t be intermingled with internal sources (because we don’t have thumbnails for external sources and it would look bad to have a mix of thumbnails/no thumbnails)

{.recirc}  
title: More Articles on Mammals  
align: center

\[.links\]  
url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk

url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk  
\[\]  
{}

## Subscribe Banner

The subscribe banner is a small gray block that is placed inline, to the right of, or to the left of text. 

align can be one of: left, center, right.

A subscribe banner will be added by default to every article and linear topic page. It will appear immediately before the last h1 of the page. To disable it, set hide-subscribe-banner: true in the post’s front-matter.

{.subscribe-banner}  
align: center  
{}

## Chart Story

A chart story shows a carousel of charts with technical text below it.

\[.chart-story\]  
narrative: Text for slide 1, an overview of the world  
chart: https://ourworldindata.org/grapher/military-expenditure-share-gdp  
{.technical}

- The poverty gap index is a measure that reflects both the depth and prevalence of poverty. It is defined as the mean shortfall of the total population from the poverty line, counting the non-poor as having zero shortfall and expressed as a percentage of the poverty line  
- Extreme poverty is defined as living below the international poverty line of $1.90 per day  
- Data is measured in international-$, which means that differences in purchasing power and inflation are taken into account  
- Global data relies on a mix of income and expenditure household surveys  
- Non-monetary sources of income, like food grown by subsistence farmers for their own consumption, are taken into account

{}

narrative: Slide two looks at Africa  
chart: https://ourworldindata.org/grapher/military-expenditure-share-gdp?region=Africa  
{.technical}

- The poverty gap index is a measure that reflects both the depth and prevalence of poverty. It is defined as the mean shortfall of the total population from the poverty line, counting the non-poor as having zero shortfall and expressed as a percentage of the poverty line  
- Extreme poverty is defined as living below the international poverty line of $1.90 per day  
- Data is measured in international-$, which means that differences in purchasing power and inflation are taken into account  
- Global data relies on a mix of income and expenditure household surveys  
- Non-monetary sources of income, like food grown by subsistence farmers for their own consumption, are taken into account

{}  
\[\]

## Horizontal Rule

A horizontal rule is a thin, light gray line that can divide two large sections and should generally precede any h1.

{.horizontal-rule}  
{}

You can also use Google’s own “Horizontal line” element from the Insert menu:

---

## Additional Charts

The additional charts block is a more subtle way of linking to multiple charts.

{.additional-charts}

- [Here’s a link](https://ourworldindata.org)  
- [Here’s another on](https://ourworldindata.org)e

{}

## Image

See the [How to use Images in Archie](https://www.notion.so/owid/How-to-use-images-in-Archie-a9edaa25952c4b808b0d0837b1e678f9) guide in Notion for more information on how images work.

size has three options, narrow, wide (default), and widest. 

If unset, it defaults to wide, so you only need to specify size: narrow if the image’s aspect ratio is especially tall.

visibility  is optional. It has two options, mobile, and desktop. Its intended use is to insert an image into an article in 2 different positions: once for the mobile layout, and once for the desktop layout.

We strongly suggest that you add alt text on the actual file uploaded in the admin, but you can also override it if you want to mention a specific point in the particular context of an article.

smallFilename is an optional property that you can use to specify a different image to show on mobile. Even though it has “small” in the name, ensure that the image is at least 1600px wide so that it will render smoothly on iPhones and other high pixel density displays. 

hasOutline is an optional property that adds a light gray 1px outline to the image. It should be set to true when embedding an image that has a white background (e.g. a static grapher export)

{.image}  
filename: default-featured-image.png  
smallFilename: default-featured-image.png  
alt: my alt text that is optional and will override the default alt text set on the image in Drive  
size: narrow  
caption: I am a caption that would appear below the image  
hasOutline: true  
visibility: desktop  
{}

## Video

A way to share short videos. The video itself *isn’t* hosted in Google Drive, and for now, must be uploaded by a dev to CloudFlare. If we start wanting to use videos more in the future, we can make this more convenient. **Make sure you compress the video with Handbrake first.**

The url is for the video itself. The filename is for the preview image, which is managed through the images admin, and should be the first frame of the video at the same aspect ratio as the video. 

{.video}  
url: https://assets.ourworldindata.org/videos/bunny.mp4  
filename: bunny-poster.jpg  
shouldLoop: true  
shouldAutoplay: true  
visibility: desktop  
caption: I am a caption for this video. I can have [links](http://ourworldindata.org).  
{}

## 

## Static Viz

An “enhanced image” for our flagship data visualizations.

You can create them in [the admin](https://admin.owid.io/admin/static-viz/), allowing you to add a description and link to the source data for the image. 

They appear as regular images in our documents, except that when the “Download” button is clicked, a download modal appears above the image with all the additional metadata you’ve added.

{.static-viz}  
name: grapher-static-viz-demo  
{}

## Prominent Link

The most basic version of a Prominent Link can just use a link to another google doc that is registered in the grapher admin. All the other fields will be fetched automatically (though they can be overridden if desired)

{.prominent-link}  
url: [The value of this text is ignored](https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk)  
{}

Using the hyperlink as above is functionally identical to the follow snippet:

{.prominent-link}  
url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk  
{}

Below is an example of a prominent link pointing to a non-Google Docs URL. This could be for external resources or OWID articles that haven’t yet been converted to Google Docs.

{.prominent-link}  
url: https://ourworldindata.org  
title: About Our World In Data  
description: A simple description  
thumbnail: default-featured-image.png  
{}

## Cta

A very simple link with an arrow to the right of it. Coloured blue in data insights and red everywhere else.

{.cta}  
url: [https://ourworldindata.org/grapher/life-expectancy](https://ourworldindata.org/grapher/life-expectancy)  
text: Check this out\!  
{}

## Callout

A callout block is a small block with a gray background used to draw attention to some meta-textual information, such as a notice about when the data was last updated. 

The title and icon is optional. Only the info icon is currently supported.

The text block (which uses Archie’s freeform array syntax) can only contain text, headings, and lists.

If the callout is inside a key-insight, make the first line that says “What you should know about this data” an h5 in order for it to apply the correct CSS that will give it larger margins and underline it.

{.callout}  
title: Update  
icon: info  
\[.+text\]  
This article uses data from 2020

But the conclusions are solid.

\[\]  
{}

## 

## Resource Panel

A sidebar CTA that can link out to charts and, if the article is tagged, will include a link to the data catalog pre-filtered to the tag.

This component is intended to be used in the introduction section of linear topic pages. 

In the GDoc, the component should be placed at least after the first paragraph. 

On *desktop*, it will always appear at the top of the section (on the right), irrespective of how it is ordered in the GDoc. On *mobile*, it will appear within the text according to where you place it in the GDoc. For example, if you place it between the 3rd and 4th paragraphs, this is where it will show on mobile — but on desktop, it will still show aligned with the top of the 1st paragraph.

{.resource-panel}  
kicker: Resources  
icon: chart  
title: Data on this topic  
buttonText: See all data on this topic  
\[.links\]  
url: [https://ourworldindata.org/grapher/access-to-clean-fuels-and-technologies-for-cooking](https://ourworldindata.org/grapher/access-to-clean-fuels-and-technologies-for-cooking)  
subtitle: World Health Organization \- Global Health Observatory (2025)

url: [https://ourworldindata.org/grapher/annual-co2-emissions-per-country](https://ourworldindata.org/grapher/annual-co2-emissions-per-country)  
subtitle: Global Carbon Budget (2024)  
\[\]

{}

## Expandable Paragraph

The expandable paragraph block allows you to display a short portion of content on page load, with a "Show More" button. When the reader clicks on the button, the remaining content is revealed, expanding the paragraph to its full length. 

This functionality helps in providing a concise and organized presentation of information while allowing readers to access additional details or hidden content if they choose to do so.

:skip \[.+expandable-paragraph\]  
:skip Any Archie block is supported here  
:endskip \[\]

## Tables

Simple tables can be written using the Google Docs table element (wrapped with a little bit of archie)

There are 3 templates: header-column, header-row, and header-column-row  
By default, tables will span 6 columns, but you can also specify size: wide to make them full-width

You can also set a caption with the caption property

{.table}  
template: header-row  
caption: I am a caption with [a link](https://en.wikipedia.org/wiki/Main_Page)

| Name | Mass | Distance from the Sun (10⁶ km) |
| :---- | :---- | :---- |
| Mercury | 0.055 Earths | 57.9 |
| Venus | 0.815 Earths | 108.2 |

{}

{.table}  
template: header-column-row

|  | Mercury | Venus |
| :---- | :---- | :---- |
| Mass | 0.055 Earths | 0.815 Earths |
| Distance from the Sun (10⁶ km) | 57.9 | 108.2 |

{}

{.table}  
template: header-column

| Mercury | 0.055 Earths 57.9e6 km from Sun |
| :---- | :---- |
| Venus | 0.815 Earths 108.2e6 km from Sun |

{}

## Deprecation Notice

Only supported in **articles**. To mark an article as deprecated, add a deprecation notice above the \[+body\] tag, for example

:skip  
\[+deprecation-notice\]  
  This article was originally **published on May 4, 2016**. It is now archived and not being updated. For our other work on marriage, explore our topic page on [Marriages and Divorces](https://docs.google.com/document/d/1tqoeu-Qe0qvQi2FwhI5xWhxQbR1hzgxJ-ZjzetJFj_s/edit).  
\[\]  
:endskip

Only text formatting is supported inside the block. The notice will be shown prominently at the top of the article to make sure the readers are aware of the fact.

Deprecated articles get a special archived thumbnail used in search, prominent links, social media previews, etc, to clarify their status in the preview already. In search, they rank lower than other kinds of pages. They also have parts of the content (e.g., citation block) altered or removed (e.g., link to the citation block below the title) to discourage some uses.

As a part of the editorial process, we should also:

* Replace interactive charts in the article with their static versions; set up a redirect from the interactive chart URL to the article URL  
* Link to a related topic page or some other place where more up-to-date information can be found in the deprecation notice, e.g., as in the example above

	

## Expander

An expander is a rectangular box that conceals option content, which it will reveal if clicked / toggled. Handy for large tables, and other long technical text.

{.expander}  
heading: Additional information  
title: Which data sources and definitions do we rely on?  
subtitle: Nunc tincidunt pharetra diam ut accumsan. Quisque mattis erat quis velit placerat, vel venenatis ipsum elementum?  
\[.+content\]  
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam id maximus mauris, eleifend dignissim tortor. Sed rhoncus dui euismod risus maximus feugiat. Nullam auctor purus et interdum vulputate. Nam aliquet urna eros, a gravida tortor pharetra sit amet. Integer mollis neque rutrum est lobortis, eget vestibulum nisl pulvinar.  
\[\]  
{}

## Script

A block for writing javascript into. Should only be used by developers.

\[.+script\]  
console.log(123)  
\[\]

# Part Three: Layouts

Our articles place content in a single centered column by default. You can use ArchieML to create sections with different layouts.

## Sticky Right

This layout collapses to single-column when the screen width is at a tablet breakpoint.

{.sticky-right}  
\[.+left\]  
I am content on the left. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque eget leo odio. Suspendisse pretium a dolor non finibus. Integer tortor lacus, sagittis id vestibulum eget, ultrices a purus. Sed at urna euismod, bibendum tellus ut, fringilla orci. Cras turpis lacus, fermentum at mattis ac, eleifend sed turpis. Vestibulum non efficitur lorem. Praesent libero velit, hendrerit a nibh nec, sodales scelerisque ligula. Vestibulum tincidunt quis tellus ut bibendum. Etiam interdum porta elit, a porttitor metus feugiat eget. Curabitur in posuere augue, a dignissim felis. Cras luctus posuere eleifend. Curabitur augue purus, fermentum ac dapibus eu, tempor nec lacus. Praesent dolor erat, auctor ut accumsan et, commodo sed eros. Praesent in eros nisi. Praesent varius dolor auctor sem faucibus egestas. Sed vehicula rutrum mi, ac bibendum libero rhoncus non.

Integer cursus orci eget feugiat elementum. Donec dictum tortor ac mauris rutrum consequat. Proin ac ultricies metus. Vivamus hendrerit blandit leo et lacinia. Quisque arcu purus, cursus vitae sapien ac, tincidunt bibendum tortor. Integer tempus sodales libero, id molestie nibh pellentesque vel. Cras vel ante erat. Proin sem tellus, tempor at rhoncus ac, congue id felis. Vivamus commodo nisi ut urna rhoncus varius. Nulla nisi quam, luctus at aliquam sed, faucibus eget nulla. Nam convallis lorem sem, eget tristique urna dignissim in. Aliquam consequat pellentesque est sed tristique. Mauris ac mattis enim. Ut ultrices nibh eu sapien pretium imperdiet. Aenean vulputate tortor ac aliquet commodo. Sed a mi justo.

Aenean vitae ligula sit amet massa tincidunt lobortis. Vestibulum aliquet maximus tellus, sit amet elementum nisl posuere quis. In et neque et mi tristique mattis. Sed vel turpis nec augue dignissim tincidunt vitae ac est. Etiam posuere ut sapien et accumsan. Integer vehicula leo sed est vulputate, sed scelerisque justo imperdiet. Aenean auctor nulla felis, id ultricies lorem dignissim eget. Curabitur tristique vehicula ipsum, eu pharetra lacus sodales quis. In aliquam dignissim elementum. Ut a tortor a ipsum dictum placerat. Cras iaculis tincidunt felis nec molestie.

Proin finibus eu ex maximus vulputate. Curabitur iaculis gravida facilisis. Sed rutrum sapien nec mollis congue. Ut felis mi, aliquet ut ullamcorper vel, laoreet sit amet urna. In feugiat mollis vehicula. Aenean et nisi rutrum, accumsan mi quis, egestas ligula. Aliquam erat volutpat.

\[\]  
\[.+right\]  
{.chart}  
url: https://ourworldindata.org/grapher/military-expenditure-share-gdp  
{}  
I am content on the right that will stick as the user scrolls  
\[\]  
{}

## Sticky Left

This layout collapses to single-column when the screen width is at a tablet breakpoint.

{.sticky-left}  
\[.+left\]  
{.chart}  
url: https://ourworldindata.org/grapher/military-expenditure-share-gdp  
{}  
I am content on the left that will stick as the user scrolls  
\[\]  
\[.+right\]  
I am content on the right. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque eget leo odio. Suspendisse pretium a dolor non finibus. Integer tortor lacus, sagittis id vestibulum eget, ultrices a purus. Sed at urna euismod, bibendum tellus ut, fringilla orci. Cras turpis lacus, fermentum at mattis ac, eleifend sed turpis. Vestibulum non efficitur lorem. Praesent libero velit, hendrerit a nibh nec, sodales scelerisque ligula. Vestibulum tincidunt quis tellus ut bibendum. Etiam interdum porta elit, a porttitor metus feugiat eget. Curabitur in posuere augue, a dignissim felis. Cras luctus posuere eleifend. Curabitur augue purus, fermentum ac dapibus eu, tempor nec lacus. Praesent dolor erat, auctor ut accumsan et, commodo sed eros. Praesent in eros nisi. Praesent varius dolor auctor sem faucibus egestas. Sed vehicula rutrum mi, ac bibendum libero rhoncus non.

Integer cursus orci eget feugiat elementum. Donec dictum tortor ac mauris rutrum consequat. Proin ac ultricies metus. Vivamus hendrerit blandit leo et lacinia. Quisque arcu purus, cursus vitae sapien ac, tincidunt bibendum tortor. Integer tempus sodales libero, id molestie nibh pellentesque vel. Cras vel ante erat. Proin sem tellus, tempor at rhoncus ac, congue id felis. Vivamus commodo nisi ut urna rhoncus varius. Nulla nisi quam, luctus at aliquam sed, faucibus eget nulla. Nam convallis lorem sem, eget tristique urna dignissim in. Aliquam consequat pellentesque est sed tristique. Mauris ac mattis enim. Ut ultrices nibh eu sapien pretium imperdiet. Aenean vulputate tortor ac aliquet commodo. Sed a mi justo.

Aenean vitae ligula sit amet massa tincidunt lobortis. Vestibulum aliquet maximus tellus, sit amet elementum nisl posuere quis. In et neque et mi tristique mattis. Sed vel turpis nec augue dignissim tincidunt vitae ac est. Etiam posuere ut sapien et accumsan. Integer vehicula leo sed est vulputate, sed scelerisque justo imperdiet. Aenean auctor nulla felis, id ultricies lorem dignissim eget. Curabitur tristique vehicula ipsum, eu pharetra lacus sodales quis. In aliquam dignissim elementum. Ut a tortor a ipsum dictum placerat. Cras iaculis tincidunt felis nec molestie.

Proin finibus eu ex maximus vulputate. Curabitur iaculis gravida facilisis. Sed rutrum sapien nec mollis congue. Ut felis mi, aliquet ut ullamcorper vel, laoreet sit amet urna. In feugiat mollis vehicula. Aenean et nisi rutrum, accumsan mi quis, egestas ligula. Aliquam erat volutpat.

\[\]

{}

## Side-by-side

This layout collapses to a single-column layout when the screen width is at a smartphone breakpoint.

{.side-by-side}  
\[.+left\]

### I am content on the left

Cras sit amet tempor massa. Mauris auctor neque a ipsum rhoncus, sed hendrerit augue fringilla. Etiam nec tellus id lorem consectetur dictum efficitur at enim. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nulla sit amet venenatis diam, vel consequat turpis. Nullam efficitur eros massa, eu fringilla neque aliquam non. Nullam gravida diam in mattis rutrum. Sed consectetur diam risus, at varius neque congue id. In sit amet sapien eu felis ornare tempor eu eget est. Mauris iaculis, tellus at laoreet placerat, purus mauris eleifend nisl, id auctor risus ligula at erat.   
\[\]  
\[.+right\]

### I am content on the right

Aenean vitae ligula sit amet massa tincidunt lobortis. Vestibulum aliquet maximus tellus, sit amet elementum nisl posuere quis. In et neque et mi tristique mattis. Sed vel turpis nec augue dignissim tincidunt vitae ac est. Etiam posuere ut sapien et accumsan. Integer vehicula leo sed est vulputate, sed scelerisque justo imperdiet. Aenean auctor nulla felis, id ultricies lorem dignissim eget. Curabitur tristique vehicula ipsum, eu pharetra lacus sodales quis. In aliquam dignissim elementum. Ut a tortor a ipsum dictum placerat. Cras iaculis tincidunt felis nec molestie  
\[\]  
{}

## Align

Align blocks align the text inside the block, but crucially only text (including headings) and not images, charts, and the like.  
Valid keywords for the “alignment” property are left, center, right.

{.align}  
alignment: center  
\[.+content\]  
Centered text

### A centered heading

\[\]  
{}

## Gray section

Gray sections create a full-width section that can contain any other valid ArchieML content.

\[.+gray-section\]

### A heading within a gray section

{.side-by-side}  
\[.+left\]  
Cras sit amet tempor massa. Mauris auctor neque a ipsum rhoncus, sed hendrerit augue fringilla. Etiam nec tellus id lorem consectetur dictum efficitur at enim. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nulla sit amet venenatis diam, vel consequat turpis. Nullam efficitur eros massa, eu fringilla neque aliquam non. Nullam gravida diam in mattis rutrum. Sed consectetur diam risus, at varius neque congue id. In sit amet sapien eu felis ornare tempor eu eget est. Mauris iaculis, tellus at laoreet placerat, purus mauris eleifend nisl, id auctor risus ligula at erat.   
\[\]  
\[.+right\]  
Aenean vitae ligula sit amet massa tincidunt lobortis. Vestibulum aliquet maximus tellus, sit amet elementum nisl posuere quis. In et neque et mi tristique mattis. Sed vel turpis nec augue dignissim tincidunt vitae ac est. Etiam posuere ut sapien et accumsan. Integer vehicula leo sed est vulputate, sed scelerisque justo imperdiet. Aenean auctor nulla felis, id ultricies lorem dignissim eget. Curabitur tristique vehicula ipsum, eu pharetra lacus sodales quis. In aliquam dignissim elementum. Ut a tortor a ipsum dictum placerat. Cras iaculis tincidunt felis nec molestie  
\[\]  
{}

\[\]

## Scroller

A scroller can be used to display shorter snippets of text next to a chart. You can define multiple charts and have the chart change as the text scrolls by. 

\[.+scroller\]  
url: https://ourworldindata.org/grapher/military-expenditure-share-gdp

Fusce egestas dapibus viverra. Nunc sed iaculis sem, in faucibus sapien. Pellentesque viverra venenatis dui vitae vehicula. Nunc leo turpis, gravida commodo auctor quis, tempus faucibus tortor. Aenean lacinia sem sed sem consequat vestibulum. Ut varius pharetra risus.

url: https://ourworldindata.org/grapher/military-expenditure-share-gdp?region=Africa

Ut hendrerit id tortor sed scelerisque. Donec maximus massa ac lectus consectetur, sit amet gravida ante eleifend. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Sed bibendum sodales lectus, eu consectetur nisi fringilla ut. Duis sollicitudin sapien non tempus suscipit. Mauris posuere massa quis purus hendrerit, eget pharetra dui interdum.

url: https://ourworldindata.org/grapher/military-expenditure-share-gdp?region=NorthAmerica

Nunc laoreet nibh arcu, in hendrerit tellus placerat vel. Nullam tristique venenatis nulla, non facilisis turpis rutrum vel. Mauris eget justo lacus. Etiam in pretium nisl. Donec vitae velit odio. Maecenas eleifend, elit sed egestas lobortis, odio arcu faucibus magna, sit amet laoreet nisi purus sit amet est. Vivamus faucibus a leo vel aliquam.

url: https://ourworldindata.org/grapher/military-expenditure-share-gdp?region=Europe

Proin auctor luctus enim nec fermentum. Cras lobortis libero eget magna elementum faucibus. Curabitur accumsan odio eu nibh aliquam, vitae ultrices neque efficitur. Morbi accumsan ante at condimentum convallis. Donec venenatis tellus a velit venenatis convallis. 

url: https://ourworldindata.org/grapher/military-expenditure-share-gdp?region=SouthAmerica

Curabitur mattis ante erat. Phasellus a magna egestas, varius sem sit amet, volutpat leo. Proin a viverra tortor, nec eleifend lorem. Nam et aliquet tortor. Sed et diam quis mauris elementum sodales. Fusce felis lacus, iaculis eu tempor sit amet, facilisis egestas lectus.

url: https://ourworldindata.org/grapher/military-expenditure-share-gdp?region=Asia

Quisque tristique finibus neque at fringilla. Maecenas mattis vel dolor vel tempor. Fusce eleifend consectetur nisi vitae sodales. Nunc porta at quam sit amet cursus. Etiam est ante, sollicitudin ac leo eu, vulputate maximus nulla. Integer volutpat et lectus non ultricies. Proin libero enim, interdum id feugiat ut, finibus auctor ipsum. Donec laoreet sem odio, ut luctus nisl finibus eget. Ut quam velit, eleifend convallis risus eget, semper placerat ipsum. Nunc condimentum augue sit amet purus pretium, non condimentum justo fringilla.

\[\]

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris viverra nulla dolor, sit amet dignissim odio finibus at. Phasellus sapien lacus, venenatis a aliquam non, ornare sed justo. Mauris diam est, malesuada id dolor eget, eleifend feugiat massa. Quisque ut lacus malesuada, egestas eros eu, gravida orci. Donec eleifend ligula quis nibh semper pharetra a ac tortor. Nam faucibus ullamcorper gravida. Ut at interdum turpis. Pellentesque a nibh molestie, laoreet ex pulvinar, accumsan odio. Aliquam non porttitor felis.

In eget mi iaculis, porttitor magna ut, tempor dolor. Mauris malesuada, urna ut mollis vestibulum, leo orci tempor nulla, vitae tristique odio dolor sed nunc. Suspendisse mattis libero nec nunc dignissim, tincidunt semper velit ultricies. Donec porttitor interdum felis, sed pellentesque nibh porttitor sed. Ut fringilla commodo est id varius. Integer sapien orci, viverra a tempor id, ullamcorper quis erat. Suspendisse venenatis blandit mi, vitae eleifend lacus finibus eu. Suspendisse facilisis mauris id dolor pulvinar, vel sodales mauris iaculis. Duis venenatis convallis lacus vel pharetra. Nunc iaculis commodo lectus, id placerat felis laoreet vel.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris viverra nulla dolor, sit amet dignissim odio finibus at. Phasellus sapien lacus, venenatis a aliquam non, ornare sed justo. Mauris diam est, malesuada id dolor eget, eleifend feugiat massa. Quisque ut lacus malesuada, egestas eros eu, gravida orci. Donec eleifend ligula quis nibh semper pharetra a ac tortor. Nam faucibus ullamcorper gravida. Ut at interdum turpis. Pellentesque a nibh molestie, laoreet ex pulvinar, accumsan odio. Aliquam non porttitor felis.

In eget mi iaculis, porttitor magna ut, tempor dolor. Mauris malesuada, urna ut mollis vestibulum, leo orci tempor nulla, vitae tristique odio dolor sed nunc. Suspendisse mattis libero nec nunc dignissim, tincidunt semper velit ultricies. Donec porttitor interdum felis, sed pellentesque nibh porttitor sed. Ut fringilla commodo est id varius. Integer sapien orci, viverra a tempor id, ullamcorper quis erat. Suspendisse venenatis blandit mi, vitae eleifend lacus finibus eu. Suspendisse facilisis mauris id dolor pulvinar, vel sodales mauris iaculis. Duis venenatis convallis lacus vel pharetra. Nunc iaculis commodo lectus, id placerat felis laoreet vel.

# Part Four: Topic Pages

To make a topic page, make sure you specify 

type\\: topic-page

In the front matter of the document (i.e. where you write authors, byline, etc)

This will change the way the header renders.

## Sticky Nav

Most of the time, you shouldn’t have to manually specify the sticky nav. We’ve added some heuristics that allow it to automatically map buttons to headings, based on the common sections that we have in our topic pages.

As long as the headings in your page include "Key Insights", "Data Explorer", or "Research & Writing", the sticky nav will automatically find and create buttons for those headings.

This means that “Key insights on Poverty” would still work: the button will still read “Key Insights” however.

It also automatically adds the introduction section, and the citation and licensing sections.

If, however, your Topic Page has headings that aren’t matched by this system, you’ll have to manually specify how the sticky nav should work.

In the front matter of your document (i.e. not inside the \[+body\] tag) write the following (without the skip tags, those are just so this article renders properly in the preview):

:skip  
\[.sticky-nav\]  
target: \#introduction  
text: Introduction

target: \#key-insights  
text: Key Insights

target: \#some-unusual-id  
text: Special Case

target: \#article-citation  
text: Cite this work

target: \#article-licence  
text: Reuse this work  
\[\]  
:endskip

## Topic Page intro

The topic page intro should be included in all Topic Pages. The download button and related topics are optional, however.

Related topics can be gdoc links or external. If they’re external links they need a text property

{.topic-page-intro}  
{.download-button}  
text: Download all data on blah  
url: https://github.com/owid  
{}

\[.related-topics\]  
url: [https://docs.google.com/document/d/1g\_38g\_DYBW8yhTJ2-heHJ4UFwBju41xlZGfirV7VZak/edit](https://docs.google.com/document/d/1g_38g_DYBW8yhTJ2-heHJ4UFwBju41xlZGfirV7VZak/edit)

url: [https://ourworldindata.org/co2-and-other-greenhouse-gas-emissions](https://ourworldindata.org/co2-and-other-greenhouse-gas-emissions)  
text: CO₂ and Greenhouse Gas Emissions  
\[\]

\[+.content\]  
Renewable energy sit amet, consectetur adipiscing elit. Suspendisse dictum consectetur turpis sit amet vestibulum. Vestibulum iaculis orci in nisi tincidunt ornare sit amet nec metus. Nunc non tortor in elit rutrum viverra. Duis vitae vestibulum lacus. Nullam nec arcu non nunc venenatis tincidunt eu vel odio. Donec a felis nec metus tempus mattis.  
\[\]  
{}

## Key Insights

{.key-insights}  
heading: Key Insights on Poverty  
\[.insights\]

title: The age dependency ratio changes by country  
url: https://ourworldindata.org/grapher/age-dependency-breakdown  
\[.+content\]  
All sorts of content can go in here  
Bold, links, lists, prominent links \- you name it.  
\[\]

title: This title shows up as a heading in the slide as well  
filename: default-featured-image.png  
\[.+content\]  
Blah blah

{.callout}  
\[.+text\]

##### What you should know about this data

* Extreme poverty here is defined according to the UN’s definition of living on less than $2.15 a day – an extremely low threshold needed to monitor and draw attention to the living conditions of the poorest around the world. Read more in our article, From $1.90 to $2.15 a day: the updated International Poverty Line.  
* Global poverty data relies on national household surveys that have differences affecting their comparability across countries or over time.  
* Non-market sources of income, including food grown by subsistence farmers for their own consumption, are taken into account.  
* Data is measured in 2017 international-$, which means that inflation and differences in the cost of living across countries are taken into account.  
  \[\]  
  {}

\[\]

title: This is another slide, and it features a narrative chart  
narrativeChartName: global-life-expectancy-has-doubled  
\[.+content\]  
Blah blah blah  
\[\]

\[\]  
{}

## Explorer in a gray section

If you want to write an explanation below the explorer, only use the \[.+expandable-paragraph\] if you have a lot to say. It’s not necessary if you only have a couple of paragraphs.

\[.+gray-section\]  
{.chart}  
url: https://ourworldindata.org/explorers/poverty-explorer  
{}

## A header above the expandable paragraph

\[.+expandable-paragraph\]  
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut laoreet ex nisi, consectetur cursus est sollicitudin euismod. Cras pretium cursus hendrerit. Pellentesque dictum augue vel porta dapibus.

In nec leo urna. Nam vel metus nisi. Nunc bibendum dolor eu sapien scelerisque, id eleifend tellus tincidunt. Phasellus leo diam, tincidunt et bibendum vitae, tristique semper nibh. Phasellus fringilla porta massa sed ullamcorper. Sed dapibus tincidunt euismod.  
\[\]  
\[\]

## Research and Writing {#research-and-writing}

A mosaic of article tiles. The primary section is mandatory, but can have any number of articles inside it. The secondary and more sections are optional and can also have any number of articles.

Each link can either be a Gdoc link, or an external one.

Links in the more section don’t require a filename. All other sections do (if they’re not using a gdoc link that has a featured-image already.)

You can have 0 or more rows.

If you want to hide the article dates in the whole block, use hide-date: true in the main block component.

{.research-and-writing}

\[.primary\]  
url: https://wikipedia.org  
authors: Author 1, Author 2  
title: What are Bananas?  
subtitle: There is no single definition of bananas. Our understanding of the extent of bananas and how it is changing depends on which definition we have in mind.  
filename: bananas.jpg  
\[\]

\[.secondary\]  
url: [Optimism and Pessimism](https://docs.google.com/document/u/0/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk/edit)  
\[\]

{.more}  
heading: More Key Articles on Poverty  
\[.articles\]  
url: https://ourworldindata.org/poverty  
title: The history of the end of poverty has just begun  
authors: Max Roser

url: https://ourworldindata.org/poverty-growth-needed  
title: The economies that are home to the poorest billions of people need to grow if we want global poverty to decline substantially  
authors: Max Roser

url: https://ourworldindata.org/wrong-about-the-world  
title: Most of us are wrong about how the world has changed (especially those who are pessimistic about the future)  
authors: Max Roser  
\[\]  
{}

\[.rows\]  
heading: A row of articles  
\[.articles\]  
url: [Optimism and Pessimism](https://docs.google.com/document/u/0/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk/edit)

url: [Optimism and Pessimism](https://docs.google.com/document/u/0/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk/edit)

url: [Optimism and Pessimism](https://docs.google.com/document/u/0/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk/edit)

url: [Optimism and Pessimism](https://docs.google.com/document/u/0/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk/edit)  
\[\]

heading: Another row of articles  
\[.articles\]  
url: https://ourworldindata.org  
title: A title  
authors: Author 1, Author 2  
filename: default-featured-image.png

url: [Optimism and Pessimism](https://docs.google.com/document/u/0/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk/edit)  
\[\]

\[\]  
{}

## All Charts

The all charts block will show all Grapher charts that share a tag with your article. (Articles are tagged in the [Gdoc index page](https://owid.cloud/admin/gdocs)) 

“Key charts” will be displayed at the top of the list, and if you want even more control than that, you can include a \[.top\] section with a list of grapher urls to prioritize. These urls must be for charts that are part of the category.

{.all-charts}  
heading: Interactive Charts on Poverty  
\[.top\]  
url: https://ourworldindata.org/grapher/size-poverty-gap-countries

url: https://ourworldindata.org/grapher/gdp-per-capita-maddison-2020  
\[\]  
{}

# 

# Part Four (bis): Linear topic pages

Additional front matter fields (remove the backslash when copy/pasting):

heading-variant\\: light

## LTP table of contents

This component provides a specialized table of contents for linear topic pages, with a primary section showing page content links and a secondary section with cards linking to all data and writing on the topic.

The generation of the sidebar-toc and inline toc have been merged:

* Currently all pages using the sidebar-toc are LTPs  
* The sidebar-toc is planned to be phased out in favour of the inline one.  
* They might be used concurrently for a while, and we want consistency across ToCs

Right now, it is possible to show both the sidebar-toc and the inline toc, which is repetitive at the top of the page and is discouraged. For now, it is up to the author to decide whether the overlap is worth it.

{.ltp-toc}

title: Will default to “Sections”

{}

## “Explore the data”

This component creates a blue-background section with a chart icon and a title (defaulting to "Explore the data") that can contain any other Gdoc blocks, similar to the `gray-section`​ block.

{.explore-data-section}  
title: Will default to "Explore the data"  
\[.+content\]  
    // \- designed with text column titled with a h2  
    // \- then some sticky-\* content  
\[\]  
{}

## Research and writing

For linear topic pages, add the following attribute to a regular [Research and Writing](#research-and-writing) block to use the appropriate design:

{.research-and-writing}  
variant: featured  
{}

## Featured metrics

Display featured metrics related to the current topic (requires a topic tag to be set on the document):

{.featured-metrics}  
   // no parameters, same results as a filtered search  
{}

## Featured data insights

Display data insights related to the current topic (requires a topic tag to be set on the document):

{.featured-data-insights}  
   // no parameters, same results as a filtered search  
{}

#   Part Five: Data Insights

The front matter for data insights looks like this (remove the backslash when copy/pasting)

type\\: data-insight  
title\\: Title of the data insight  
authors\\: the author  
approved-by\\: who approved the data insight to be published  
grapher-url\\: grapher url so that we know which data this insight should be linked to (doesn't show up automatically in the post in any way)  
narrative-chart\\: name of a narrative chart, if applicable, so that we know which data this insight should be linked to (doesn't show up automatically in the post in any way)  
figma-url\\: Link to the chart in Figma so that we know where the final edit of the chart lives (we’ll use this link in the admin to download the chart from Figma)

The body should contain the text of the insight and one image. The image should be in square format and be 2160px wide.

Use the export tab to download both the mobile png version, upload it and add an image component that references the image (see the example below)

If you view the chart through the admin chart editor, you can customize the chart so that it works well for the insight (by changing the selection of countries, the subtitle or footnotes etc).

{.image}  
filename: data-insight-daniel-people-living-in-democracies-autocracies.png  
size: narrow  
{}

Data insights are stored on GDrive in [this folder](https://drive.google.com/drive/u/0/folders/1tImR6L-viqlABvPVw_5nUez9CVYag5el).  
You can use the [Data Insight default GDoc template](https://docs.google.com/document/d/1R_0rPmbofVnNrFUUUtqPvWCLypOzG_AqVJHSq99x3IA/edit) to create a new DI.

# Part Six: Homepage

The homepage is a special type of Gdoc template with several one-off components written for it.

First, you must set the type of your document to homepage

type\\: homepage

Then add the following components to the page’s \[+body\] tag

## Pill row {#pill-row}

The pill row is a small grey bar of links that sits at the top of the homepage below the nav bar.

{.pill-row}  
title: Popular Articles  
\[.pills\]  
text:   
url: Optimism & Pessimism https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk/edit

text: Life Expectancy  
url: https://ourworldindata.org/grapher/life-expectancy  
\[\]  
{}

## Homepage Search

The homepage search component places a wide section with a search bar, in the page. 

When on the homepage, the search bar in the nav disappears, so make sure you add this component\!

{.homepage-search}  
{}

## Homepage Intro

The homepage intro is a large block of links to OWID content, as well as some hard-coded text about our mission statement, etc.

You must specify exactly 4 articles

Each tile’s kicker attribute is free text and as of February 2024, we don’t have strong recommendations for what to put there.

Any article may have isNew: true specified, which will show a small red pill that says “NEW” before the kicker of any article

{.homepage-intro}

\[.featured-work\]  
kicker: Article \- 10 Min Read  
url: https://docs.google.com/document/d/1iH\_m2GlsBuif80sDwfg0fNGZmpf9X0-TFM5oHQr9fPA/edit  
isNew: true

kicker: Article \- 10 Min Read  
url: https://docs.google.com/document/d/1KCSkpWvSml9KZaqTO7TGWsUDpACZIxBoqs9Yw62Klx8/edit

kicker: Article \- 10 Min Read  
url: https://docs.google.com/document/d/1PvKMIDp0Npp-t\_5F-tNp-w9Y2Lq4ifjWDJHEVQQ6bNw/edit

url: https://docs.google.com/document/d/11t6XP9vKLDHeiDOcfaPOoc4TeQxHRixSjEikAlbGe0A/edit  
title: We updated our topic page on Artificial Intelligence  
kicker: Announcement  
\[\]

{}

## Latest data insights

This component will add a grey section with the latest 4 data insights displayed. Should only be added if there are at least 4 published data insights.

{.latest-data-insights}  
{}

## Key Indicator Collection

The key indicator collection takes an array of {.key-indicator} items and displays them in an accordion. 

datapageUrl must link to a grapher that is a datapage.

{.key-indicator-collection}

\[.+indicators\]

{.key-indicator}  
datapageUrl: https://ourworldindata.org/grapher/child-mortality?time=earliest..latest  
title: What share of children died before their fifth birthday?  
source: Long-run estimates combining data from UN & Gapminder  
\[.+text\]  
What could be more tragic than the death of a young child? Child mortality, the death of children under the age of five, is still extremely common in our world today. But the historical data makes clear that it doesn’t have to be this way: it is possible for societies to protect their children and reduce child mortality to very low rates.  
For child mortality to reach low levels, many things have to go right at the same time: good healthcare, good nutrition, clean water and sanitation, maternal health, and high living standards. We can, therefore, think of child mortality as a proxy indicator of a country’s living conditions.  
The chart shows our long-run data on child mortality, which allows you to see how child mortality has changed in countries around the world.  
\[\]  
{}

{.key-indicator}  
datapageUrl: https://ourworldindata.org/grapher/share-of-population-in-extreme-poverty  
title: What share of the population is living in extreme poverty?  
\[.+text\]  
The UN sets the ‘International Poverty Line’ as a worldwide comparable definition for extreme poverty. Living in extreme poverty is currently defined as living on less than $2.15 per day. This indicator, published by the World Bank, has been successful in drawing attention to the terrible depths of poverty of the poorest people in the world.  
Two centuries ago, the majority of the world’s population was extremely poor. Back then, it was widely believed that widespread poverty was inevitable. But this turned out to be wrong. Economic growth is possible and makes it possible for entire societies to leave the deep poverty of the past behind. Whether or not countries are leaving the worst poverty behind can be monitored by relying on this indicator.  
\[\]  
{}

\[\]

{}

## Explorer Tiles

A grid of 4 links to explorers. 

The explorers should be tagged in [the admin](https://owid.cloud/admin/explorer-tags) and the tag should have an icon specified in [the tag icons folder in git](https://github.com/owid/owid-grapher/tree/master/public/images/tag-icons). 

If you would like to link to an explorer whose tag does not exist, contact Marwa and Ike.

{.explorer-tiles}  
title: Data explorers  
subtitle: Interactive visualization tools to explore a wide range of related indicators.  
\[.explorers\]  
url: https://ourworldindata.org/explorers/poverty-explorer  
url: https://ourworldindata.org/explorers/energy  
url: https://ourworldindata.org/explorers/co2  
url: https://ourworldindata.org/explorers/global-health  
\[\]  
{}

\[\]

# Part Seven: Author pages

Author pages are profile pages where authors can showcase their work. 

## Header {#header}

In their header, author pages include the following information:

type: author  
authors: 

**the author's name**.   
⚠️ The “title” field should contain the author's name as used in the “authors” field of articles. This is used to filter and populate the “Latest work” section below.  
title: Saloni Dattani

**a profile picture**  
featured-image: saloni-owid.jpeg

**the author’s role**  
role: Researcher

**a bio section**, which supports multiple paragraphs of rich text  
\[.+bio\]  
Saloni joined us as a researcher in 2021\. She is a Project Lead at Global Change Data Lab focusing on health. She has a Ph.D. in psychiatric genetics from the University of Hong Kong and King’s College London.  
\[\]

**a socials section**, where authors can add multiple links to their social media profiles.   
💡Allowed types are: link, email, x, facebook, instagram, youtube, linkedin, threads, mastodon, bluesky.  
\[socials\]  
url: saloni@ourworldindata.org  
text: saloni@ourworldindata.org  
type: email

url: https://twitter.com/salonium  
text: @salonium  
type: x  
\[\]

## Author page templates

There are two types of author pages, depending on what contribution an author is primarily making to the site.

### Article focus

*Example: [Saloni](https://admin.owid.io/admin/gdocs/1cCJN2WkqfvjprpANtSD-AqYDdGiMmEdESocAOwm21hg/preview)*  
If an author publishes mostly articles, the template includes 3 main sections:

**a topics section** where authors can choose what topics they want to feature.   
💡 the syntax is identical to the [pill row used on the homepage](#pill-row)  
⚠️ make sure the pills stay on a single line on desktop (\~ 5 to 7 topics max for now)

{.pill-row}  
title: Topics covered by Saloni on Our World in Data  
\[.pills\]  
text: Causes of Death  
url: [https://docs.google.com/document/d/1srs-VlnCNd1lMZBiuzNRUBsT41wWnGWddFRMiZ0jNaE/edit](https://docs.google.com/document/d/1srs-VlnCNd1lMZBiuzNRUBsT41wWnGWddFRMiZ0jNaE/edit)

text: Life Expectancy  
url: [https://docs.google.com/document/d/19AlSstYCtGglhNNt9mbKGAEf\_oZcQTKNjYJ-5BlXSts/edit](https://docs.google.com/document/d/19AlSstYCtGglhNNt9mbKGAEf_oZcQTKNjYJ-5BlXSts/edit)  
\[\]  
{}

**a "Featured work" section** where authors can choose what articles they want to feature  
💡This is the [research and writing block from topic pages](#research-and-writing). The “hide-authors” property hides authors on all the article cards throughout the block.  
👍This block should contain at least one primary and a maximum of two secondary featured articles.  
❌This block should not list any data insights.  
❌This block should not list any topics. Use the topic pills instead (see above) 

{.research-and-writing}  
heading: Featured work  
hide-authors: true

\[.primary\]  
url: [https://docs.google.com/document/d/1fnqudOrHtKwVb4HZ8IG\_np0gqRNkeqlFRKA\_NPMesKA/edit](https://docs.google.com/document/d/1fnqudOrHtKwVb4HZ8IG_np0gqRNkeqlFRKA_NPMesKA/edit)   
\[\]

\[.secondary\]  
url: [https://docs.google.com/document/d/1IIijqBdZ9sev\_QZ\_iAorz3Rh7GI1RiM3fMrdvvaUOLM/edit](https://docs.google.com/document/d/1IIijqBdZ9sev_QZ_iAorz3Rh7GI1RiM3fMrdvvaUOLM/edit)

url: [https://docs.google.com/document/d/1cy2yHPXtywE9K7CWGtU0qNFRx0JAyZhxK5PkuqeW31o/edit](https://docs.google.com/document/d/1cy2yHPXtywE9K7CWGtU0qNFRx0JAyZhxK5PkuqeW31o/edit)   
\[\]

{.latest}  
:skip

💡This block automatically pulls in the latest articles an author has published. It excludes any article featured above.

:endskip

{}  
{}

### Topic focus

*Example: [Fiona](https://admin.owid.io/admin/gdocs/1dt3Y98Z2S07ijr0kPq4FXzV2MgL1CycNzP9y-6D-3Fo/preview)*  
If an author's work is mostly focused on topic pages, the template includes a single section:

**an "All work" section** where authors can choose what topic pages and articles they want to feature.  
⚠️Authors need to keep this section updated with any new work they want to feature. By design, this section isn’t automated. Authors can get an updated list of all their publications by visiting this URL: [https://admin.owid.io/admin/api/all-work?author=Fiona%20Spooner](https://admin.owid.io/admin/api/all-work?author=Fiona%20Spooner) (replace the last part with your full name as it appears in the “title” field). The content of this page can then be copied in the \[.secondary\] section below, as-is.  
❌This block should not have a primary section.  
❌This block should not list any data insights.

{.research-and-writing}

heading: All work  
hide-authors: true

\[.secondary\]

url: https://docs.google.com/document/d/1mDkPiGSy3dHCfnIFc1HAPU2XU3yz9iKWBNWfRUTniCw/edit

url: https://ourworldindata.org/biodiversity  
title: Biodiversity  
subtitle: Explore the diversity of wildlife across the planet. What are species threatened with? What can we do to prevent biodiversity loss?  
authors: Hannah Ritchie, Fiona Spooner  
filename: Biodiversity-thumbnail.png

url: https://docs.google.com/document/d/1MIqYC2m9BbCQWZp6g\_1N6BDAXeXkEUAx-KaJrlWbcrE/edit

url: https://docs.google.com/document/d/16tVxsM1-wzwm\_wpno-Y-M\_IEInOCPJuWZqHfMLywNJc/edit

\[\]

{}

# Part Eight: About pages

These are the pages used for presenting information about Our World in Data itself. They have a dedicated sub-navigation, with the main page being [https://ourworldindata.org/about](https://ourworldindata.org/about) ([source](https://docs.google.com/document/u/0/d/1o4eZ1pG20THk8QahhcbE5WarBBrXChkun_YbVMxy0-s/edit), [all GDocs](https://drive.google.com/drive/u/1/folders/1Fud3WLpMCov2aToOHV1zqAijgK1h_2dn)).

These pages behave like normal articles, but some of the styling is different, particularly spacing and typography. They also have a few dedicated ArchieML components, which are not expected to be used in other pages.

To signify that a document is an about page, use type: about-page in the front matter.

## Donors

The list of donors is stored in the database and to add it to an about page, you only have to include an empty block, signifying its place in the document:

{.donors}  
{}

## People

We have a set of components to present a list of people, i.e. team members, former team members, and board members. In its most basic form with the minimum required attributes, the list may look like this:

\[.+people\]  
{.person}  
name: Professor Sir David Hendry  
\[.+text\]  
David Hendry was a founding member of our Board of Trustees. He is co-director of [Climate Econometrics](https://www.nuffield.ox.ac.uk/our-research/research-centres/climate-econometrics/) at Nuffield College and...  
\[\]  
{}

{.person}  
name: Professor Stefano Caria  
\[.+text\]  
Stefano Caria was a founding member of our Board of Trustees. He is...  
\[\]  
{}  
\[\]

The full example including the optional attributes looks like this:

{.people-rows}  
columns: 2

\[.+people\]  
{.person}  
image: Max Roser.jpeg  
name: Professor Max Roser  
title: Founder and Executive Co-Director  
url: https://docs.google.com/document/d/1NfXOk8HVohVYjzJ1rtZYuw8h7kB9cWd5Kqxj4Dg1-WQ/edit  
\[.+text\]  
Max is the founder of Our World in Data and began working on this free online publication in 2011\. Today, he serves as the publication’s editor and leads the team as its co-director. He is the Professor of Practice in Global Data Analytics at the University of Oxford’s Blavatnik School of Government, the Programme Director of the [Oxford Martin Programme on Global Development](https://www.oxfordmartin.ox.ac.uk/global-development/), and the Executive Co-Director of [Global Change Data Lab](https://global-change-data-lab.org/), the non-profit organization that publishes Our World in Data.

*For inquiries, please get in touch with Max’s Executive Assistant, Angela Wenham, at [angela@ourworldindata.org](mailto:angela@ourworldindata.org).*  
\[\]  
\[.socials\]  
type: x  
url: https://x.com/MaxCRoser  
text: @MaxCRoser 

type: mastodon  
url: https://mas.to/@maxroser  
text: @maxroser

type: bluesky  
url: https://bsky.app/profile/maxroser.bsky.social  
text: @maxroser.bsky.social

type: threads  
url: https://www.threads.net/@max.roser.ox  
text: @max.roser.ox  
\[\]  
{}  
\[\]  
{}

### People rows

The {.people-rows} is an optional component to wrap the \[.+people\] list with. Apart from the nested list of people, its only property is columns:, which can be either 2 or 4\. Based on that value the list of people will be displayed in the corresponding number of columns on the largest screen, falling back to fewer columns on smaller screens instead of a single column everywhere.

### People list

The \[.+people\] component must contain only a list of one or more {.person} blocks.

### Person

The {.person} component groups attributes of a person:

* image: \- filename of an image that has been already uploaded in the admin  
* name: \- person’s full name  
* title: \- title that will be displayed below the name  
* url: \- URL to a GDoc of an author page (for those who have it)  
* \[.+text\] \- free form [text](#styling-text) with person’s bio/description  
* \[.socials\] \- list of links to socials, follows the same format as in [Author pages](#header)

## :ignore below this line

You can put anything in this section that you want\!  
