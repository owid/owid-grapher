# Fonts

The scripts in this directory will update the site's self-hosted font files and generate a new set of `@font-face` definitions that can either be imported into the site's stylesheet or served at its own endpoint to be imported by static SVGs.

## Usage

To update the .woff2 files in `public/fonts` and the css at `fonts.css` run:

```console
make
make install
```

The first `make` command will download Lato and Playfair Display and convert them to woff2 format using the [woff2 command line tool](https://github.com/google/woff2). After it completes, take a look at the `diff` output to make sure the changes it has made to `fonts.css` look reasonable, then running `make install` will copy the css and woff2 files into the repo's `public` directory. Afterwards, you can commit the font-related changes (if any).

## Dependencies

-   Python3 (in order to use the [`fontTools.ttLib`](https://pypi.org/project/fonttools/) module for calculating the `unicode-range` settings for Lato)
-   `woff2_compress` (can be installed via `brew install woff2`)
-   the repo's copy of prettier in `../../node_modules`

## Typefaces

### Lato

Our version of Lato comes from the [project's website](https://www.latofonts.com/lato-free-fonts/). We're using the woff2 files from the webfont archive available at: https://www.latofonts.com/download/lato2oflweb-zip/

The LatoLatin fonts are much smaller than Lato proper but cover a more limited set of glyphs. For our purposes the main thing they're missing is superscripts & subscripts. As a result we want to use the LatoLatin versions in the general case and only load the full face when we need a paricular glyph.

> Note that using _a single glyph_ not in the Latin face will cause the full version to load for that weight & style, so if we end up using something from the full set regularly (e.g., as part of a header or footer element present on all pages), the pageload size will start to creep up.

### Playfair Display

There doesn't seem to be a canonical source for Playfair, though there's a pre-release of the 2.0 variable-font version on github (which might be worth switching to when it's finalized):
https://github.com/clauseggers/Playfair

Instead, we're using the OTFs available on FontSquirrel:
https://www.fontsquirrel.com/fonts/download/playfair-display

These are then converted into woff2 files using `woff2_compress`.
