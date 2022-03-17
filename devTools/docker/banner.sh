#!/bin/bash
cat << EOF
                        _
                       | |
  __,  ,_    __,    _  | |     _   ,_
 /  | /  |  /  |  |/ \_|/ \   |/  /  |
 \_/|/   |_/\_/|_/|__/ |   |_/|__/   |_/
   /|            /|
   \|            \|

You are now running the grapher dev environment using tmux!

A quick tmux cheatsheet:
    <C-b>, 0       move to pane numbered 0
    <C-b>, n       make a new terminal pane
    <C-b>, R       restart a crashed pane
    <C-b>, X       kill and close a pane
    <C-b>, Q       close all panes and exit tmux

The first time you run this, it can take 5-15 mins to create the db. You
can watch its progress by switching to pane 0 (docker).

Try these URLs to see if your environment is working:

    http://localhost:3030/  <-- a basic version of Our World in Data
    http://localhost:3030/grapher/life-expectancy  <-- an example chart
    http://localhost:3030/admin/  <-- an admin interface, login with
                                      "admin@example.com" / "admin"
    http://localhost:3030/admin/test  <-- a list of all charts in the db

Happy hacking!
EOF
