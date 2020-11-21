# Embedded Figures

[note: This readme is a stub.]

Other sites can embed all our Graphers and Explorers as iFrames. Internally we can do something a little more efficient and powerful using this "Embedded Figures" concept.

## Step 1

Authors can drop one of two kinds of tags into their Wordpress posts:

```
<div some-selector-for-graphers />

// or:

<div some-selector-for-explorers />
```

## Step 2

On page load, and/or during scrolls, we can render a Grapher or Explorer into those divs, respectively.

## Benefits

1. Doing it this way instead of iframes means they can be more performant? (is this true?)

2. We can also not do the rendering until the page is scrolled into view. (couldn't we do this with iframes?)

3. We can share selection across charts (couldn't we do this with iframes and urls or localstorage or postmessage?)

(note: what are the benefits of this? Seems like <iframe> with lazy loading may accomplish everything and be a lot less work on our part, particualry around testing, and we would get to spend more time optimizing the normal embed usage our external embeddeds have).
