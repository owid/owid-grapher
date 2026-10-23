#!/bin/bash

cat <<EOF
   ___  __                _       __   __
  / _ \/ /__ ___ _____  | | /| / /__/ /  _______ ____  ___
 / ___/ / _ `/ // / _ \ | |/ |/ / -_) _ \/ __/ _ `/ _ \/ -_)
/_/  /_/\_,_/\_, /\___/ |__/|__/\__/_//_/_/  \_,_/_//_/\__/
            /___/

You are now running the Playwright test environment in tmux.

What just started:
    Window 0: Playwright tests (watch mode for make playwright, UI for make playwright.ui)

Where to look:
    playwright/            <-- direct Playwright test files
    site/**/*.{ts,tsx}     <-- site code under test

A quick tmux cheatsheet:
    <C-b>, 0       move to pane numbered 0
    <C-b>, R       restart a crashed pane
    <C-b>, X       kill and close a pane
    <C-b>, K       close all panes and exit tmux

Happy testing!
EOF
