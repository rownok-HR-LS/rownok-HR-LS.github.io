# Rownok Rahman · Portfolio

Personal portfolio of Rownok Rahman, HR Manager & Project Manager. Live at **https://rownok-hr-ls.github.io/**

Plain HTML, CSS and JavaScript with no build step. GitHub Pages serves the `main` branch as-is.

## Files

| File | What it is |
|------|------------|
| `index.html` | The portfolio page (all text lives here) |
| `styles.css` | Colors, fonts and layout (colors are the variables at the top) |
| `script.js` | Footer year and the "Copy email" button |
| `cv/index.html` | Source for the CV, also viewable at `/cv/` |
| `Rownok-Rahman-CV.pdf` | The downloadable CV, built from `cv/index.html` |
| `images/` | Portrait photo (`rownok.webp` for the site, `rownok.jpg` for the CV and link previews) |

## Updating

1. Edit the text in `index.html`, and in `cv/index.html` if the CV should change too.
2. Rebuild the CV PDF (uses Microsoft Edge):
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\build-cv.ps1
   ```
3. Commit and push to `main`. The live site updates within a minute or two.
