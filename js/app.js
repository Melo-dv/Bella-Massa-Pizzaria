/* =====================================================================
   app.js — Site do cliente (cardápio, carrinho, conta, checkout, chat)
   Depende de shared.js (objeto PZ).
   ===================================================================== */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const { money, esc } = PZ;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let SETTINGS = PZ.getSettings();
  let afterAuth = null;
  let activeFilter = 'Todas';
  const knownStatus = {};
  const co = { method: '' };         // estado do checkout
  let pendingOrder = null;           // pedido aguardando pagamento Pix
  let pixTimer = null;

  /* ============================ Utilidades de UI ============================ */
  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3400);
  }
  function syncScroll() {
    const any = $$('.modal').some(m => !m.hidden) || $('#cartDrawer').classList.contains('open');
    document.body.classList.toggle('no-scroll', any);
  }
  const openModal = sel => { $(sel).hidden = false; syncScroll(); };
  const closeModal = sel => { $(sel).hidden = true; syncScroll(); };

  document.addEventListener('click', e => {
    const c = e.target.closest('[data-close]');
    if (c) { const m = c.closest('.modal'); if (m) { m.hidden = true; if (m.id === 'checkoutModal') stopPixTimer(); syncScroll(); } return; }
    if (e.target.classList && e.target.classList.contains('modal') && !e.target.hasAttribute('data-noback')) { e.target.hidden = true; syncScroll(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = $$('.modal').filter(m => !m.hidden).pop();
    if (open) { open.hidden = true; if (open.id === 'checkoutModal') stopPixTimer(); syncScroll(); }
    else if ($('#cartDrawer').classList.contains('open')) closeCart();
    else if (!$('#chatPanel').hidden) closeChat();
  });

  function hydrateSettings() {
    SETTINGS = PZ.getSettings();
    document.title = `${SETTINGS.name} — Pizza artesanal, entregue quente`;
    $$('[data-store-name]').forEach(el => { el.textContent = SETTINGS.name; });
    $$('[data-s]').forEach(el => { const k = el.dataset.s; el.textContent = k === 'deliveryFee' ? money(SETTINGS.deliveryFee) : (SETTINGS[k] || ''); });
    const digits = String(SETTINGS.phone || '').replace(/\D/g, '');
    $$('[data-wa]').forEach(a => { a.href = 'https://wa.me/55' + digits; });
    $$('[data-tel]').forEach(a => { a.href = 'tel:' + digits; });
  }

  /* ============================ Cardápio ============================ */
  function pizzaCard(p) {
    const sizes = Object.keys(p.prices);
    return `<article class="item ${p.available ? '' : 'off'}">
      <div class="art">${PZ.pizzaSVG(p.art, 'Pizza de ' + p.name)}<span class="tag-img">Imagem ilustrativa</span>${p.badge ? `<span class="badge-top">${esc(p.badge)}</span>` : ''}</div>
      <div class="body">
        <h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p>
        <div class="sizes" role="radiogroup" aria-label="Tamanho">
          ${sizes.map(s => `<label class="size" title="${esc(PZ.SIZES[s])}"><input type="radio" name="size-${p.id}" value="${s}" ${s === 'M' ? 'checked' : ''}><span><b>${s}</b><small>${money(p.prices[s])}</small></span></label>`).join('')}
        </div>
        <button class="btn btn-primary btn-block" data-add="${p.id}" ${p.available ? '' : 'disabled'}>${p.available ? 'Adicionar ao carrinho' : 'Indisponível hoje'}</button>
      </div></article>`;
  }
  function drinkCard(d) {
    return `<article class="item drink ${d.available ? '' : 'off'}">
      <div class="art">${PZ.drinkSVG(d.art)}<span class="tag-img">Imagem ilustrativa</span></div>
      <div class="body"><h3>${esc(d.name)}</h3><p>${esc(d.desc)}</p>
        <div class="row"><span class="price">${money(d.price)}</span>
        <button class="btn btn-primary btn-sm" data-add="${d.id}" ${d.available ? '' : 'disabled'}>${d.available ? 'Adicionar' : 'Indisponível'}</button></div>
      </div></article>`;
  }
  function renderMenu() {
    const menu = PZ.getMenu();
    const pizzas = menu.filter(i => i.cat === 'pizza').filter(i => activeFilter === 'Todas' || i.group === activeFilter);
    $('#pizzaGrid').innerHTML = pizzas.map(pizzaCard).join('');
    $('#drinkGrid').innerHTML = menu.filter(i => i.cat === 'bebida').map(drinkCard).join('');
  }
  $('#menuFilters').addEventListener('click', e => {
    const b = e.target.closest('[data-filter]'); if (!b) return;
    activeFilter = b.dataset.filter;
    $$('#menuFilters .chip').forEach(c => c.classList.toggle('active', c === b));
    renderMenu();
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-add]'); if (!b || b.disabled) return;
    const card = b.closest('.item'); const r = card.querySelector('input[type=radio]:checked');
    const it = PZ.getMenu().find(i => i.id === b.dataset.add); if (!it) return;
    if (it.cat === 'pizza') openEdge(it, r ? r.value : 'M');   // pizza: pergunta a borda
    else addToCart(it.id, null);
  });

  /* ---- Escolha da borda (abre ao clicar na pizza) ---- */
  let edgePick = null;
  function updateEdgeBtn() {
    const it = PZ.getMenu().find(i => i.id === edgePick.id); if (!it) return;
    $('#edgeAdd').textContent = `Adicionar ao carrinho · ${money(it.prices[edgePick.size] + PZ.EDGES[edgePick.edge].price)}`;
  }
  function openEdge(it, size) {
    edgePick = { id: it.id, size, edge: 'none' };
    $('#edgeTitle').textContent = it.name;
    $('#edgeSub').textContent = `${PZ.SIZES[size]} · escolha a borda`;
    $('#edgeOptions').innerHTML = Object.entries(PZ.EDGES).map(([k, ed]) =>
      `<label class="opt"><input type="radio" name="edge" value="${k}" ${k === 'none' ? 'checked' : ''}><span><b>${esc(ed.label)}</b><small>${ed.price ? '+ ' + money(ed.price) : 'Sem custo adicional'}</small></span></label>`).join('');
    updateEdgeBtn(); openModal('#edgeModal');
  }
  $('#edgeOptions').addEventListener('change', e => { if (e.target.name === 'edge') { edgePick.edge = e.target.value; updateEdgeBtn(); } });
  $('#edgeAdd').addEventListener('click', () => {
    if (!edgePick) return;
    addToCart(edgePick.id, edgePick.size, 1, '', edgePick.edge);
    closeModal('#edgeModal'); edgePick = null;
  });

  /* ============================ Carrinho ============================ */
  const subtotal = cart => +cart.reduce((s, c) => s + c.price * c.qty, 0).toFixed(2);

  function normalizeCart() {
    const menu = PZ.getMenu(); let cart = PZ.getCart(); let changed = false;
    cart = cart.filter(c => {
      const it = menu.find(m => m.id === c.id);
      if (!it || !it.available || (c.size && !(it.prices && it.prices[c.size]))) { changed = true; return false; }
      const p = (it.cat === 'pizza' ? it.prices[c.size] : it.price) + (it.cat === 'pizza' && PZ.EDGES[c.edge] ? PZ.EDGES[c.edge].price : 0);
      if (p !== c.price || it.name !== c.name) { c.price = p; c.name = it.name; changed = true; }
      return true;
    });
    if (changed) PZ.saveCart(cart);
    return cart;
  }

  const edgeText = c => (c.edge && c.edge !== 'none' && PZ.EDGES[c.edge]) ? PZ.EDGES[c.edge].label : '';

  function addToCart(id, size, qty = 1, obs = '', edge = 'none') {
    const it = PZ.getMenu().find(i => i.id === id); if (!it || !it.available) return;
    const isPizza = it.cat === 'pizza';
    const base = isPizza ? it.prices[size] : it.price;
    if (base == null) return;
    const ed = isPizza && PZ.EDGES[edge] ? edge : 'none';
    const price = base + (isPizza ? PZ.EDGES[ed].price : 0);
    const key = id + '|' + (size || '') + '|' + (isPizza ? ed : '');
    const cart = PZ.getCart(); const ex = cart.find(c => c.key === key);
    if (ex) ex.qty += qty; else cart.push({ key, id, name: it.name, cat: it.cat, art: it.art, size: size || null, edge: isPizza ? ed : null, price, qty, obs });
    PZ.saveCart(cart);
    const label = `${it.name}${size ? ` (${size})` : ''}${isPizza && ed !== 'none' ? ' + ' + PZ.EDGES[ed].label : ''}`;
    PZ.track(`Adicionou ao carrinho: ${label}`);
    renderCart();
    $('#btnCart').classList.remove('bump'); void $('#btnCart').offsetWidth; $('#btnCart').classList.add('bump');
    toast(`${label} adicionado ao carrinho`);
  }

  function renderCart() {
    const cart = normalizeCart();
    const count = cart.reduce((n, c) => n + c.qty, 0);
    $('#cartCount').textContent = count; $('#cartCount').hidden = count === 0;
    $('#cartEmpty').hidden = cart.length > 0;
    $('#cartFoot').hidden = cart.length === 0;
    $('#cartItems').hidden = cart.length === 0;
    $('#cartItems').innerHTML = cart.map(c => `
      <li class="ci" data-key="${esc(c.key)}">
        <div class="thumb">${c.cat === 'pizza' ? PZ.pizzaSVG(c.art, c.name) : PZ.drinkSVG(c.art)}</div>
        <div>
          <b>${esc(c.name)}</b>
          <small>${c.size ? esc(PZ.SIZES[c.size]) + ' · ' : ''}${edgeText(c) ? esc(edgeText(c)) + ' · ' : ''}${money(c.price)}</small>
          <input class="ci-obs" data-obs placeholder="Observação (ex.: sem cebola)" maxlength="120" value="${esc(c.obs || '')}" aria-label="Observação do item">
        </div>
        <div class="ci-side">
          <span class="ci-total">${money(c.price * c.qty)}</span>
          <span class="qty"><button data-dec aria-label="Diminuir">−</button><span>${c.qty}</span><button data-inc aria-label="Aumentar">+</button></span>
          <button class="link-btn" data-rm style="font-size:.8rem">remover</button>
        </div>
      </li>`).join('');
    $('#cartSubtotal').textContent = money(subtotal(cart));
    if (!$('#checkoutModal').hidden) syncCheckout();
  }

  $('#cartItems').addEventListener('click', e => {
    const li = e.target.closest('.ci'); if (!li) return;
    const cart = PZ.getCart(); const i = cart.findIndex(c => c.key === li.dataset.key); if (i < 0) return;
    if (e.target.closest('[data-inc]')) { cart[i].qty++; PZ.track(`Aumentou quantidade: ${cart[i].name}`); }
    else if (e.target.closest('[data-dec]')) { cart[i].qty--; if (cart[i].qty <= 0) cart.splice(i, 1); }
    else if (e.target.closest('[data-rm]')) { PZ.track(`Removeu do carrinho: ${cart[i].name}`); cart.splice(i, 1); }
    else return;
    PZ.saveCart(cart); renderCart();
  });
  $('#cartItems').addEventListener('input', e => {
    if (!e.target.matches('[data-obs]')) return;
    const li = e.target.closest('.ci'); const cart = PZ.getCart(); const it = cart.find(c => c.key === li.dataset.key);
    if (it) { it.obs = e.target.value; PZ.saveCart(cart); }
  });

  function openCart() { renderCart(); $('#cartDrawer').classList.add('open'); $('#cartDrawer').setAttribute('aria-hidden', 'false'); $('#cartOverlay').classList.add('show'); syncScroll(); }
  function closeCart() { $('#cartDrawer').classList.remove('open'); $('#cartDrawer').setAttribute('aria-hidden', 'true'); $('#cartOverlay').classList.remove('show'); syncScroll(); }
  $('#btnCart').addEventListener('click', openCart);
  $('#heroCart').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  $('#cartOverlay').addEventListener('click', closeCart);
  $('#cartGoMenu').addEventListener('click', () => { closeCart(); location.hash = '#cardapio'; });
  $('#btnCheckout').addEventListener('click', openCheckout);

  /* ============================ Conta ============================ */
  function updateAccountUI() {
    const u = PZ.currentUser();
    $('#btnAccountLabel').textContent = u ? u.name.split(' ')[0] : 'Entrar';
    $('#btnHistory').hidden = !u;   // histórico só aparece com a conta logada
  }
  function setAuthTab(t) {
    $('#tabLogin').classList.toggle('active', t === 'login'); $('#tabSignup').classList.toggle('active', t === 'signup');
    $('#loginForm').hidden = t !== 'login'; $('#signupForm').hidden = t !== 'signup'; $('#authError').hidden = true;
  }
  function openAuth(tab = 'login', cb = null) { afterAuth = cb; setAuthTab(tab); openModal('#authModal'); }
  $('#tabLogin').addEventListener('click', () => setAuthTab('login'));
  $('#tabSignup').addEventListener('click', () => setAuthTab('signup'));
  function authDone(res, msg) {
    if (res.error) { const el = $('#authError'); el.textContent = res.error; el.hidden = false; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); return; }
    closeModal('#authModal'); updateAccountUI(); toast(msg);
    PZ.track(`Entrou na conta (${res.user.name})`);
    const cb = afterAuth; afterAuth = null; if (cb) cb();
  }
  $('#loginForm').addEventListener('submit', e => { e.preventDefault(); authDone(PZ.login($('#loginEmail').value, $('#loginPass').value), 'Bem-vindo de volta! 🍕'); });
  $('#signupForm').addEventListener('submit', e => {
    e.preventDefault();
    authDone(PZ.register({ name: $('#suName').value, email: $('#suEmail').value, phone: $('#suPhone').value, password: $('#suPass').value }), 'Conta criada com sucesso!');
  });

  function clientOrderCard(o) {
    const steps = o.mode === 'entrega' ? ['novo', 'preparo', 'saiu', 'concluido'] : ['novo', 'preparo', 'pronto', 'concluido'];
    const labels = { novo: 'Recebido', preparo: 'Em preparo', saiu: 'A caminho', pronto: 'Pronto', concluido: 'Concluído' };
    const idx = steps.indexOf(o.status);
    return `<article class="ho">
      <div class="ho-top"><div><b>Pedido #${o.number}</b><small>${PZ.fmtDate(o.createdAt)}</small></div><span class="status st-${o.status}">${PZ.STATUS[o.status]}</span></div>
      ${o.status === 'cancelado' ? '' : `<ol class="steps">${steps.map((s, i) => `<li class="${i <= idx ? 'done' : ''}">${labels[s]}</li>`).join('')}</ol>`}
      <ul class="ho-items">${o.items.map(i => `<li>${i.qty}× ${esc(i.name)}${i.size ? ` (${i.size})` : ''}${edgeText(i) ? ` + ${esc(edgeText(i))}` : ''}${i.obs ? ` — <i>${esc(i.obs)}</i>` : ''}</li>`).join('')}</ul>
      <div class="ho-meta">${o.mode === 'entrega' ? '🛵 Entrega' : '🏪 Retirada'} · ${esc(PZ.payWhenText(o))}: ${esc(PZ.payDetail(o))} ${o.paid ? '· <b class="ok">Pago</b>' : ''}</div>
      <div class="ho-foot"><b>${money(o.total)}</b><button class="btn btn-ghost btn-sm" data-reorder="${o.id}">Pedir novamente</button></div>
    </article>`;
  }
  function renderOrders() {
    const u = PZ.currentUser(); if (!u) return;
    const list = PZ.getOrders().filter(o => o.userId === u.id).sort((a, b) => b.createdAt - a.createdAt);
    $('#ordersList').innerHTML = list.length ? list.map(clientOrderCard).join('') : '<p class="empty-s">Você ainda não fez nenhum pedido.<br>Seu histórico vai aparecer aqui. 🍕</p>';
  }
  function openAccount() {
    const u = PZ.currentUser(); if (!u) { openAuth('login', openAccount); return; }
    $('#accName').textContent = u.name; $('#accEmail').textContent = u.email; $('#accPhone').textContent = u.phone || ''; $('#accAvatar').textContent = u.name[0].toUpperCase();
    openModal('#accountModal');
  }
  function openHistory() {
    const u = PZ.currentUser(); if (!u) { openAuth('login', openHistory); return; }
    renderOrders(); openModal('#historyModal');
  }
  $('#btnAccount').addEventListener('click', openAccount);
  $('#btnHistory').addEventListener('click', openHistory);
  $('#btnAccHistory').addEventListener('click', () => { closeModal('#accountModal'); openHistory(); });
  $('#btnLogout').addEventListener('click', () => { PZ.logout(); closeModal('#accountModal'); closeModal('#historyModal'); updateAccountUI(); toast('Você saiu da conta.'); });
  $('#ordersList').addEventListener('click', e => {
    const b = e.target.closest('[data-reorder]'); if (!b) return;
    const o = PZ.getOrders().find(x => x.id === b.dataset.reorder); if (!o) return;
    o.items.forEach(i => addToCart(i.id, i.size, i.qty, i.obs, i.edge || 'none'));
    closeModal('#historyModal'); openCart();
  });

  /* ============================ Checkout ============================ */
  const METHODS_BY = { site: ['pix', 'credito'], entrega: ['dinheiro', 'debito', 'credito', 'pix'] };
  const readState = () => ({ mode: $('input[name=mode]:checked').value, payWhen: $('input[name=payWhen]:checked').value });
  const parseMoney = s => { s = String(s || '').replace(/[^\d,.-]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return parseFloat(s) || 0; };
  const totals = () => { const { mode } = readState(); const sub = subtotal(PZ.getCart()); const fee = mode === 'entrega' ? Number(SETTINGS.deliveryFee) || 0 : 0; return { sub, fee, total: +(sub + fee).toFixed(2) }; };

  function showStep(name) {
    $('#coStepForm').hidden = name !== 'form'; $('#coStepPix').hidden = name !== 'pix'; $('#coStepDone').hidden = name !== 'done';
    if (name !== 'pix') stopPixTimer();
    $('#checkoutModal .modal-box').scrollTop = 0;
  }

  function openCheckout() {
    const cart = normalizeCart();
    if (!cart.length) { toast('Seu carrinho está vazio.'); return; }
    const user = PZ.currentUser();
    if (!user) { closeCart(); openAuth('login', openCheckout); toast('Entre ou crie sua conta para finalizar o pedido.'); return; }
    closeCart();
    PZ.track('Abriu a tela de finalização do pedido');
    const last = PZ.getOrders().filter(o => o.userId === user.id).sort((a, b) => b.createdAt - a.createdAt)[0];
    const c = (last && last.customer) || {};
    const fill = (sel, val) => { if (!$(sel).value) $(sel).value = val || ''; };
    fill('#coName', c.name || user.name); fill('#coPhone', c.phone || user.phone);
    fill('#coBairro', c.bairro); fill('#coRua', c.rua); fill('#coNumero', c.numero); fill('#coRef', c.ref);
    $('#coError').hidden = true;
    showStep('form'); syncCheckout(); openModal('#checkoutModal');
  }

  function syncCheckout() {
    const { mode, payWhen } = readState();
    const list = METHODS_BY[payWhen];
    if (!list.includes(co.method)) co.method = payWhen === 'site' ? 'pix' : '';
    $('#addrFields').hidden = mode !== 'entrega';
    $('#payWhenLabel').textContent = mode === 'entrega' ? '💵 Pagar na entrega' : '💵 Pagar na retirada';
    $('#methodRow').innerHTML = list.map(m => `<label class="chip-opt"><input type="radio" name="method" value="${m}" ${co.method === m ? 'checked' : ''}><span>${PZ.METHOD_ICON[m]} ${PZ.METHODS[m]}</span></label>`).join('');
    $('#cashBox').hidden = !(payWhen === 'entrega' && co.method === 'dinheiro');
    $('#cardBox').hidden = !(payWhen === 'site' && co.method === 'credito');
    const showPix = co.method === 'pix';
    $('#pixNote').hidden = !showPix;
    if (showPix) $('#pixNoteText').textContent = payWhen === 'site'
      ? 'Na próxima etapa vamos mostrar o QR Code Pix para você pagar agora pelo app do seu banco.'
      : `Você paga com Pix ${mode === 'entrega' ? 'ao receber o pedido' : 'ao retirar'} (QR Code do entregador/balcão).`;

    const cart = PZ.getCart(); const t = totals();
    $('#coItems').innerHTML = cart.map(c => `<div><span>${c.qty}× ${esc(c.name)}${c.size ? ` (${c.size})` : ''}${edgeText(c) ? `<small>${esc(edgeText(c))}</small>` : ''}${c.obs ? `<small>${esc(c.obs)}</small>` : ''}</span><span>${money(c.price * c.qty)}</span></div>`).join('');
    $('#coSub').textContent = money(t.sub); $('#coFee').textContent = money(t.fee); $('#coFeeLine').hidden = mode !== 'entrega'; $('#coTotal').textContent = money(t.total);

    const btn = $('#btnConfirm');
    if (payWhen === 'entrega') btn.textContent = 'Confirmar pedido';
    else btn.textContent = co.method === 'pix' ? `Gerar Pix · ${money(t.total)}` : `Pagar ${money(t.total)} no cartão`;
    updateChange();
  }
  function updateChange() {
    if ($('#cashBox').hidden) return;
    const t = totals().total, noChange = $('#coNoChange').checked, v = parseMoney($('#coCashFor').value), info = $('#cashChange');
    $('#coCashFor').disabled = noChange;
    info.classList.remove('bad');
    if (noChange) info.textContent = `Valor exato: ${money(t)}`;
    else if (!v) info.textContent = '';
    else if (v >= t) info.textContent = `Troco a receber: ${money(v - t)}`;
    else { info.textContent = `O valor precisa ser pelo menos ${money(t)}.`; info.classList.add('bad'); }
  }

  $('#checkoutForm').addEventListener('submit', e => e.preventDefault());
  $('#checkoutForm').addEventListener('change', e => {
    const t = e.target;
    if (t.name === 'mode') PZ.track(`Escolheu: ${t.value === 'entrega' ? 'entrega' : 'retirada na loja'}`);
    if (t.name === 'payWhen') PZ.track(`Escolheu pagar ${t.value === 'site' ? 'pelo site' : 'na ' + (readState().mode === 'entrega' ? 'entrega' : 'retirada')}`);
    if (t.name === 'method') { co.method = t.value; PZ.track(`Escolheu forma de pagamento: ${PZ.METHODS[t.value]}`); }
    if (['mode', 'payWhen', 'method'].includes(t.name)) syncCheckout();
    if (t.id === 'coNoChange') { PZ.track(t.checked ? 'Informou que não precisa de troco' : 'Vai precisar de troco'); updateChange(); }
  });
  $('#coCashFor').addEventListener('input', updateChange);
  $('#coCashFor').addEventListener('change', () => { const v = parseMoney($('#coCashFor').value); if (v) PZ.track(`Informou troco para ${money(v)}`); });
  $('#coObs').addEventListener('change', () => { if ($('#coObs').value.trim()) PZ.track('Escreveu observações no pedido'); });
  $('#coPhone').addEventListener('input', e => { e.target.value = maskPhone(e.target.value); });
  $('#suPhone').addEventListener('input', e => { e.target.value = maskPhone(e.target.value); });
  $('#cardNumber').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim(); });
  $('#cardExp').addEventListener('input', e => { let v = e.target.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); e.target.value = v; });
  $('#cardCvv').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
  function maskPhone(v) {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  const brandOf = n => /^4/.test(n) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : /^3[47]/.test(n) ? 'Amex' : 'Cartão';

  function collect() {
    const { mode, payWhen } = readState(); const method = co.method; const t = totals();
    const customer = { name: $('#coName').value.trim(), phone: $('#coPhone').value.trim(), bairro: $('#coBairro').value.trim(), rua: $('#coRua').value.trim(), numero: $('#coNumero').value.trim(), ref: $('#coRef').value.trim() };
    const fail = (error, field) => ({ error, field });
    const digits = customer.phone.replace(/\D/g, '');
    if (customer.name.length < 3) return fail('Informe seu nome completo.', '#coName');
    if (digits.length < 10) return fail('Informe um telefone válido com DDD.', '#coPhone');
    if (mode === 'entrega') {
      if (!customer.bairro) return fail('Informe o bairro.', '#coBairro');
      if (!customer.rua) return fail('Informe a rua.', '#coRua');
      if (!customer.numero) return fail('Informe o número da casa.', '#coNumero');
    }
    if (!method) return fail('Escolha a forma de pagamento.', '#methodRow');
    let cash = null, card = null;
    if (payWhen === 'entrega' && method === 'dinheiro') {
      const noChange = $('#coNoChange').checked, payWith = parseMoney($('#coCashFor').value);
      if (!noChange) {
        if (!payWith) return fail('Informe para quanto você precisa de troco (ou marque "Não preciso de troco").', '#coCashFor');
        if (payWith < t.total) return fail(`O valor para troco precisa ser maior ou igual ao total (${money(t.total)}).`, '#coCashFor');
      }
      cash = noChange ? { noChange: true, payWith: t.total, change: 0 } : { noChange: false, payWith, change: +(payWith - t.total).toFixed(2) };
    }
    if (payWhen === 'site' && method === 'credito') {
      const num = $('#cardNumber').value.replace(/\D/g, ''), nm = $('#cardName').value.trim(), exp = $('#cardExp').value, cvv = $('#cardCvv').value;
      if (num.length < 13) return fail('Número do cartão inválido.', '#cardNumber');
      if (nm.length < 3) return fail('Informe o nome impresso no cartão.', '#cardName');
      const m = /^(\d{2})\/(\d{2})$/.exec(exp);
      if (!m || +m[1] < 1 || +m[1] > 12) return fail('Validade inválida (use MM/AA).', '#cardExp');
      if (new Date(2000 + +m[2], +m[1], 1) <= new Date()) return fail('Cartão vencido.', '#cardExp');
      if (cvv.length < 3) return fail('CVV inválido.', '#cardCvv');
      card = { brand: brandOf(num), last4: num.slice(-4) };   // só guardamos bandeira e final
    }
    return { data: { mode, payWhen, method, customer, cash, card, obs: $('#coObs').value.trim(), subtotal: t.sub, fee: t.fee, total: t.total } };
  }

  function showCoError(msg, field) {
    const el = $('#coError'); el.textContent = msg; el.hidden = false;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    const target = field && $(field); if (target) { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (target.focus && target.tagName === 'INPUT') target.focus({ preventScroll: true }); }
  }

  $('#btnConfirm').addEventListener('click', async () => {
    const r = collect();
    if (r.error) { showCoError(r.error, r.field); return; }
    $('#coError').hidden = true;
    const d = r.data;
    PZ.track(`Conferiu os dados — ${d.mode === 'entrega' ? 'entrega' : 'retirada'}, ${d.payWhen === 'site' ? 'pagando pelo site' : 'pagando na ' + (d.mode === 'entrega' ? 'entrega' : 'retirada')} (${PZ.METHODS[d.method]})`);
    if (d.payWhen === 'entrega') { finalizeOrder(d, false); return; }
    if (d.method === 'pix') { pendingOrder = d; startPix(d); return; }
    const btn = $('#btnConfirm'); btn.disabled = true; btn.textContent = 'Processando pagamento…';
    PZ.track('Enviou pagamento no cartão de crédito');
    await sleep(1600);            // DEMO: aqui entraria a chamada ao gateway de pagamento
    btn.disabled = false;
    finalizeOrder(d, true);
  });

  /* ---- Pix (demonstração) ---- */
  function qrSVG(text) {
    const N = 29, rnd = PZ.rngFrom(text), m = Array.from({ length: N }, () => Array(N).fill(0));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) m[y][x] = rnd() > .52 ? 1 : 0;
    const finder = (ox, oy) => {
      for (let y = -1; y < 8; y++) for (let x = -1; x < 8; x++) {
        const X = ox + x, Y = oy + y; if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
        const inside = x >= 0 && x <= 6 && y >= 0 && y <= 6;
        const edge = x === 0 || x === 6 || y === 0 || y === 6, core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        m[Y][X] = inside && (edge || core) ? 1 : 0;
      }
    };
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    let d = ''; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m[y][x]) d += `M${x} ${y}h1v1h-1z`;
    return `<svg viewBox="-2 -2 ${N + 4} ${N + 4}" shape-rendering="crispEdges" role="img" aria-label="QR Code Pix ilustrativo"><rect x="-2" y="-2" width="${N + 4}" height="${N + 4}" fill="#fff"/><path d="${d}" fill="#1b1b1b"/></svg>`;
  }
  function startPix(d) {
    const amount = d.total.toFixed(2);
    const code = `00020126ILUSTRATIVO0014BR.GOV.BCB.PIX01${SETTINGS.pixKey.length}${SETTINGS.pixKey}520400005303986540${amount.length}${amount}5802BR59${SETTINGS.name.slice(0, 25)}6304${PZ.hash(amount + SETTINGS.pixKey).slice(0, 4).toUpperCase()}`;
    $('#pixCode').value = code; $('#pixQR').innerHTML = qrSVG(code); $('#pixAmount').textContent = money(d.total);
    PZ.track('Gerou o QR Code Pix');
    showStep('pix');
    let left = 15 * 60; stopPixTimer();
    const paint = () => { $('#pixTimer').textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`; };
    paint(); $('#btnPixPaid').disabled = false;
    pixTimer = setInterval(() => { left--; paint(); if (left <= 0) { stopPixTimer(); $('#pixTimer').textContent = 'expirado'; $('#btnPixPaid').disabled = true; } }, 1000);
  }
  function stopPixTimer() { if (pixTimer) { clearInterval(pixTimer); pixTimer = null; } }
  $('#btnCopyPix').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#pixCode').value); toast('Código Pix copiado!'); }
    catch (e) { $('#pixCode').select(); document.execCommand('copy'); toast('Código Pix copiado!'); }
    PZ.track('Copiou o código Pix');
  });
  $('#btnPixBack').addEventListener('click', () => { PZ.track('Voltou do Pix para editar o pedido'); showStep('form'); });
  $('#btnPixPaid').addEventListener('click', () => { if (pendingOrder) finalizeOrder(pendingOrder, true); });

  /* ---- Criação do pedido ---- */
  function finalizeOrder(d, paid) {
    const user = PZ.currentUser(); const cart = normalizeCart(); const now = Date.now();
    PZ.track(paid ? `Pagamento confirmado (${PZ.METHODS[d.method]})` : `Pedido enviado — pagar na ${d.mode === 'entrega' ? 'entrega' : 'retirada'}`);
    const order = {
      id: 'o' + now.toString(36) + Math.random().toString(36).slice(2, 5), number: PZ.nextNumber(), userId: user ? user.id : null, createdAt: now,
      customer: d.customer, mode: d.mode, payWhen: d.payWhen, method: d.method, cash: d.cash, card: d.card, obs: d.obs,
      items: cart.map(c => ({ id: c.id, name: c.name, cat: c.cat, size: c.size, sizeLabel: c.size ? PZ.SIZES[c.size] : '', edge: c.edge || null, edgeLabel: c.cat === 'pizza' ? (PZ.EDGES[c.edge || 'none'] || PZ.EDGES.none).label : '', qty: c.qty, price: c.price, obs: c.obs || '' })),
      subtotal: d.subtotal, fee: d.fee, total: d.total, paid, paidAt: paid ? now : null,
      status: 'novo', statusLog: [{ status: 'novo', t: now }], trail: PZ.consumeTrail()
    };
    PZ.addOrder(order); PZ.saveCart([]); knownStatus[order.id] = order.status; pendingOrder = null;
    ['#cardNumber', '#cardExp', '#cardCvv', '#cardName', '#coObs', '#coCashFor'].forEach(s => { $(s).value = ''; });
    $('#coNoChange').checked = false;
    renderCart(); renderDone(order); showStep('done');
  }

  function renderDone(o) {
    $('#doneTitle').textContent = `Pedido #${o.number} recebido!`;
    $('#doneSub').textContent = o.paid
      ? 'Pagamento confirmado. Nossa equipe já foi avisada e vai confirmar seu pedido em instantes.'
      : `Pedido enviado. O pagamento será feito na ${o.mode === 'entrega' ? 'entrega' : 'retirada'}. Aguarde a confirmação da loja.`;
    const c = o.customer;
    $('#doneBody').innerHTML = `<div class="verify">
      <div><h4>Cliente</h4><p><b>${esc(c.name)}</b><br>${esc(c.phone)}</p></div>
      <div><h4>${o.mode === 'entrega' ? 'Entrega em' : 'Retirada'}</h4><p>${o.mode === 'entrega' ? `${esc(c.rua)}, ${esc(c.numero)}<br>${esc(c.bairro)}${c.ref ? `<br><i>${esc(c.ref)}</i>` : ''}` : 'Na loja: ' + esc(SETTINGS.address)}</p></div>
      <div class="full"><h4>Itens</h4><ul>${o.items.map(i => `<li>${i.qty}× ${esc(i.name)}${i.size ? ` (${i.size})` : ''}${edgeText(i) ? ` + ${esc(edgeText(i))}` : ''} — ${money(i.price * i.qty)}${i.obs ? ` <i>(${esc(i.obs)})</i>` : ''}</li>`).join('')}</ul></div>
      <div><h4>Pagamento</h4><p>${esc(PZ.payWhenText(o))}<br><b>${esc(PZ.payDetail(o))}</b>${o.paid ? '<br><span class="ok"><b>✓ Pago</b></span>' : ''}</p></div>
      <div><h4>Total</h4><p><b style="font-size:1.3rem">${money(o.total)}</b>${o.fee ? `<br><small>inclui entrega de ${money(o.fee)}</small>` : ''}</p></div>
      ${o.obs ? `<div class="full"><h4>Observações</h4><p>${esc(o.obs)}</p></div>` : ''}
    </div>`;
  }

  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (!g) return;
    const go = g.dataset.go;
    if (go === 'orders') { closeModal('#checkoutModal'); openHistory(); }
    else if (go === 'menu') { closeModal('#checkoutModal'); location.hash = '#cardapio'; }
    else if (go === 'chat') { closeModal('#checkoutModal'); openChat(); }
  });

  /* ============================ Chat ============================ */
  const guest = PZ.guestId();
  const chatName = () => { const u = PZ.currentUser(); return u ? u.name : 'Visitante'; };
  const chatOpen = () => !$('#chatPanel').hidden;

  function renderChat() {
    const th = PZ.getChats()[guest]; const msgs = th ? th.messages : [];
    const box = $('#chatMsgs'); const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const greet = `<div class="msg them"><p>Olá! 👋 Bem-vindo à ${esc(SETTINGS.name)}. Como podemos ajudar?</p></div>`;
    box.innerHTML = greet + msgs.map(m => `<div class="msg ${m.from === 'client' ? 'me' : 'them'}"><p>${esc(m.text)}</p><time>${PZ.fmtTime(m.t)}</time></div>`).join('');
    if (nearBottom || chatOpen()) box.scrollTop = box.scrollHeight;
    let unread = th ? th.unreadClient : 0;
    if (chatOpen() && unread) { PZ.markRead(guest, 'client'); unread = 0; }
    $('#chatBadge').textContent = unread; $('#chatBadge').hidden = !unread;
  }
  function openChat() { $('#chatPanel').hidden = false; renderChat(); setTimeout(() => $('#chatInput').focus(), 50); }
  function closeChat() { $('#chatPanel').hidden = true; }
  $('#chatFab').addEventListener('click', () => (chatOpen() ? closeChat() : openChat()));
  $('#chatClose').addEventListener('click', closeChat);

  function sendChat(text) {
    text = text.trim(); if (!text) return;
    const th = PZ.getChats()[guest];
    const hadReply = th && th.messages.some(m => m.from !== 'client');
    PZ.sendMessage(guest, 'client', text, chatName());
    renderChat();
    if (!hadReply) setTimeout(() => { PZ.sendMessage(guest, 'bot', 'Recebemos sua mensagem! Um atendente vai responder por aqui em instantes. 🍕'); renderChat(); }, 700);
  }
  $('#chatForm').addEventListener('submit', e => { e.preventDefault(); const i = $('#chatInput'); sendChat(i.value); i.value = ''; });
  $('#chatQuick').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) sendChat(b.dataset.q); });

  /* ============================ Atualização em tempo real ============================ */
  function checkStatusChanges() {
    const u = PZ.currentUser(); if (!u) return;
    PZ.getOrders().filter(o => o.userId === u.id).forEach(o => {
      if (knownStatus[o.id] && knownStatus[o.id] !== o.status) toast(`Pedido #${o.number}: ${PZ.STATUS[o.status]}`);
      knownStatus[o.id] = o.status;
    });
  }
  window.addEventListener('storage', e => {
    if (!e.key || e.key === PZ.K.chats) renderChat();
    if (!e.key || e.key === PZ.K.orders) { checkStatusChanges(); if (!$('#historyModal').hidden) renderOrders(); }
    if (!e.key || e.key === PZ.K.settings) { hydrateSettings(); renderChat(); }
    if (!e.key || e.key === PZ.K.menu) { renderMenu(); renderCart(); }
  });

  /* ============================ Início ============================ */
  function init() {
    hydrateSettings();
    $('#heroPizza').innerHTML = PZ.heroPizza('pepperoni');
    $('#storyArt').insertAdjacentHTML('afterbegin', PZ.pizzaSVG('margherita', 'Pizza margherita'));
    $('#year').textContent = new Date().getFullYear();
    renderMenu(); renderCart(); updateAccountUI(); renderChat();
    PZ.getOrders().forEach(o => { knownStatus[o.id] = o.status; });
    if (!sessionStorage.getItem('pz_visit')) { sessionStorage.setItem('pz_visit', '1'); PZ.track('Entrou no site'); }

    $('#burger').addEventListener('click', () => { $('#siteHeader').classList.remove('hide'); const o = $('#nav').classList.toggle('open'); $('#burger').setAttribute('aria-expanded', o); });
    $('#nav').addEventListener('click', e => { if (e.target.tagName === 'A') $('#nav').classList.remove('open'); });
    // Cabeçalho: some ao rolar para baixo e volta ao rolar para cima
    const header = $('#siteHeader'); let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      const y = Math.max(0, window.scrollY);
      header.classList.toggle('scrolled', y > 8);
      if (y > lastY && y > 90 && !$('#nav').classList.contains('open')) header.classList.add('hide');
      else if (y < lastY || y <= 90) header.classList.remove('hide');
      lastY = y;
    }, { passive: true });
    header.addEventListener('focusin', () => header.classList.remove('hide'));

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .15 });
      $$('.reveal').forEach(el => io.observe(el));
    } else $$('.reveal').forEach(el => el.classList.add('in'));
  }
  init();
})();
