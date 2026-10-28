# Lucky Draw

A browser-based lucky draw game. Upload a list of names from Excel and draw
winners one at a time — as many rounds as you like.

## Use it

Open `index.html` in a browser (or host the folder on any static web server).

1. **Add participants** — upload an `.xlsx`, `.xls` or `.csv` file (first sheet is
   used), or paste names one per line. Use *Download template* for a sample file.
   If the sheet has several columns, pick which column holds the names.
2. **Draw** — click *Draw winner* (or press Space). One name is picked per round.
3. Repeat for as many winners as you need. Each winner is removed from the pool,
   so nobody wins twice. Drawing stops only when every name has been drawn.

Extras: *Undo last draw* returns the last winner to the pool, *Export to Excel*
downloads the winners list, and *Fullscreen* is handy for projecting on a screen.
Progress is saved in the browser, so a page refresh doesn't lose the draw.

## Fairness

Winners are chosen with the browser's cryptographic random generator
(`crypto.getRandomValues`) using unbiased sampling — every remaining name has an
equal chance each round. The spinning animation is cosmetic; the winner is
decided the moment you click.

## Notes

Excel parsing uses [SheetJS](https://sheetjs.com/) loaded from cdnjs, so an
internet connection is needed for Excel upload/export. Pasting names works offline.

## Offline version (no internet, nothing uploaded)

`lucky-draw-offline.html` is a single self-contained file for use inside a
company network. Download it to your laptop and double-click to open it in any
modern browser (Chrome, Edge, Firefox, Safari).

- The Excel reader is embedded in the file, so it works with no internet connection.
- Uploaded spreadsheets are read by the browser on your own computer. Nothing is
  sent to any server or cloud service.
- The page sets a strict Content-Security-Policy (`default-src 'none'`), so the
  browser blocks any network request it could attempt.
- Export to Excel and the template download save straight to your Downloads folder.

The file includes [SheetJS](https://sheetjs.com/) Community Edition 0.18.5
(Apache-2.0).
