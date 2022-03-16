#!/bin/bash
cat << EOF
                        _
                       | |
  __,  ,_    __,    _  | |     _   ,_
 /  | /  |  /  |  |/ \_|/ \   |/  /  |
 \_/|/   |_/\_/|_/|__/ |   |_/|__/   |_/
   /|            /|
   \|            \|

You are now running the grapher dev environment!

The dev environment uses tmux, and runs services in multiple panes.
For example, switch to pane 0 by typing <C-b> then "0".

If this is your first time starting the environment, it may take
take 5-15 minutes to load example data and charts into the dev db.

If it is working, you can try:

    http://localhost:8080/  <-- an admin interface for grapher

You can log into the admin interface with credentials:

    admin@example.com / admin

The test page compares charts using local code to those on the live site:

    http://localhost:8080/admin/test

Happy hacking!
EOF
