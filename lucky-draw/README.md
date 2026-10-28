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
