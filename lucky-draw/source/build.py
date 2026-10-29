# Builds ../lucky-draw-offline.html from lucky-draw.html with SheetJS embedded.
# Usage: python3 build.py <path to xlsx.full.min.js 0.18.5> <output.html>
#   (get it with: npm pack xlsx@0.18.5 && tar xzf xlsx-0.18.5.tgz -> package/dist/xlsx.full.min.js)
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'lucky-draw.html')).read()
lib = open(sys.argv[1]).read().replace('</script', '<\\/script')
head_old = src[:src.index('<style>')]
src = src[src.index('<style>'):]
head = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:">\n'
        '<title>Lucky Draw</title>\n<!-- Offline build: everything is embedded. This page makes no network requests. -->\n'
        '<script>\n' + lib + '\n</script>\n')
def rep(old, new):
    global src
    assert src.count(old) == 1, old
    src = src.replace(old, new)
# system fonts only
rep('--font-display: "Anton", Impact, "Arial Narrow", sans-serif;', '--font-display: Impact, "Arial Narrow Bold", "Arial Black", sans-serif;')
rep('--font-body: "Figtree", system-ui,', '--font-body: system-ui,')
rep('--font-mono: "JetBrains Mono", ui-monospace,', '--font-mono: ui-monospace,')
rep('  * { box-sizing: border-box; }', '  * { box-sizing: border-box; }\n  [hidden] { display: none !important; }\n  html { color-scheme: light; }\n  body { margin: 0; }')
rep('</style>', '</style>\n</head>\n<body>')
# privacy note
rep('<p class="muted small">Names are read from the first sheet:',
    '<p class="sample-note">Offline version: your file is read on this computer only. Nothing is uploaded.</p>\n        <p class="muted small">Need a starting point? <button class="link-btn" id="templateBtn" type="button">Download template</button></p>\n        <p class="muted small">Names are read from the first sheet:')
# export button
rep('<button class="btn" id="copyBtn" type="button" disabled>Copy winners</button>',
    '<div class="top-actions"><button class="btn" id="copyBtn" type="button" disabled>Copy</button><button class="btn" id="exportBtn" type="button" disabled>Export to Excel</button></div>')
rep('$("copyBtn").disabled = !state.winners.length;', '$("copyBtn").disabled = !state.winners.length;\n    $("exportBtn").disabled = !state.winners.length;')
rep('  function render() {', '''  function exportWinners() {
    var rows = state.winners.map(function (w) {
      return { Round: w.round, Name: w.name, Group: w.group || "", Status: statusOf(w), "Drawn at": new Date(w.time).toLocaleString() };
    });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Winners");
    XLSX.writeFile(wb, "lucky-draw-winners.xlsx");
  }

  function downloadTemplate() {
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Name", "Department"], ["Alice Tan", "ECSO"], ["Ben Lee", "Finance"], ["Chandra Kumar", "ECSO"], ["Daniel Wong", "HR"]]), "Participants");
    XLSX.writeFile(wb, "lucky-draw-template.xlsx");
  }

  function render() {''')
rep('$("copyBtn").addEventListener("click", copyWinners);', '$("copyBtn").addEventListener("click", copyWinners);\n  $("exportBtn").addEventListener("click", exportWinners);\n  $("templateBtn").addEventListener("click", downloadTemplate);')
rep('"luckyDraw.v3"', '"luckyDraw.offline.v3"')
out = head + src + '\n</body>\n</html>\n'
open(sys.argv[2], 'w').write(out)
print(len(out))
