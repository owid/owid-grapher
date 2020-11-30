# Owid Wayback

This is a testing tool to view old versions of the static site. While you can open the static files directly, lots of assets urls are absolute and reference new assets.

This rewrites the urls so you can use old versions of the site with the correct old assets.

## How to use

1. Get the static site: `git clone https://github.com/owid/owid-static`. Clone it to the same parent folder as `owid-grapher`
2. Run `./wayback.ts`

You should now be able to browse a static, offline, fully(partially) working version of Owid.

To go wayback, say to July 1st, 2020, go to the `owid-static` folder and run a command like:

`git checkout 'master@{2020-07-01}'`

## Todo:

-   Fix some missing images and url bugs
-   Fix a "replaceState" bug with the Covid Explorer
-   Add an easier ability to jump to different checkpoints by date?
