# Lucky Draw

A lucky draw game. Load a list of names from Excel and draw winners one at a
time.

## Use it (offline, nothing uploaded)

`lucky-draw-offline.html` is a single self-contained file. Download it to your
laptop and double-click to open it in Chrome, Edge, Firefox or Safari.

- The Excel reader is embedded in the file, so it works with no internet connection.
- Uploaded spreadsheets are read by the browser on your own computer. Nothing is
  sent to any server or cloud service.
- The page sets a strict Content-Security-Policy (`default-src 'none'`), so the
  browser blocks any network request it could attempt.

## Your Excel file

One person per row on the first sheet, with a header row, for example:

| Staff ID | Name         | Department |
|----------|--------------|------------|
| E001     | Aisha Rahman | ECSO       |
| E002     | Ben Lee      | Finance    |

The page finds the name column and the group column itself (it looks for headers
like "Name" and "Department", or a column containing "ECSO"). You can change
either column after loading. *Download template* gives you a sample file. You can
also paste names, with an optional group: copy two columns from Excel, or type
`Name, Group` per line.

## Draw rules

**By group** (default): 2 winners from ECSO and 1 from everyone else, 3 in total.
The group and both numbers can be changed. Each round picks one name at random
from everyone whose group still has a winner slot open, and the draw stops when
every slot is filled. Group names match regardless of capitals or extra spaces.

**No limit:** each round picks one name from everyone left, as many rounds as you like.

In both modes a winner is removed from the pool, so nobody wins twice.

### When a winner isn't available

Click **Not available** next to the winner's name. They are crossed out, they
don't go back into the pool, and the draw button changes to **Draw replacement**.
The replacement always comes from the same side of the rule: an ECSO winner is
replaced by someone from ECSO, a non-ECSO winner by someone from outside ECSO.
There is no limit on how many replacements you can draw. *Undo* next to a
crossed-out name reverses the mark until the replacement has been drawn. Copy
and Export to Excel show each row's status (Winner, Not available, or which
number a winner replaces).

The rule is not shown to the audience: the draw screen, the winners list and the
pool list never show anyone's group. The rule's progress (for example
"ECSO 1 of 2, non-ECSO 0 of 1") appears only in the Draw rule settings. Click
*Audience view* before presenting to hide all settings, and *Show settings* to
bring them back. Copy and Export to Excel still include each winner's group for
your records.

## Fairness

Winners are chosen with the browser's cryptographic random generator
(`crypto.getRandomValues`) using unbiased sampling. Within the by-group rule,
everyone eligible in a round has the same chance. The spinning animation is only
for show; the winner is decided the moment you click.

## Other controls

*Undo last draw* returns the last winner to the pool. *Copy* and *Export to Excel*
give you the winners with their group and time. *Fullscreen* is for a projector.
Progress is saved in the browser, so a refresh doesn't lose the draw.

## Source

`source/lucky-draw.html` is the page itself (also published as a web page).
`source/build.py` embeds [SheetJS](https://sheetjs.com/) Community Edition 0.18.5
(Apache-2.0) and system fonts to produce the offline file:

```
python3 source/build.py path/to/xlsx.full.min.js lucky-draw-offline.html
```
