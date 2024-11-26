# Fonts

The scripts in this directory will update the site's self-hosted font files and generate a new set of `@font-face` definitions that can either be imported into the site's stylesheet or served at its own endpoint to be imported by static SVGs.

## Usage

To update the .woff2 files in `public/fonts` and the css at `public/fonts.css` run:

```console
make
make install
```

The first `make` command will download Lato and Playfair Display and convert them to woff2 format using the FontTools library. After it completes, take a look at the `diff` output to make sure the changes it has made to `fonts.css` look reasonable. You can also try running `make test` to try the generated webfonts in a browser before proceeding. Once you're happy with the results, run `make install` to copy the css and woff2 files into the repo's `public` directory. Afterwards, you can commit the font-related changes (if any) and run `make clean` to delete the intermediate files.

You can also run `make report` to display the current division of characters between the Latin subsets (see below) and the full versions of each font. If a character needs to be added to the subset, find its hex ID in the listing and add it to the `LATIN_RANGE` variable in the Makefile then regenerate the fonts.

## Dependencies

- Python3 (in order to use the [`fontTools.ttLib`](https://pypi.org/project/fonttools/) module for converting otf to woff2, creating the LatoLatin & PlayfairLatin fonts with its [subset](https://fonttools.readthedocs.io/en/latest/subset/index.html) tool, and unpacking the `cmap` table to calculate `unicode-range` settings for switching between the subset and full version in the browser)
- the repo's copies of prettier and express in `../../node_modules`
- the `jq` command line tool

## Typefaces

### Lato

Our version of Lato comes from the [project's website](https://www.latofonts.com/lato-free-fonts/). We're using the woff2 files from the webfont archive available at: https://www.latofonts.com/download/lato2oflweb-zip/

The official distribution includes "LatoLatin" fonts which are much smaller than Lato proper but cover a more limited set of glyphs. For our purposes the main thing they're missing is superscripts & subscripts (and even the ones they include lack the proper unicode IDs and can't be used). As a result, we're creating our own custom version of "LatoLatin" which contains the same subset of characters that the Google Fonts version did, plus the sub/sup figures and some useful ff ligatures. As a result, most pages will only need to load the latin subset and will fall back to the full typeface only when a missing glyph is used.

> Note that using even _a single glyph_ that's not present in the Latin face will cause the full version to load for that weight & style, so if we end up using something from the full set regularly (e.g., as part of a header or footer element present on all pages), the pageload size will start to creep up.

### Playfair Display

There doesn't seem to be a canonical source for Playfair, though there's a pre-release of the 2.1 variable-font version [on github](https://github.com/clauseggers/Playfair) (which we'll probably want to update to when it's finalized). Instead, we're using Playfair 1.2 TTFs downloaded from [Google Fonts](https://fonts.google.com/specimen/Playfair+Display) and generating both a full woff2 version and a PlayfairLatin subset using the same unicode ranges as for LatoLatin.
