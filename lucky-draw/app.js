(function () {
  "use strict";

  var STORAGE_KEY = "luckyDraw.v1";
  var $ = function (id) { return document.getElementById(id); };

  // participants: everyone loaded; pool: not yet drawn; winners: [{ name, round, time }]
  var state = { participants: [], pool: [], winners: [] };
  var sheetRows = null; // raw rows of the last uploaded sheet, kept for column switching
  var drawing = false;

  // ---------- Persistence ----------
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.pool) && Array.isArray(saved.winners)) state = saved;
    } catch (e) { /* ignore */ }
  }

  // ---------- Fair random ----------
  // Unbiased integer in [0, max) using the browser's cryptographic RNG.
  function randomIndex(max) {
    if (!window.crypto || !crypto.getRandomValues) return Math.floor(Math.random() * max);
    var limit = Math.floor(0x100000000 / max) * max;
    var buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  }

  // ---------- Loading names ----------
  function setStatus(msg, kind) {
    var el = $("loadStatus");
    el.textContent = msg;
    el.className = "status" + (kind ? " " + kind : "");
  }

  function cleanNames(list) {
    var names = list.map(function (n) { return String(n == null ? "" : n).trim(); })
      .filter(function (n) { return n.length > 0; });
    if ($("dedupeCheck").checked) {
      var seen = {};
      names = names.filter(function (n) {
        var key = n.toLowerCase();
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }
    return names;
  }

  function useNames(names, source) {
    if (!names.length) { setStatus("No names found in " + source + ".", "err"); return; }
    if (state.winners.length && !confirm("Loading a new list clears the current winners. Continue?")) return;
    state = { participants: names.slice(), pool: names.slice(), winners: [] };
    save();
    setStatus("Loaded " + names.length + " names from " + source + ".", "ok");
    $("reel").textContent = "Ready!";
    $("reel").classList.remove("winner");
    render();
  }

  function namesFromRows() {
    var col = Number($("columnSelect").value) || 0;
    var rows = $("headerCheck").checked ? sheetRows.slice(1) : sheetRows;
    return cleanNames(rows.map(function (r) { return r[col]; }));
  }

  function buildColumnPicker() {
    var header = sheetRows[0] || [];
    var width = sheetRows.reduce(function (w, r) { return Math.max(w, r.length); }, 0);
    var select = $("columnSelect");
    select.innerHTML = "";
    var guess = 0;
    for (var i = 0; i < width; i++) {
      var label = String(header[i] || "").trim();
      var opt = document.createElement("option");
      opt.value = i;
      opt.textContent = "Column " + XLSX.utils.encode_col(i) + (label ? " — " + label : "");
      select.appendChild(opt);
      if (/name/i.test(label) && guess === 0) guess = i;
    }
    select.value = guess;
    // Treat first row as a header only if it looks like one.
    $("headerCheck").checked = /name|participant|staff|employee|member/i.test(header.join(" "));
    $("columnPicker").hidden = width <= 1 && !$("headerCheck").checked;
  }

  function readFile(file) {
    if (!file) return;
    if (typeof XLSX === "undefined") {
      setStatus("Excel reader failed to load. Check your internet connection, or paste names instead.", "err");
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        var ws = wb.Sheets[wb.SheetNames[0]];
        sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
        buildColumnPicker();
        useNames(namesFromRows(), file.name);
      } catch (err) {
        setStatus("Could not read that file: " + err.message, "err");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ---------- Drawing ----------
  function draw() {
    if (drawing || !state.pool.length) return;
    drawing = true;
    $("drawBtn").disabled = true;
    $("undoBtn").hidden = true;

    var winnerIdx = randomIndex(state.pool.length);
    var winner = state.pool[winnerIdx];
    var reel = $("reel");
    reel.classList.remove("winner");
    reel.classList.add("spinning");

    // Cycle through names, slowing down, then land on the winner.
    var delay = 40;
    (function tick() {
      if (delay < 380) {
        reel.textContent = state.pool[randomIndex(state.pool.length)];
        delay *= 1.12;
        setTimeout(tick, delay);
        return;
      }
      state.pool.splice(winnerIdx, 1);
      state.winners.push({ name: winner, round: state.winners.length + 1, time: new Date().toISOString() });
      save();
      reel.classList.remove("spinning");
      reel.textContent = winner;
      void reel.offsetWidth; // restart pop animation
      reel.classList.add("winner");
      confetti();
      drawing = false;
      render();
      $("undoBtn").hidden = false;
    })();
  }

  function undo() {
    var last = state.winners.pop();
    if (!last) return;
    state.pool.push(last.name);
    save();
    $("reel").textContent = "Returned " + last.name + " to the pool";
    $("reel").classList.remove("winner");
    $("undoBtn").hidden = true;
    render();
  }

  // ---------- Export ----------
  function exportWinners() {
    var rows = state.winners.map(function (w) {
      return { Round: w.round, Winner: w.name, "Drawn at": new Date(w.time).toLocaleString() };
    });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Winners");
    XLSX.writeFile(wb, "lucky-draw-winners.xlsx");
  }

  function downloadTemplate() {
    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([["Name"], ["Alice Tan"], ["Ben Lee"], ["Chandra Kumar"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Participants");
    XLSX.writeFile(wb, "lucky-draw-template.xlsx");
  }

  // ---------- Rendering ----------
  function render() {
    var hasPool = state.pool.length > 0;
    $("poolCount").textContent = state.pool.length;
    $("poolCount2").textContent = state.pool.length;
    $("winnerCount").textContent = state.winners.length;
    $("drawBtn").disabled = drawing || !hasPool;
    $("drawBtn").textContent = state.winners.length ? "Draw next winner" : "Draw winner";
    $("exportBtn").disabled = !state.winners.length || typeof XLSX === "undefined";
    $("roundLabel").textContent = hasPool
      ? "Round " + (state.winners.length + 1)
      : (state.participants.length ? "All names drawn" : "Round 1");

    var list = $("winnerList");
    list.innerHTML = "";
    state.winners.slice().reverse().forEach(function (w) {
      var li = document.createElement("li");
      var num = document.createElement("span"); num.className = "num"; num.textContent = "#" + w.round;
      var name = document.createElement("span"); name.textContent = w.name;
      var time = document.createElement("span"); time.className = "time";
      time.textContent = new Date(w.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      li.append(num, name, time);
      list.appendChild(li);
    });
    $("noWinners").hidden = state.winners.length > 0;

    var pool = $("poolList");
    pool.innerHTML = "";
    state.pool.slice(0, 500).forEach(function (n) {
      var li = document.createElement("li"); li.textContent = n; pool.appendChild(li);
    });
    if (state.pool.length > 500) {
      var more = document.createElement("li");
      more.className = "muted";
      more.textContent = "…and " + (state.pool.length - 500) + " more";
      pool.appendChild(more);
    }
  }

  // ---------- Confetti ----------
  function confetti() {
    var canvas = $("confetti");
    var ctx = canvas.getContext("2d");
    canvas.width = innerWidth; canvas.height = innerHeight;
    var colors = ["#7c3aed", "#f59e0b", "#10b981", "#ef4444", "#3b82f6", "#ec4899"];
    var bits = [];
    for (var i = 0; i < 160; i++) {
      bits.push({
        x: canvas.width / 2, y: canvas.height / 3,
        vx: (Math.random() - 0.5) * 16, vy: Math.random() * -14 - 4,
        s: Math.random() * 6 + 4, r: Math.random() * 6, c: colors[i % colors.length]
      });
    }
    var frames = 0;
    (function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      bits.forEach(function (b) {
        b.vy += 0.35; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += 0.1;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r);
        ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        ctx.restore();
      });
      if (++frames < 150) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    })();
  }

  // ---------- Wiring ----------
  $("fileInput").addEventListener("change", function (e) { readFile(e.target.files[0]); e.target.value = ""; });
  var drop = $("dropZone");
  ["dragenter", "dragover"].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("over"); });
  });
  drop.addEventListener("drop", function (e) { readFile(e.dataTransfer.files[0]); });

  function reloadFromSheet() { if (sheetRows) useNames(namesFromRows(), "the selected column"); }
  $("columnSelect").addEventListener("change", reloadFromSheet);
  $("headerCheck").addEventListener("change", reloadFromSheet);

  $("pasteBtn").addEventListener("click", function () {
    useNames(cleanNames($("pasteInput").value.split(/\r?\n/)), "pasted text");
  });
  $("templateBtn").addEventListener("click", downloadTemplate);
  $("drawBtn").addEventListener("click", draw);
  $("undoBtn").addEventListener("click", undo);
  $("exportBtn").addEventListener("click", exportWinners);
  $("resetBtn").addEventListener("click", function () {
    if (!confirm("Clear all participants and winners?")) return;
    state = { participants: [], pool: [], winners: [] };
    sheetRows = null;
    $("columnPicker").hidden = true;
    $("reel").textContent = "Upload names to begin";
    $("reel").classList.remove("winner");
    $("undoBtn").hidden = true;
    setStatus("");
    save();
    render();
  });
  $("fullscreenBtn").addEventListener("click", function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  });
  document.addEventListener("keydown", function (e) {
    if (e.code === "Space" && e.target === document.body) { e.preventDefault(); draw(); }
  });

  load();
  if (state.pool.length || state.winners.length) {
    $("reel").textContent = state.winners.length ? state.winners[state.winners.length - 1].name : "Ready!";
    setStatus("Restored " + state.participants.length + " participants from your last session.", "ok");
  }
  render();
})();
