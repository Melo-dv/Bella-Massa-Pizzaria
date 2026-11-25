/* =====================================================================
   admin.js — Painel da loja
   Mostra tudo o que o cliente escolheu: itens, observações, endereço,
   forma de pagamento, troco e o caminho percorrido até o pagamento.
   ===================================================================== */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const { money, esc } = PZ;
  const AUTH_KEY = 'pz_admin_auth';

  let SETTINGS = PZ.getSettings();
  let currentTab = 'atendimento';
  let filter = 'todos', query = '';
  let activeThread = null;
  let knownIds = null;            // ids de pedidos já vistos (para alertar novos)
  const fresh = new Set();        // pedidos recém-chegados (destaque)
  let audioCtx = null;

  /* ============================ Login ============================ */
  const isAuthed = () => sessionStorage.getItem(AUTH_KEY) === PZ.hash(SETTINGS.adminPass);
  function showApp() { $('#login').hidden = true; $('#app').hidden = false; start(); }
  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    if ($('#loginPass').value === SETTINGS.adminPass) {
      sessionStorage.setItem(AUTH_KEY, PZ.hash(SETTINGS.adminPass));
      initAudio(); showApp();
    } else { $('#loginErr').hidden = false; $('#loginPass').select(); }
  });
  $('#btnExit').addEventListener('click', () => { sessionStorage.removeItem(AUTH_KEY); location.reload(); });

  /* ============================ Som e avisos ============================ */
  function initAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* sem áudio */ } }
  document.addEventListener('click', initAudio, { once: true });
  function beep() {
    if (!$('#soundToggle').checked || !audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      [660, 880, 1100].forEach((f, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + i * .16;
        o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.25, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .15);
        o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + .16);
      });
    } catch (e) { /* ignora */ }
  }
  function toast(msg, cls = '') {
    const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = msg; $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }
  const baseTitle = document.title;

  /* ============================ Abas ============================ */
  function setTab(t) {
    currentTab = t;
    $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    $$('.pane').forEach(p => { p.hidden = p.id !== 'tab-' + t; });
    if (t === 'chat') { renderThreads(); renderConv(); }
    if (t === 'pedidos') renderOrders();
    if (t === 'config') loadCfg();
    if (t === 'atendimento') renderQueue();
  }
  $$('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

  /* ============================ Pedido (cartão completo) ============================ */
  const orders = () => PZ.getOrders().slice().sort((a, b) => b.createdAt - a.createdAt);
  const waLink = o => 'https://wa.me/55' + String(o.customer.phone).replace(/\D/g, '');

  function nextActions(o) {
    const a = [];
    const advance = (to, label, cls = 'btn-primary') => a.push(`<button class="btn ${cls}" data-st="${to}" data-id="${o.id}">${label}</button>`);
    if (o.status === 'novo') advance('preparo', '✓ Aceitar e iniciar preparo', 'btn-green');
    if (o.status === 'preparo') advance(o.mode === 'entrega' ? 'saiu' : 'pronto', o.mode === 'entrega' ? '🛵 Saiu para entrega' : '🔔 Pronto para retirada');
    if (o.status === 'saiu' || o.status === 'pronto') advance('concluido', '✔ Marcar como concluído', 'btn-green');
    if (!['concluido', 'cancelado'].includes(o.status)) a.push(`<span class="sp"></span><button class="btn btn-danger" data-st="cancelado" data-id="${o.id}">Cancelar</button>`);
    return a.join('');
  }

  function orderCard(o, withActions = true) {
    const c = o.customer;
    const addr = o.mode === 'entrega'
      ? `<dl class="kv"><dt>Rua</dt><dd>${esc(c.rua)}, nº ${esc(c.numero)}</dd><dt>Bairro</dt><dd>${esc(c.bairro)}</dd>${c.ref ? `<dt>Referência</dt><dd>${esc(c.ref)}</dd>` : ''}</dl>`
      : '<p style="margin:0;font-weight:700">Cliente vai retirar na loja.</p>';
    const trail = (o.trail && o.trail.length)
      ? `<ol class="trail">${o.trail.map(s => `<li><time>${PZ.fmtTime(s.t, true)}</time>${esc(s.label)}</li>`).join('')}</ol><p class="trail-sum">${o.trail.length} ações registradas até o pagamento.</p>`
      : '<p class="trail-sum">Sem registros.</p>';
    const cash = o.method === 'dinheiro' && o.cash
      ? `<dt>Troco</dt><dd>${o.cash.noChange ? 'Não precisa (valor exato)' : `Cliente paga com <b>${money(o.cash.payWith)}</b> → devolver <b>${money(o.cash.change)}</b>`}</dd>` : '';
    return `<article class="ocard ${fresh.has(o.id) ? 'fresh' : ''}" data-oid="${o.id}">
      <div class="oc-head">
        <div><h3>Pedido #${o.number}</h3><small>${PZ.fmtDate(o.createdAt)}${o.userId ? ' · cliente com conta' : ' · sem conta'}</small></div>
        <div class="chips">
          <span class="chip mode-${o.mode}">${o.mode === 'entrega' ? '🛵 Entrega' : '🏪 Retirada'}</span>
          <span class="chip ${o.paid ? 'paid' : 'topay'}">${o.paid ? '✓ Pago pelo site' : '$ Cobrar ' + (o.mode === 'entrega' ? 'na entrega' : 'na retirada')}</span>
          <span class="status st-${o.status}">${PZ.STATUS[o.status]}</span>
        </div>
      </div>
      <div class="oc-grid">
        <section>
          <h4>Cliente</h4>
          <dl class="kv"><dt>Nome</dt><dd>${esc(c.name)}</dd><dt>Telefone</dt><dd><a href="${waLink(o)}" target="_blank" rel="noopener">${esc(c.phone)}</a></dd></dl>
          <h4 style="margin-top:14px">${o.mode === 'entrega' ? 'Endereço de entrega' : 'Retirada'}</h4>${addr}
        </section>
        <section>
          <h4>Itens do pedido</h4>
          <ul class="items">${o.items.map(i => `<li><span><b>${i.qty}×</b> ${esc(i.name)}${i.size ? ` <small style="all:unset;color:#7b6759">(${esc(i.sizeLabel || i.size)})</small>` : ''}</span><b>${money(i.price * i.qty)}</b>${i.edgeLabel ? `<small>🧀 ${esc(i.edgeLabel)}</small>` : ''}${i.obs ? `<small>📝 ${esc(i.obs)}</small>` : ''}</li>`).join('')}</ul>
          <div class="tot-line"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
          ${o.mode === 'entrega' ? `<div class="tot-line"><span>Taxa de entrega</span><span>${money(o.fee)}</span></div>` : ''}
          <div class="tot-line big"><span>Total</span><span>${money(o.total)}</span></div>
        </section>
        <section>
          <h4>Pagamento</h4>
          <dl class="kv"><dt>Quando</dt><dd>${esc(PZ.payWhenText(o))}</dd><dt>Forma</dt><dd>${esc(PZ.METHODS[o.method] || o.method)}</dd>${o.card ? `<dt>Cartão</dt><dd>${esc(o.card.brand)} final ${esc(o.card.last4)}</dd>` : ''}${cash}<dt>Situação</dt><dd>${o.paid ? '<span style="color:var(--green)">Pago em ' + PZ.fmtDate(o.paidAt) + '</span>' : 'A receber'}</dd></dl>
          <h4 style="margin-top:14px">Observações do cliente</h4>
          ${o.obs ? `<p class="obs-box">${esc(o.obs)}</p>` : '<p class="obs-box none">Nenhuma observação.</p>'}
        </section>
        <section class="span2">
          <h4>Caminho do cliente até o pagamento</h4>${trail}
        </section>
        <section>
          <h4>Andamento</h4>
          <ol class="trail">${(o.statusLog || []).map(s => `<li><time>${PZ.fmtTime(s.t, true)}</time>${esc(PZ.STATUS[s.status])}</li>`).join('')}</ol>
        </section>
      </div>
      ${withActions ? `<div class="oc-actions">${nextActions(o)}<button class="btn btn-ghost" data-print="${o.id}">🖨 Imprimir</button><a class="btn btn-ghost" href="${waLink(o)}" target="_blank" rel="noopener">WhatsApp</a><button class="btn btn-ghost" data-chat="${o.id}">💬 Chat</button></div>` : ''}
    </article>`;
  }

  /* ============================ Atendimento ============================ */
  function renderQueue() {
    const q = orders().filter(o => o.status === 'novo').sort((a, b) => a.createdAt - b.createdAt);
    const n = $('#cntNovos'); n.textContent = q.length; n.hidden = !q.length; n.classList.toggle('pulse', q.length > 0);
    document.title = q.length ? `(${q.length}) Novo pedido! — ${baseTitle}` : baseTitle;
    $('#queue').innerHTML = q.length ? q.map(o => orderCard(o)).join('') :
      '<div class="empty"><div class="big">☕</div><h3 style="margin:.3em 0">Nenhum pedido aguardando</h3><p>Quando um cliente pagar ou confirmar um pedido, ele aparece aqui com todos os detalhes para conferência.</p></div>';
  }

  /* ============================ Pedidos ============================ */
  function renderOrders() {
    const all = orders(); const today = new Date().toDateString();
    const td = all.filter(o => new Date(o.createdAt).toDateString() === today && o.status !== 'cancelado');
    $('#stats').innerHTML = `
      <div class="stat"><small>Pedidos hoje</small><b>${td.length}</b></div>
      <div class="stat"><small>Faturamento hoje</small><b>${money(td.reduce((s, o) => s + o.total, 0))}</b></div>
      <div class="stat"><small>Em andamento</small><b>${all.filter(o => ['novo', 'preparo', 'saiu', 'pronto'].includes(o.status)).length}</b></div>
      <div class="stat"><small>Pagos pelo site hoje</small><b>${money(td.filter(o => o.paid).reduce((s, o) => s + o.total, 0))}</b></div>`;
    const match = o => {
      if (filter === 'rota' ? !['saiu', 'pronto'].includes(o.status) : (filter !== 'todos' && o.status !== filter)) return false;
      if (!query) return true;
      const hay = (`${o.number} ${o.customer.name} ${o.customer.phone}`).toLowerCase();
      return hay.includes(query);
    };
    const list = all.filter(match);
    const openIds = new Set($$('#ordersList details[open]').map(d => d.dataset.oid));
    $('#ordersList').innerHTML = list.length ? list.map(o => `
      <details class="orow" data-oid="${o.id}" ${openIds.has(o.id) ? 'open' : ''}>
        <summary>
          <span class="num">#${o.number}</span><span class="who">${esc(o.customer.name)}</span>
          <span class="chip mode-${o.mode}">${o.mode === 'entrega' ? 'Entrega' : 'Retirada'}</span>
          <span class="chip ${o.paid ? 'paid' : 'topay'}">${o.paid ? 'Pago' : 'A cobrar'}</span>
          <span class="tot">${money(o.total)}</span>
          <span><span class="status st-${o.status}">${PZ.STATUS[o.status]}</span></span>
        </summary>
        ${openIds.has(o.id) ? orderCard(o) : '<div class="lazy" style="padding:16px">Abrindo…</div>'}
      </details>`).join('') : '<div class="empty"><div class="big">📋</div><p>Nenhum pedido encontrado.</p></div>';
  }
  // Conteúdo completo carregado só ao abrir (mais leve)
  $('#ordersList').addEventListener('toggle', e => {
    const d = e.target; if (!d.matches || !d.matches('details.orow') || !d.open) return;
    const o = PZ.getOrders().find(x => x.id === d.dataset.oid); if (!o) return;
    const lazy = d.querySelector('.lazy'); if (lazy) lazy.outerHTML = orderCard(o);
  }, true);
  $('#filters').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    filter = b.dataset.f; $$('#filters .fbtn').forEach(x => x.classList.toggle('active', x === b)); renderOrders();
  });
  $('#search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); renderOrders(); });

  /* ---- Ações nos pedidos (vale para as duas abas) ---- */
  document.addEventListener('click', e => {
    const st = e.target.closest('[data-st]');
    if (st) {
      const id = st.dataset.id, to = st.dataset.st;
      if (to === 'cancelado' && !confirm('Cancelar este pedido?')) return;
      PZ.setStatus(id, to); fresh.delete(id); refresh(); return;
    }
    const pr = e.target.closest('[data-print]');
    if (pr) {
      const card = pr.closest('.ocard'); const holder = card.closest('.orow') || card;
      holder.classList.add('print-target'); card.classList.add('print-target');
      document.body.classList.add('printing');
      window.print();
      document.body.classList.remove('printing'); holder.classList.remove('print-target'); card.classList.remove('print-target'); return;
    }
    const ch = e.target.closest('[data-chat]');
    if (ch) {
      const o = PZ.getOrders().find(x => x.id === ch.dataset.chat); if (!o) return;
      const th = findThreadForOrder(o);
      if (th) { activeThread = th; setTab('chat'); } else toast('Este cliente ainda não abriu o chat. Use o WhatsApp.');
    }
  });
  function findThreadForOrder(o) {
    const chats = PZ.getChats();
    return Object.values(chats).find(t => t.name === o.customer.name || t.name === (PZ.users().find(u => u.id === o.userId) || {}).name)?.id || null;
  }

  /* ============================ Chat ============================ */
  function renderThreads() {
    const chats = Object.values(PZ.getChats()).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const total = chats.reduce((s, t) => s + (t.unreadAdmin || 0), 0);
    const n = $('#cntChat'); n.textContent = total; n.hidden = !total;
    $('#threadList').innerHTML = chats.length ? chats.map(t => {
      const last = t.messages[t.messages.length - 1];
      return `<button class="thread ${t.id === activeThread ? 'active' : ''}" data-tid="${t.id}"><span class="av">${esc((t.name || '?')[0].toUpperCase())}</span><span class="tinfo"><b>${esc(t.name)}</b><small>${last ? esc(last.text) : ''}</small></span>${t.unreadAdmin ? `<span class="count">${t.unreadAdmin}</span>` : ''}</button>`;
    }).join('') : '<p class="empty-s">Nenhuma conversa ainda.</p>';
  }
  function renderConv() {
    const th = activeThread && PZ.getChats()[activeThread];
    $('#convForm').hidden = !th;
    if (!th) { $('#convHead').textContent = 'Selecione uma conversa'; $('#convBody').innerHTML = ''; return; }
    $('#convHead').textContent = th.name;
    const box = $('#convBody'); const near = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const lbl = { client: 'client', admin: 'admin', bot: 'bot' };
    box.innerHTML = th.messages.map(m => `<div class="msg ${lbl[m.from]}"><p>${esc(m.text)}</p><time>${PZ.fmtTime(m.t)}</time></div>`).join('');
    if (near) box.scrollTop = box.scrollHeight;
    if (th.unreadAdmin && currentTab === 'chat') { PZ.markRead(activeThread, 'admin'); renderThreads(); }
  }
  $('#threadList').addEventListener('click', e => {
    const b = e.target.closest('[data-tid]'); if (!b) return;
    activeThread = b.dataset.tid; renderThreads(); renderConv(); $('#convBody').scrollTop = 1e9; $('#convInput').focus();
  });
  $('#convForm').addEventListener('submit', e => {
    e.preventDefault(); const t = $('#convInput').value.trim(); if (!t || !activeThread) return;
    PZ.sendMessage(activeThread, 'admin', t); $('#convInput').value = '';
    renderConv(); renderThreads(); $('#convBody').scrollTop = 1e9;
  });

  /* ============================ Configurações ============================ */
  function loadCfg() {
    const s = PZ.getSettings();
    $('#cfgName').value = s.name; $('#cfgPhone').value = s.phone; $('#cfgFee').value = s.deliveryFee;
    $('#cfgAddress').value = s.address; $('#cfgHours').value = s.hours; $('#cfgPix').value = s.pixKey; $('#cfgPass').value = s.adminPass;
  }
  $('#btnSaveCfg').addEventListener('click', () => {
    const pass = $('#cfgPass').value.trim();
    if (pass.length < 4) { toast('A senha do painel precisa ter ao menos 4 caracteres.'); return; }
    const s = { name: $('#cfgName').value.trim() || 'Pizzaria', phone: $('#cfgPhone').value.trim(), deliveryFee: Math.max(0, parseFloat($('#cfgFee').value) || 0), address: $('#cfgAddress').value.trim(), hours: $('#cfgHours').value.trim(), pixKey: $('#cfgPix').value.trim(), adminPass: pass };
    PZ.saveSettings(s); SETTINGS = PZ.getSettings(); sessionStorage.setItem(AUTH_KEY, PZ.hash(SETTINGS.adminPass));
    hydrate(); toast('Configurações salvas!');
  });
  $('#btnWipe').addEventListener('click', () => {
    if (!confirm('Apagar TODOS os pedidos, conversas e contas de clientes deste navegador? Isso não pode ser desfeito.')) return;
    [PZ.K.orders, PZ.K.chats, PZ.K.users, PZ.K.session, PZ.K.cart, PZ.K.seq, PZ.K.trail].forEach(k => localStorage.removeItem(k));
    knownIds = new Set(); activeThread = null; refresh(); toast('Dados de demonstração apagados.');
  });

  /* ============================ Atualização ============================ */
  function hydrate() { SETTINGS = PZ.getSettings(); $$('[data-store-name]').forEach(el => { el.textContent = SETTINGS.name; }); }
  function detectNew() {
    const ids = new Set(PZ.getOrders().map(o => o.id));
    if (knownIds) PZ.getOrders().forEach(o => {
      if (!knownIds.has(o.id) && o.status === 'novo') {
        fresh.add(o.id); beep();
        toast(`🔔 Novo pedido #${o.number} — ${o.customer.name} — ${money(o.total)}`, 'new');
      }
    });
    knownIds = ids;
  }
  function refresh() {
    detectNew(); renderQueue();
    if (currentTab === 'pedidos') renderOrders();
    renderThreads(); if (currentTab === 'chat') renderConv();
  }
  window.addEventListener('storage', e => {
    if (!$('#app').hidden && (!e.key || [PZ.K.orders, PZ.K.chats, PZ.K.users].includes(e.key))) {
      const prevChat = Object.values(PZ.getChats()).reduce((s, t) => s + (t.unreadAdmin || 0), 0);
      refresh();
      const nowChat = Object.values(PZ.getChats()).reduce((s, t) => s + (t.unreadAdmin || 0), 0);
      if (nowChat > prevChat && currentTab !== 'chat') toast('💬 Nova mensagem de cliente');
    }
  });
  function start() {
    hydrate(); knownIds = new Set(PZ.getOrders().map(o => o.id));
    renderQueue(); renderThreads(); setTab('atendimento');
  }

  if (isAuthed()) showApp();
})();
