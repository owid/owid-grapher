## Set up Git on Windows

If you are on Windows, make sure that you configure Git to use linux line ending (LF) instead of windows line endings (CRLR) **before** checking out this repository on your local machine. If you fail to do so then the line endings will be converted to the usual windows default for all files including shell scripts and when those are then executed inside the Linux based devcontainer the scripts to load the database etc will fail.

To verify the line endings, open a file (e.g. the README.md file) and have a look at the VS Code status bar in the lower right corner. If the settings are correct it should show "LF". If your line endings were switched by git to the windows ones then it will read "CRLF"

To make sure that Git will leave line endings alone and not convert them for you need to run two commands **before** checking out this git repo:

```powershell
git config --global core.autocrlf false
git config --global core.eol lf
```

VS Code will be perfectly able to handle files using the linux default LF only line ending character. Other, older text editors like Notepad might have an issue with this.

If other repositories you contribute to need to use crlf then do this on those other repositories (and see [more information on stackoverflow](https://stackoverflow.com/questions/2517190/how-do-i-force-git-to-use-lf-instead-of-crlf-under-windows)):

```powershell
git config core.eol crlf
```
