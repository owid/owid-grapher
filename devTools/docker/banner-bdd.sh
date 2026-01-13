#!/bin/bash

cat << EOF
   __    __   __
  /  )  /  ) /  )
 /--<  /  / /  /
/___/_/__/_/__/_

You are now running the Behaviour-Driven Development (BDD) test environment in tmux!

Gherkin features describe application behavior in plain language for better collaboration
between developers, testers, and non-technical stakeholders. Features are converted and
run as playwright tests to validate application functionality across browsers.

What just started:
    Window 0: feature watcher (auto-runs yarn bddgen on changes to TS code or Gherkin features)
    Window 1: Playwright tests (watch mode for make bdd, UI for make bdd.ui)

Where to look:
    features/              <-- Gherkin feature files
    site/**/*.{ts,tsx}     <-- site code under test

A quick tmux cheatsheet:
    <C-b>, 0       move to pane numbered 0
    <C-b>, R       restart a crashed pane
    <C-b>, X       kill and close a pane
    <C-b>, K       close all panes and exit tmux

Happy testing!
EOF
