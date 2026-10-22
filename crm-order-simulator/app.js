(function () {
  'use strict';

  const STORAGE_KEY = 'crm-order-sim-v1';
  const SEED = window.SEED_DATA;
  const STAGES = ['Draft', 'Submitted', 'Activated'];

  // ---------- State ----------

  function freshState() {
    return {
      user: null,
      accounts: clone(SEED.accounts),
      products: clone(SEED.products),
      orders: [],
      seq: 100,
      progress: {}
    };
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign(freshState(), JSON.parse(raw));
    } catch (e) { /* storage unavailable; fall back to in-memory */ }
    return freshState();
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function mark(step) {
    if (!state.progress[step]) {
      state.progress[step] = true;
      save();
      const task = TASKS.find(t => t.id === step);
      if (task) toast('Training step complete: ' + task.label, 'info');
    }
  }

  // ---------- Helpers ----------

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function money(n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function today() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function fmtDate(s) { if (!s) return ''; const [y, m, d] = s.split('-'); return `${m}/${d}/${y}`; }
  function fmtTime(ts) { return new Date(ts).toLocaleString(); }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function account(id) { return state.accounts.find(a => a.id === id); }
  function product(id) { return state.products.find(p => p.id === id); }
  function order(id) { return state.orders.find(o => o.id === id); }

  function lineTotal(li) { return li.qty * li.unitPrice * (1 - (li.discount || 0) / 100); }
  function orderTotal(o) { return o.items.reduce((s, li) => s + lineTotal(li), 0); }
  function needsApproval(o) {
    return orderTotal(o) > SEED.approvalThreshold || o.items.some(li => (li.discount || 0) > SEED.maxDiscount);
  }
  function log(o, text) { o.history.unshift({ at: Date.now(), by: state.user, text }); }

  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'success');
    el.textContent = msg;
    $('#toastRoot').appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  // ---------- Training tasks ----------

  const TASKS = [
    { id: 'login', label: 'Log in to the sandbox' },
    { id: 'openAccount', label: 'Open an account record' },
    { id: 'createOrder', label: 'Create a new draft order' },
    { id: 'addProducts', label: 'Add at least two products to an order' },
    { id: 'editLine', label: 'Edit an order product (quantity or discount)' },
    { id: 'validation', label: 'Trigger and read a validation error on submit' },
    { id: 'submitOrder', label: 'Submit an order successfully' },
    { id: 'approval', label: 'Submit an order that needs approval and get it approved' },
    { id: 'activated', label: 'See an order reach Activated status' }
  ];

  // ---------- Modal ----------

  function openModal({ title, body, footer, wide, onMount }) {
    const root = $('#modalRoot');
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="modal-header"><h2>${esc(title)}</h2><button class="modal-close" data-close aria-label="Close">&times;</button></div>
          <div class="modal-body">${body}</div>
          <div class="modal-footer">${footer}</div>
        </div>
      </div>`;
    $$('[data-close]', root).forEach(b => b.addEventListener('click', closeModal));
    root.querySelector('.modal-backdrop').addEventListener('mousedown', e => { if (e.target.classList.contains('modal-backdrop')) closeModal(); });
    if (onMount) onMount(root);
    const first = root.querySelector('input:not([readonly]), select, textarea');
    if (first) first.focus();
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  function confirmDialog(title, message, okLabel, onOk) {
    openModal({
      title,
      body: `<p>${message}</p>`,
      footer: `<button class="btn" data-close>Cancel</button><button class="btn brand" id="confirmOk">${esc(okLabel)}</button>`,
      onMount: root => $('#confirmOk', root).addEventListener('click', () => { closeModal(); onOk(); })
    });
  }

  // ---------- Router ----------

  function route() {
    if (!state.user) { showLogin(); return; }
    $('#loginView').hidden = true;
    $('#appView').hidden = false;
    $('#userName').textContent = state.user;

    const parts = (currentPath || 'home').split('/');
    const [page, id] = parts;
    $$('#tabs a').forEach(a => a.classList.toggle('active', a.dataset.tab === page));
    const main = $('#main');
    closeModal();

    if (page === 'accounts' && id) renderAccount(main, id);
    else if (page === 'accounts') renderAccounts(main);
    else if (page === 'products') renderProducts(main);
    else if (page === 'orders' && id) renderOrder(main, id);
    else if (page === 'orders') renderOrders(main);
    else if (page === 'guide') renderGuide(main);
    else renderHome(main);
    window.scrollTo(0, 0);
  }
  // In-page navigation: links use href="#/page/id" but are handled here so
  // routing doesn't depend on the URL hash (hosted viewers may not expose it).
  let currentPath = 'home';
  function go(path) { currentPath = path.replace(/^#\/?/, ''); route(); }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#/"]');
    if (a) { e.preventDefault(); go(a.getAttribute('href')); }
  });

  // ---------- Login ----------

  function showLogin() {
    $('#appView').hidden = true;
    $('#loginView').hidden = false;
    $('#loginName').focus();
  }

  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#loginName').value.trim();
    if (!name) return;
    state.user = name;
    save();
    mark('login');
    go('home');
  });

  $('#logoutBtn').addEventListener('click', () => { state.user = null; save(); go('home'); });

  $('#resetBtn').addEventListener('click', () => {
    confirmDialog('Reset Sandbox', 'This deletes all practice orders and training progress in this browser. Continue?', 'Reset', () => {
      const user = state.user;
      state = freshState();
      state.user = user;
      if (user) state.progress.login = true;
      save();
      toast('Sandbox data has been reset.');
      go('home');
    });
  });

  // ---------- Home ----------

  function renderHome(main) {
    const done = TASKS.filter(t => state.progress[t.id]).length;
    const pct = Math.round(done / TASKS.length * 100);
    const mine = state.orders.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    main.innerHTML = `
      <div class="page-header">
        <div class="title-group">
          <div class="icon-box" style="background:#3ba755">&#10003;</div>
          <div><div class="eyebrow">Welcome</div><h1>Hi ${esc(state.user)}, ready to practice?</h1></div>
        </div>
        <div class="actions"><button class="btn brand" id="homeNewOrder">New Order</button><a class="btn" href="#/guide">Open Training Guide</a></div>
      </div>
      <div class="layout-2">
        <div>
          <div class="card">
            <div class="card-header"><h2>Recent Orders</h2><a href="#/orders">View All</a></div>
            ${mine.length ? ordersTable(mine) : '<div class="empty">No orders yet. Click <b>New Order</b> to create your first one.</div>'}
          </div>
          <div class="card"><div class="card-body tip" style="margin:0">
            <strong>Training tip:</strong> Practice exactly like you would in the live system. Orders over ${money(SEED.approvalThreshold)}
            or with a line discount above ${SEED.maxDiscount}% are routed for manager approval after you submit.
          </div></div>
        </div>
        <div class="card">
          <div class="card-header"><h2>Onboarding Checklist</h2><span class="muted">${done}/${TASKS.length}</span></div>
          <div class="card-body">
            <div class="progress"><div style="width:${pct}%"></div></div>
            <div class="muted" style="font-size:12px;margin-bottom:8px">${pct}% complete</div>
            <ul class="checklist">
              ${TASKS.map(t => `<li class="${state.progress[t.id] ? 'done' : ''}"><span class="tick">${state.progress[t.id] ? '&#10003;' : ''}</span><span class="label">${esc(t.label)}</span></li>`).join('')}
            </ul>
          </div>
        </div>
      </div>`;
    $('#homeNewOrder').addEventListener('click', () => newOrderModal());
  }

  // ---------- Accounts ----------

  function renderAccounts(main) {
    main.innerHTML = `
      <div class="page-header">
        <div class="title-group"><div class="icon-box" style="background:#5867e8">AC</div>
          <div><div class="eyebrow">Accounts</div><h1>All Accounts</h1></div></div>
        <div class="toolbar"><input type="search" id="accSearch" placeholder="Search this list..."></div>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Account Name</th><th>Account Number</th><th>Industry</th><th>Phone</th><th>Status</th><th>Owner</th></tr></thead>
        <tbody id="accRows"></tbody></table></div></div>`;
    const draw = () => {
      const q = $('#accSearch').value.toLowerCase();
      const rows = state.accounts.filter(a => (a.name + a.number + a.industry).toLowerCase().includes(q));
      $('#accRows').innerHTML = rows.map(a => `<tr>
        <td><a href="#/accounts/${a.id}">${esc(a.name)}</a></td><td>${esc(a.number)}</td><td>${esc(a.industry)}</td>
        <td>${esc(a.phone)}</td><td><span class="badge ${esc(a.status)}">${esc(a.status)}</span></td><td>${esc(a.owner)}</td></tr>`).join('')
        || '<tr><td colspan="6" class="empty">No matching accounts.</td></tr>';
    };
    $('#accSearch').addEventListener('input', draw);
    draw();
  }

  function renderAccount(main, id) {
    const a = account(id);
    if (!a) { main.innerHTML = '<div class="card empty">Account not found.</div>'; return; }
    mark('openAccount');
    const orders = state.orders.filter(o => o.accountId === id);
    main.innerHTML = `
      <div class="page-header">
        <div class="title-group"><div class="icon-box" style="background:#5867e8">AC</div>
          <div><div class="eyebrow">Account</div><h1>${esc(a.name)}</h1></div></div>
        <div class="actions"><button class="btn brand" id="accNewOrder">New Order</button></div>
        <div class="highlights">
          <div><span>Account Number</span>${esc(a.number)}</div><div><span>Industry</span>${esc(a.industry)}</div>
          <div><span>Phone</span>${esc(a.phone)}</div><div><span>Status</span><span class="badge ${esc(a.status)}">${esc(a.status)}</span></div>
        </div>
      </div>
      <div class="layout-2">
        <div class="card"><div class="card-header"><h2>Details</h2></div><div class="card-body field-grid">
          <div class="field"><span>Account Owner</span>${esc(a.owner)}</div>
          <div class="field"><span>Account Status</span>${esc(a.status)}</div>
          <div class="field"><span>Billing Address</span>${esc(a.billing) || '&mdash;'}</div>
          <div class="field"><span>Shipping Address</span>${esc(a.shipping) || '<span class="muted">Not provided</span>'}</div>
        </div></div>
        <div class="card"><div class="card-header"><h2>Orders (${orders.length})</h2></div>
          ${orders.length ? `<ul class="timeline" style="padding:8px 16px">${orders.map(o => `<li><a href="#/orders/${o.id}">${esc(o.number)}</a> &middot; <span class="badge ${o.status}">${o.status}</span><time>${money(orderTotal(o))} &middot; Start ${fmtDate(o.startDate)}</time></li>`).join('')}</ul>` : '<div class="empty">No orders for this account.</div>'}
        </div>
      </div>`;
    $('#accNewOrder').addEventListener('click', () => newOrderModal(a.id));
  }

  // ---------- Products ----------

  function renderProducts(main) {
    main.innerHTML = `
      <div class="page-header">
        <div class="title-group"><div class="icon-box" style="background:#ea7600">PR</div>
          <div><div class="eyebrow">Products</div><h1>Standard Price Book</h1></div></div>
      </div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Product Name</th><th>Product Code</th><th>Family</th><th class="num">List Price</th><th>Active</th></tr></thead>
        <tbody>${state.products.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.code)}</td><td>${esc(p.family)}</td>
          <td class="num">${money(p.price)}</td><td><span class="badge ${p.active ? 'Active' : 'Inactive'}">${p.active ? 'Active' : 'Inactive'}</span></td></tr>`).join('')}</tbody>
      </table></div></div>`;
  }

  // ---------- Orders list ----------

  function ordersTable(list) {
    return `<div class="table-wrap"><table>
      <thead><tr><th>Order Number</th><th>Account Name</th><th>Start Date</th><th>Status</th><th class="num">Amount</th><th>Owner</th></tr></thead>
      <tbody>${list.map(o => `<tr>
        <td><a href="#/orders/${o.id}">${esc(o.number)}</a></td><td>${esc(account(o.accountId).name)}</td><td>${fmtDate(o.startDate)}</td>
        <td><span class="badge ${o.status}">${o.status}</span>${o.approval === 'Pending' ? ' <span class="badge Pending">Approval Pending</span>' : ''}</td>
        <td class="num">${money(orderTotal(o))}</td><td>${esc(o.owner)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderOrders(main) {
    main.innerHTML = `
      <div class="page-header">
        <div class="title-group"><div class="icon-box" style="background:#06a59a">OR</div>
          <div><div class="eyebrow">Orders</div><h1>All Orders</h1></div></div>
        <div class="toolbar">
          <select id="ordFilter"><option value="">All statuses</option>${STAGES.map(s => `<option>${s}</option>`).join('')}</select>
          <input type="search" id="ordSearch" placeholder="Search order or account...">
          <button class="btn brand" id="ordNew">New</button>
        </div>
      </div>
      <div class="card" id="ordList"></div>`;
    const draw = () => {
      const f = $('#ordFilter').value, q = $('#ordSearch').value.toLowerCase();
      const list = state.orders.filter(o => (!f || o.status === f) && (o.number + account(o.accountId).name).toLowerCase().includes(q))
        .sort((a, b) => b.createdAt - a.createdAt);
      $('#ordList').innerHTML = list.length ? ordersTable(list) : '<div class="empty">No orders to display.</div>';
    };
    $('#ordFilter').addEventListener('change', draw);
    $('#ordSearch').addEventListener('input', draw);
    $('#ordNew').addEventListener('click', () => newOrderModal());
    draw();
  }

  // ---------- New / edit order ----------

  function accountLookup(root, initialId) {
    const input = $('#fAccount', root), list = $('#fAccountList', root), hidden = $('#fAccountId', root);
    let hl = -1, matches = [];
    const set = a => {
      hidden.value = a ? a.id : '';
      input.value = a ? a.name : '';
      list.hidden = true;
      if (a) {
        $('#fBilling', root).value = a.billing || '';
        $('#fShipping', root).value = a.shipping || '';
      }
    };
    if (input.readOnly) { set(account(initialId)); return; }
    const draw = () => {
      const q = input.value.toLowerCase();
      matches = state.accounts.filter(a => a.name.toLowerCase().includes(q));
      hl = -1;
      list.innerHTML = matches.map((a, i) => `<li data-i="${i}">${esc(a.name)}<small>${esc(a.number)} &middot; ${esc(a.status)}</small></li>`).join('')
        || '<li class="muted">No results</li>';
      list.hidden = false;
    };
    input.addEventListener('focus', draw);
    input.addEventListener('input', () => { hidden.value = ''; draw(); });
    input.addEventListener('keydown', e => {
      if (list.hidden) return;
      const items = $$('li[data-i]', list);
      if (e.key === 'ArrowDown') { hl = Math.min(hl + 1, items.length - 1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { hl = Math.max(hl - 1, 0); e.preventDefault(); }
      else if (e.key === 'Enter' && hl >= 0) { set(matches[hl]); e.preventDefault(); return; }
      items.forEach((li, i) => li.classList.toggle('hl', i === hl));
    });
    list.addEventListener('mousedown', e => { const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); set(matches[+li.dataset.i]); } });
    input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 150));
    if (initialId) set(account(initialId));
  }

  function newOrderModal(accountId, existing) {
    const o = existing || {};
    const isEdit = !!existing;
    openModal({
      title: isEdit ? 'Edit ' + o.number : 'New Order',
      body: `
        ${isEdit ? '' : '<div class="tip"><strong>Step 1 of 3:</strong> Fill in the order header. You will add products on the next screen, then submit.</div>'}
        <div id="formErrors"></div>
        <form id="orderForm" class="form-grid" novalidate>
          <div class="section-title">Order Information</div>
          <label class="lookup" data-field="accountId"><span><span class="req">*</span> Account Name</span>
            <input id="fAccount" placeholder="Search Accounts..." autocomplete="off" ${isEdit ? 'readonly' : ''}>
            <input type="hidden" id="fAccountId">
            <ul class="lookup-list" id="fAccountList" hidden></ul>
          </label>
          <label><span>Price Book</span><input value="Standard Price Book" readonly></label>
          <label data-field="startDate"><span><span class="req">*</span> Order Start Date</span><input type="date" id="fStart" value="${esc(o.startDate || today())}"></label>
          <label><span><span class="req">*</span> Status</span><input value="Draft" readonly></label>
          <label data-field="type"><span>Order Type</span>
            <select id="fType">${['New', 'Add-On', 'Renewal'].map(t => `<option ${o.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label data-field="poNumber"><span>PO Number</span><input id="fPo" maxlength="20" value="${esc(o.poNumber || '')}" placeholder="Customer purchase order #"></label>
          <label data-field="contact"><span>Customer Contact</span><input id="fContact" value="${esc(o.contact || '')}" placeholder="Name of the person who placed the order"></label>
          <label><span>Order Owner</span><input value="${esc(o.owner || state.user)}" readonly></label>
          <div class="section-title">Address Information</div>
          <label class="span-2" data-field="billing"><span><span class="req">*</span> Billing Address</span><textarea id="fBilling" rows="2">${esc(o.billing || '')}</textarea></label>
          <label class="span-2" data-field="shipping"><span>Shipping Address</span><textarea id="fShipping" rows="2">${esc(o.shipping || '')}</textarea></label>
          <div class="section-title">Description</div>
          <label class="span-2"><span>Description / Special Instructions</span><textarea id="fDesc" rows="2">${esc(o.description || '')}</textarea></label>
        </form>`,
      footer: `<button class="btn" data-close>Cancel</button><button class="btn brand" id="saveOrder">Save</button>`,
      onMount: root => {
        accountLookup(root, accountId || o.accountId);
        if (isEdit) { $('#fBilling', root).value = o.billing || ''; $('#fShipping', root).value = o.shipping || ''; }
        $('#saveOrder', root).addEventListener('click', () => saveOrderHeader(root, existing));
      }
    });
  }

  function showErrors(root, errors) {
    $$('[data-field]', root).forEach(el => { el.classList.remove('has-error'); const m = el.querySelector('.field-error'); if (m) m.remove(); });
    const box = $('#formErrors', root);
    if (!errors.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="error-box"><strong>We hit a snag.</strong> Review the following fields:<ul>${errors.map(e => `<li>${esc(e.msg)}</li>`).join('')}</ul></div>`;
    errors.forEach(e => {
      const el = e.field && root.querySelector(`[data-field="${e.field}"]`);
      if (el) { el.classList.add('has-error'); el.insertAdjacentHTML('beforeend', `<span class="field-error">${esc(e.msg)}</span>`); }
    });
    box.scrollIntoView({ block: 'nearest' });
  }

  function saveOrderHeader(root, existing) {
    const data = {
      accountId: $('#fAccountId', root).value,
      startDate: $('#fStart', root).value,
      type: $('#fType', root).value,
      poNumber: $('#fPo', root).value.trim(),
      contact: $('#fContact', root).value.trim(),
      billing: $('#fBilling', root).value.trim(),
      shipping: $('#fShipping', root).value.trim(),
      description: $('#fDesc', root).value.trim()
    };
    const errors = [];
    const acc = account(data.accountId);
    if (!acc) errors.push({ field: 'accountId', msg: 'Account Name: Select an account from the lookup list.' });
    else if (acc.status !== 'Active') errors.push({ field: 'accountId', msg: `Account "${acc.name}" is ${acc.status}. Orders can only be created for Active accounts.` });
    if (!data.startDate) errors.push({ field: 'startDate', msg: 'Order Start Date: Complete this field.' });
    else if (!existing && data.startDate < today()) errors.push({ field: 'startDate', msg: 'Order Start Date cannot be in the past.' });
    if (!data.billing) errors.push({ field: 'billing', msg: 'Billing Address: Complete this field.' });
    if (data.poNumber && !/^[A-Za-z0-9-]+$/.test(data.poNumber)) errors.push({ field: 'poNumber', msg: 'PO Number may contain only letters, numbers and dashes.' });
    showErrors(root, errors);
    if (errors.length) return;

    if (existing) {
      Object.assign(existing, data);
      log(existing, 'Edited order header.');
      save();
      closeModal();
      toast(`Order "${existing.number}" was saved.`);
      route();
      return;
    }
    const o = Object.assign(data, {
      id: uid(), number: String(++state.seq).padStart(8, '0'), status: 'Draft', approval: null,
      owner: state.user, items: [], history: [], createdAt: Date.now()
    });
    log(o, 'Created order in Draft status.');
    state.orders.push(o);
    save();
    mark('createOrder');
    closeModal();
    toast(`Order "${o.number}" was created.`);
    go('orders/' + o.id);
  }

  // ---------- Order detail ----------

  function renderOrder(main, id) {
    const o = order(id);
    if (!o) { main.innerHTML = '<div class="card empty">Order not found.</div>'; return; }
    const a = account(o.accountId);
    const locked = o.status !== 'Draft';
    const idx = STAGES.indexOf(o.status);
    const total = orderTotal(o);

    let actions = '';
    if (o.status === 'Draft') {
      actions = `<button class="btn" id="btnEdit">Edit</button><button class="btn danger" id="btnDelete">Delete</button>
        <button class="btn brand" id="btnSubmit">Submit Order</button>`;
    } else if (o.approval === 'Pending') {
      actions = `<button class="btn" id="btnRecall">Recall</button>
        <button class="btn success" id="btnApprove" title="Trainer shortcut: acts as the approving manager">Simulate Manager Approval</button>
        <button class="btn danger" id="btnReject" title="Trainer shortcut: acts as the approving manager">Simulate Rejection</button>`;
    }

    let banner = '';
    if (o.status === 'Draft' && !o.items.length) banner = '<div class="tip"><strong>Step 2 of 3:</strong> Add products to this order using <b>Add Products</b> in the Order Products list below.</div>';
    else if (o.status === 'Draft') banner = '<div class="tip"><strong>Step 3 of 3:</strong> Review the products and totals, then click <b>Submit Order</b>.</div>';
    else if (o.approval === 'Pending') banner = `<div class="tip"><strong>Awaiting approval.</strong> This order needs manager approval because ${approvalReason(o)}. In the live system your manager receives it; here you can simulate their decision.</div>`;
    else if (o.status === 'Activated') banner = '<div class="tip"><strong>Done!</strong> This order is Activated and has been sent to fulfillment. Activated orders are read-only.</div>';
    if (o.rejection && o.status === 'Draft') banner = `<div class="error-box"><strong>Rejected by manager:</strong> ${esc(o.rejection)} Fix the order and submit again.</div>` + banner;

    main.innerHTML = `
      <div class="page-header">
        <div class="title-group"><div class="icon-box" style="background:#06a59a">OR</div>
          <div><div class="eyebrow">Order</div><h1>${esc(o.number)}</h1></div></div>
        <div class="actions">${actions}</div>
        <div class="highlights">
          <div><span>Account Name</span><a href="#/accounts/${a.id}">${esc(a.name)}</a></div>
          <div><span>Order Start Date</span>${fmtDate(o.startDate)}</div>
          <div><span>Status</span><span class="badge ${o.status}">${o.status}</span></div>
          <div><span>Order Amount</span>${money(total)}</div>
          <div><span>Order Owner</span>${esc(o.owner)}</div>
        </div>
      </div>
      <ol class="path" style="padding:0">${STAGES.map((s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'current' : ''}">${i < idx ? '&#10003; ' : ''}${s}</li>`).join('')}</ol>
      ${banner}
      <div class="layout-2">
        <div>
          <div class="card">
            <div class="card-header"><h2>Order Products (${o.items.length})</h2>
              ${locked ? '<span class="muted">Locked</span>' : '<button class="btn" id="btnAddProducts">Add Products</button>'}</div>
            ${o.items.length ? `<div class="table-wrap"><table>
              <thead><tr><th>Product</th><th>Code</th><th class="num">Quantity</th><th class="num">Unit Price</th><th class="num">Discount</th><th class="num">Total Price</th>${locked ? '' : '<th></th>'}</tr></thead>
              <tbody>${o.items.map(li => { const p = product(li.productId); return `<tr>
                <td>${esc(p.name)}</td><td>${esc(p.code)}</td><td class="num">${li.qty}</td><td class="num">${money(li.unitPrice)}</td>
                <td class="num">${li.discount ? li.discount + '%' : '&mdash;'}</td><td class="num">${money(lineTotal(li))}</td>
                ${locked ? '' : `<td><button class="btn small" data-edit="${li.id}">Edit</button> <button class="btn small danger" data-del="${li.id}">Delete</button></td>`}</tr>`; }).join('')}</tbody>
            </table></div>
            <div class="totals"><span>Total Quantity: <strong>${o.items.reduce((s, li) => s + li.qty, 0)}</strong></span><span>Order Amount: <strong>${money(total)}</strong></span></div>`
            : '<div class="empty">No products yet.</div>'}
          </div>
          <div class="card"><div class="card-header"><h2>Details</h2></div><div class="card-body field-grid">
            <div class="field"><span>Order Number</span>${esc(o.number)}</div>
            <div class="field"><span>Order Type</span>${esc(o.type)}</div>
            <div class="field"><span>PO Number</span>${esc(o.poNumber) || '&mdash;'}</div>
            <div class="field"><span>Customer Contact</span>${esc(o.contact) || '&mdash;'}</div>
            <div class="field"><span>Price Book</span>Standard Price Book</div>
            <div class="field"><span>Approval Status</span>${esc(o.approval || 'Not required')}</div>
            <div class="field"><span>Billing Address</span>${esc(o.billing) || '&mdash;'}</div>
            <div class="field"><span>Shipping Address</span>${esc(o.shipping) || '<span class="muted">Not provided</span>'}</div>
            <div class="field" style="grid-column:1/-1"><span>Description</span>${esc(o.description) || '&mdash;'}</div>
          </div></div>
        </div>
        <div class="card"><div class="card-header"><h2>Activity History</h2></div>
          <ul class="timeline" style="padding:8px 16px">${o.history.map(h => `<li>${esc(h.text)}<time>${fmtTime(h.at)} &middot; ${esc(h.by)}</time></li>`).join('')}</ul>
        </div>
      </div>`;

    const on = (sel, fn) => { const el = $(sel, main); if (el) el.addEventListener('click', fn); };
    on('#btnEdit', () => newOrderModal(null, o));
    on('#btnDelete', () => confirmDialog('Delete Order', `Are you sure you want to delete order ${esc(o.number)}?`, 'Delete', () => {
      state.orders = state.orders.filter(x => x !== o); save(); toast(`Order "${o.number}" was deleted.`); go('orders');
    }));
    on('#btnAddProducts', () => addProductsModal(o));
    on('#btnSubmit', () => submitOrder(o));
    on('#btnRecall', () => confirmDialog('Recall Approval Request', 'Recall this order back to Draft so you can make changes?', 'Recall', () => {
      o.status = 'Draft'; o.approval = 'Recalled'; log(o, 'Recalled approval request. Order returned to Draft.'); save(); toast('Approval request recalled.'); route();
    }));
    on('#btnApprove', () => {
      o.approval = 'Approved'; log(o, 'Manager approved the order (simulated).'); mark('approval'); activate(o);
    });
    on('#btnReject', () => rejectModal(o));
    $$('[data-edit]', main).forEach(b => b.addEventListener('click', () => editLineModal(o, b.dataset.edit)));
    $$('[data-del]', main).forEach(b => b.addEventListener('click', () => {
      const li = o.items.find(x => x.id === b.dataset.del);
      confirmDialog('Delete Order Product', `Remove ${esc(product(li.productId).name)} from this order?`, 'Delete', () => {
        o.items = o.items.filter(x => x !== li); log(o, `Removed product ${product(li.productId).name}.`); save(); toast('Order product deleted.'); route();
      });
    }));
  }

  function approvalReason(o) {
    const r = [];
    if (orderTotal(o) > SEED.approvalThreshold) r.push(`the order amount exceeds ${money(SEED.approvalThreshold)}`);
    if (o.items.some(li => (li.discount || 0) > SEED.maxDiscount)) r.push(`a line discount is above ${SEED.maxDiscount}%`);
    return r.join(' and ');
  }

  // ---------- Products on an order ----------

  function addProductsModal(o) {
    const active = state.products.filter(p => p.active);
    openModal({
      title: 'Add Products',
      wide: true,
      body: `
        <div class="tip"><strong>Select products</strong> from the Standard Price Book, then click <b>Next</b> to set quantities. Inactive products are not shown.</div>
        <div class="toolbar" style="margin-bottom:8px"><input type="search" id="prodSearch" placeholder="Search products..."><span class="muted" id="selCount">0 selected</span></div>
        <div class="table-wrap"><table><thead><tr><th></th><th>Product Name</th><th>Product Code</th><th>Family</th><th class="num">List Price</th></tr></thead>
        <tbody id="prodRows">${active.map(p => `<tr data-name="${esc((p.name + p.code + p.family).toLowerCase())}">
          <td><input type="checkbox" value="${p.id}" aria-label="Select ${esc(p.name)}" style="width:auto"></td>
          <td>${esc(p.name)}</td><td>${esc(p.code)}</td><td>${esc(p.family)}</td><td class="num">${money(p.price)}</td></tr>`).join('')}</tbody></table></div>`,
      footer: `<button class="btn" data-close>Cancel</button><button class="btn brand" id="prodNext" disabled>Next</button>`,
      onMount: root => {
        const boxes = $$('input[type=checkbox]', root);
        const upd = () => { const n = boxes.filter(b => b.checked).length; $('#selCount', root).textContent = n + ' selected'; $('#prodNext', root).disabled = !n; };
        boxes.forEach(b => b.addEventListener('change', upd));
        $('#prodSearch', root).addEventListener('input', e => {
          const q = e.target.value.toLowerCase();
          $$('#prodRows tr', root).forEach(tr => { tr.hidden = !tr.dataset.name.includes(q); });
        });
        $('#prodNext', root).addEventListener('click', () => quantitiesModal(o, boxes.filter(b => b.checked).map(b => b.value)));
      }
    });
  }

  function lineFields(p, li, i) {
    return `<tr data-row="${i}">
      <td>${esc(p.name)}<br><small class="muted">${esc(p.code)}</small></td>
      <td class="num">${money(p.price)}</td>
      <td data-field="qty${i}"><input type="number" min="1" step="1" class="q" value="${li ? li.qty : 1}" style="width:90px" aria-label="Quantity"></td>
      <td data-field="disc${i}"><input type="number" min="0" max="100" step="0.5" class="d" value="${li ? li.discount || 0 : 0}" style="width:90px" aria-label="Discount percent"></td>
      <td class="num lt"></td></tr>`;
  }

  function readLines(root, prices) {
    const errors = [], lines = [];
    $$('tr[data-row]', root).forEach((tr, i) => {
      const qty = Number($('.q', tr).value), disc = Number($('.d', tr).value || 0);
      if (!Number.isInteger(qty) || qty < 1) errors.push({ field: 'qty' + i, msg: 'Quantity must be a whole number of at least 1.' });
      if (disc < 0 || disc > 50) errors.push({ field: 'disc' + i, msg: 'Discount must be between 0% and 50%.' });
      lines.push({ qty, discount: disc });
      $('.lt', tr).textContent = money((qty > 0 ? qty : 0) * prices[i] * (1 - Math.min(Math.max(disc, 0), 100) / 100));
    });
    return { errors, lines };
  }

  function quantitiesModal(o, ids) {
    const prods = ids.map(product);
    openModal({
      title: 'Edit Selected Order Products',
      wide: true,
      body: `<div class="tip">Enter a quantity for each product. Discounts above ${SEED.maxDiscount}% will require manager approval.</div>
        <div id="formErrors"></div>
        <div class="table-wrap"><table><thead><tr><th>Product</th><th class="num">List Price</th><th>Quantity <span class="req">*</span></th><th>Discount %</th><th class="num">Total</th></tr></thead>
        <tbody>${prods.map((p, i) => lineFields(p, null, i)).join('')}</tbody></table></div>`,
      footer: `<button class="btn" id="qBack">Back</button><button class="btn brand" id="qSave">Save</button>`,
      onMount: root => {
        const prices = prods.map(p => p.price);
        root.addEventListener('input', () => readLines(root, prices));
        readLines(root, prices);
        $('#qBack', root).addEventListener('click', () => addProductsModal(o));
        $('#qSave', root).addEventListener('click', () => {
          const { errors, lines } = readLines(root, prices);
          showErrors(root, errors);
          if (errors.length) return;
          prods.forEach((p, i) => {
            const existing = o.items.find(li => li.productId === p.id);
            if (existing) { existing.qty += lines[i].qty; existing.discount = lines[i].discount; }
            else o.items.push({ id: uid(), productId: p.id, qty: lines[i].qty, unitPrice: p.price, discount: lines[i].discount });
          });
          log(o, `Added ${prods.length} product(s): ${prods.map(p => p.name).join(', ')}.`);
          if (o.items.length >= 2) mark('addProducts');
          save(); closeModal(); toast(`${prods.length} order product(s) saved.`); route();
        });
      }
    });
  }

  function editLineModal(o, lineId) {
    const li = o.items.find(x => x.id === lineId), p = product(li.productId);
    openModal({
      title: 'Edit ' + p.name,
      body: `<div id="formErrors"></div><div class="table-wrap"><table><thead><tr><th>Product</th><th class="num">List Price</th><th>Quantity <span class="req">*</span></th><th>Discount %</th><th class="num">Total</th></tr></thead>
        <tbody>${lineFields(p, li, 0)}</tbody></table></div>`,
      footer: `<button class="btn" data-close>Cancel</button><button class="btn brand" id="lSave">Save</button>`,
      onMount: root => {
        root.addEventListener('input', () => readLines(root, [li.unitPrice]));
        readLines(root, [li.unitPrice]);
        $('#lSave', root).addEventListener('click', () => {
          const { errors, lines } = readLines(root, [li.unitPrice]);
          showErrors(root, errors);
          if (errors.length) return;
          li.qty = lines[0].qty; li.discount = lines[0].discount;
          log(o, `Updated ${p.name}: quantity ${li.qty}, discount ${li.discount}%.`);
          mark('editLine'); save(); closeModal(); toast('Order product saved.'); route();
        });
      }
    });
  }

  // ---------- Submit / approval ----------

  function submitValidation(o) {
    const errors = [];
    const a = account(o.accountId);
    if (!o.items.length) errors.push('Add at least one product before submitting the order.');
    if (!o.shipping) errors.push('Shipping Address is required to submit an order. Edit the order and add one.');
    if (!o.poNumber) errors.push('PO Number is required to submit an order. Edit the order and enter the customer PO.');
    if (o.startDate < today()) errors.push('Order Start Date is in the past. Edit the order and choose today or a future date.');
    if (a.status !== 'Active') errors.push(`Account is ${a.status}; orders can only be submitted for Active accounts.`);
    return errors;
  }

  function submitOrder(o) {
    const errors = submitValidation(o);
    if (errors.length) {
      mark('validation');
      openModal({
        title: 'Unable to Submit Order',
        body: `<div class="error-box"><strong>Fix these issues, then submit again:</strong><ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`,
        footer: `<button class="btn brand" data-close>OK</button>`
      });
      return;
    }
    const approval = needsApproval(o);
    confirmDialog('Submit Order',
      `Submit order <b>${esc(o.number)}</b> for <b>${money(orderTotal(o))}</b>? After submitting you can no longer edit it.` +
      (approval ? `<br><br><span class="badge Pending">Approval required</span> This order will be sent for manager approval because ${approvalReason(o)}.` : ''),
      'Submit', () => {
        o.status = 'Submitted';
        o.rejection = null;
        o.submittedAt = Date.now();
        log(o, 'Submitted order.');
        mark('submitOrder');
        if (approval) {
          o.approval = 'Pending';
          log(o, 'Order sent for manager approval.');
          save(); toast(`Order "${o.number}" was submitted for approval.`); route();
        } else {
          o.approval = 'Not required';
          save(); toast(`Order "${o.number}" was submitted.`); route();
          setTimeout(() => activate(o), 2000);
        }
      });
  }

  function activate(o) {
    if (!order(o.id) || o.status !== 'Submitted') return;
    o.status = 'Activated';
    log(o, 'Order activated and sent to fulfillment.');
    mark('activated');
    save();
    toast(`Order "${o.number}" is now Activated.`);
    if (currentPath === 'orders/' + o.id) route();
  }

  function rejectModal(o) {
    openModal({
      title: 'Simulate Manager Rejection',
      body: `<div id="formErrors"></div><label data-field="reason"><span><span class="req">*</span> Rejection comment</span>
        <textarea id="rReason" rows="3">Discount too high. Please reduce to ${SEED.maxDiscount}% or less.</textarea></label>`,
      footer: `<button class="btn" data-close>Cancel</button><button class="btn danger" id="rOk">Reject</button>`,
      onMount: root => $('#rOk', root).addEventListener('click', () => {
        const reason = $('#rReason', root).value.trim();
        if (!reason) { showErrors(root, [{ field: 'reason', msg: 'Enter a rejection comment.' }]); return; }
        o.status = 'Draft'; o.approval = 'Rejected'; o.rejection = reason;
        log(o, 'Manager rejected the order (simulated): ' + reason);
        save(); closeModal(); toast('Order rejected and returned to Draft.', 'error'); route();
      })
    });
  }

  // ---------- Guide ----------

  function renderGuide(main) {
    main.innerHTML = `
      <div class="page-header"><div class="title-group"><div class="icon-box" style="background:#3ba755">?</div>
        <div><div class="eyebrow">Training</div><h1>Order Creation &amp; Submission Guide</h1></div></div></div>
      <div class="card"><div class="card-body guide">
        <h3>Part 1 &mdash; Create the order</h3>
        <ol>
          <li>Go to <b>Accounts</b> and open the customer, then click <b>New Order</b> (or use <b>Orders &rarr; New</b>).</li>
          <li>Search for and select the <b>Account Name</b>. Billing and shipping addresses copy from the account.</li>
          <li>Set the <b>Order Start Date</b> (today or later), <b>Order Type</b>, and the customer's <b>PO Number</b>.</li>
          <li>Click <b>Save</b>. The order is created in <span class="badge Draft">Draft</span> status.</li>
        </ol>
        <h3>Part 2 &mdash; Add products</h3>
        <ol>
          <li>In the <b>Order Products</b> list click <b>Add Products</b>.</li>
          <li>Tick one or more products and click <b>Next</b>.</li>
          <li>Enter a <b>Quantity</b> (whole number, 1 or more) and an optional <b>Discount %</b>, then click <b>Save</b>.</li>
          <li>Use <b>Edit</b> / <b>Delete</b> on a line to change it while the order is still Draft.</li>
        </ol>
        <h3>Part 3 &mdash; Submit the order</h3>
        <ol>
          <li>Review the products and Order Amount, then click <b>Submit Order</b>.</li>
          <li>If anything is missing you will see an error list &mdash; fix each item and submit again.</li>
          <li>Orders up to ${money(SEED.approvalThreshold)} with discounts of ${SEED.maxDiscount}% or less activate automatically.</li>
          <li>Larger orders or higher discounts go to <span class="badge Pending">Approval Pending</span>. In this sandbox use
            <b>Simulate Manager Approval</b> or <b>Simulate Rejection</b>; a rejected order returns to Draft for you to fix.</li>
        </ol>
        <h3>Business rules enforced</h3>
        <ul>
          <li>Orders can only be created and submitted for <b>Active</b> accounts.</li>
          <li>To submit: at least one product, a PO Number, a Shipping Address, and a start date that is not in the past.</li>
          <li>Line discounts are limited to 50%; above ${SEED.maxDiscount}% requires approval.</li>
          <li>Submitted and Activated orders are locked and cannot be edited.</li>
        </ul>
        <h3>Practice scenarios</h3>
        <ol>
          <li><b>Standard order:</b> Acme Manufacturing orders 5 Business Laptops and 5 Office Suite Licenses. PO <code>ACME-5521</code>.</li>
          <li><b>Missing data:</b> Create an order for Greenleaf Retail Group with no PO and try to submit. Fix the errors it reports (shipping address and PO).</li>
          <li><b>Approval:</b> Summit Health Partners orders 10 laptops, 10 monitors and 10 docking stations. Submit and approve it.</li>
          <li><b>Rejection:</b> Blue Harbor Logistics orders 3 Premium Support Plans at 30% discount. Submit, simulate rejection, reduce the discount and resubmit.</li>
          <li><b>Blocked account:</b> Try to create an order for Northwind Traders (On Hold) and read the message.</li>
        </ol>
      </div></div>`;
  }

  route();
})();
