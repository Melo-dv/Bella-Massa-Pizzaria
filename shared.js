/* =====================================================================
   shared.js — Dados, armazenamento (localStorage) e ilustrações.
   Usado por index.html (cliente) e admin.html (painel da loja).

   >>> PARA ADAPTAR A OUTRA PIZZARIA: edite DEFAULT_SETTINGS e MENU abaixo.
   ===================================================================== */
const PZ = (() => {
  'use strict';

  /* ---------- Chaves do localStorage ---------- */
  const K = {
    users: 'pz_users', session: 'pz_session', cart: 'pz_cart', orders: 'pz_orders',
    chats: 'pz_chats', settings: 'pz_settings', menu: 'pz_menu', guest: 'pz_guest',
    seq: 'pz_seq', trail: 'pz_trail'
  };

  /* ---------- Configurações padrão da loja (editáveis no admin) ---------- */
  const DEFAULT_SETTINGS = {
    name: 'Bella Massa Pizzaria',
    phone: '(00) 90000-0000',
    address: 'Rua das Oliveiras, 123 — Centro',
    hours: 'Terça a domingo · 18h às 23h30',
    deliveryFee: 6,
    pixKey: 'contato@bellamassa.com.br',
    adminPass: 'admin123'
  };

  /* ---------- CARDÁPIO-BASE ---------- */
  const SIZES = { P: 'Pequena · 4 fatias', M: 'Média · 6 fatias', G: 'Grande · 8 fatias' };

  // Bordas recheadas das pizzas (preço adicional em R$ — edite aqui)
  const EDGES = {
    none:     { label: 'Sem borda',         price: 0 },
    catupiry: { label: 'Borda de Catupiry', price: 8 },
    cheddar:  { label: 'Borda de Cheddar',  price: 8 }
  };

  const MENU = [
    { id: 'calabresa', cat: 'pizza', group: 'Tradicionais', name: 'Calabresa', badge: 'Mais pedida',
      desc: 'Calabresa fatiada, cebola roxa, mussarela e azeitonas pretas.', prices: { P: 32, M: 44, G: 56 }, art: 'calabresa' },
    { id: 'mussarela', cat: 'pizza', group: 'Tradicionais', name: 'Mussarela',
      desc: 'Mussarela generosa, rodelas de tomate e orégano.', prices: { P: 30, M: 41, G: 52 }, art: 'mussarela' },
    { id: 'margherita', cat: 'pizza', group: 'Tradicionais', name: 'Margherita', badge: 'Vegetariana',
      desc: 'Molho artesanal, mussarela de búfala, tomate e manjericão fresco.', prices: { P: 36, M: 48, G: 60 }, art: 'margherita' },
    { id: 'portuguesa', cat: 'pizza', group: 'Tradicionais', name: 'Portuguesa',
      desc: 'Presunto, ovos, cebola, pimentão, azeitonas e mussarela.', prices: { P: 36, M: 49, G: 62 }, art: 'portuguesa' },
    { id: 'frango', cat: 'pizza', group: 'Especiais', name: 'Frango com Catupiry',
      desc: 'Frango desfiado temperado, milho e catupiry cremoso.', prices: { P: 36, M: 49, G: 62 }, art: 'frango' },
    { id: 'quatroqueijos', cat: 'pizza', group: 'Especiais', name: 'Quatro Queijos',
      desc: 'Mussarela, parmesão, provolone e gorgonzola.', prices: { P: 38, M: 52, G: 66 }, art: 'quatroqueijos' },
    { id: 'pepperoni', cat: 'pizza', group: 'Especiais', name: 'Pepperoni', badge: 'Favorita da casa',
      desc: 'Pepperoni crocante nas bordas, mussarela e toque de orégano.', prices: { P: 40, M: 54, G: 68 }, art: 'pepperoni' },
    { id: 'chocolate', cat: 'pizza', group: 'Doces', name: 'Chocolate com Morango', badge: 'Doce',
      desc: 'Chocolate ao leite derretido, morangos frescos e fio de chocolate branco.', prices: { P: 34, M: 46, G: 58 }, art: 'chocolate' },

    { id: 'cola2l', cat: 'bebida', name: 'Refrigerante Cola 2L', desc: 'Bem gelado, ideal para dividir.', price: 14, art: 'cola2l' },
    { id: 'guarana2l', cat: 'bebida', name: 'Refrigerante Guaraná 2L', desc: 'O clássico brasileiro.', price: 13, art: 'guarana2l' },
    { id: 'colalata', cat: 'bebida', name: 'Refrigerante Cola Lata 350ml', desc: 'Lata individual gelada.', price: 6.5, art: 'colalata' },
    { id: 'suco', cat: 'bebida', name: 'Suco de Laranja 500ml', desc: 'Natural, feito na hora.', price: 9, art: 'suco' },
    { id: 'agua', cat: 'bebida', name: 'Água Mineral 500ml', desc: 'Sem gás.', price: 4, art: 'agua' },
    { id: 'cerveja', cat: 'bebida', name: 'Cerveja Pilsen Long Neck', desc: 'Venda proibida para menores de 18 anos.', price: 10, art: 'cerveja' }
  ];

  const METHODS = { pix: 'Pix', credito: 'Cartão de crédito', debito: 'Cartão de débito', dinheiro: 'Dinheiro' };
  const METHOD_ICON = { pix: '🔷', credito: '💳', debito: '💳', dinheiro: '💵' };
  const STATUS = {
    novo: 'Aguardando confirmação', preparo: 'Em preparo', saiu: 'Saiu para entrega',
    pronto: 'Pronto para retirada', concluido: 'Concluído', cancelado: 'Cancelado'
  };

  /* ---------- Utilidades ---------- */
  const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');
  const pad = n => String(n).padStart(2, '0');
  const fmtTime = (t, sec) => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + (sec ? ':' + pad(d.getSeconds()) : ''); };
  const fmtDate = t => { const d = new Date(t); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' às ' + fmtTime(t); };

  // Hash simples (DEMONSTRAÇÃO). Em produção use um backend com bcrypt/argon2.
  const hash = (str, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  };

  // Gerador pseudo-aleatório com semente (desenhos sempre iguais)
  function rngFrom(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ---------- Configurações e cardápio ---------- */
  const getSettings = () => ({ ...DEFAULT_SETTINGS, ...read(K.settings, {}) });
  const saveSettings = s => write(K.settings, s);

  function getMenu() {
    const ov = read(K.menu, {});
    return MENU.map(it => {
      const o = ov[it.id] || {};
      return {
        ...it,
        prices: it.prices ? { ...it.prices, ...(o.prices || {}) } : undefined,
        price: it.price != null ? (o.price ?? it.price) : undefined,
        available: o.available !== false
      };
    });
  }

  /* ---------- Contas de clientes ---------- */
  const users = () => read(K.users, []);
  function register({ name, email, phone, password }) {
    email = String(email || '').trim().toLowerCase();
    if (!name || name.trim().length < 2) return { error: 'Informe seu nome.' };
    if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'E-mail inválido.' };
    if ((password || '').length < 6) return { error: 'A senha precisa ter pelo menos 6 caracteres.' };
    const list = users();
    if (list.some(u => u.email === email)) return { error: 'Este e-mail já está cadastrado. Entre na sua conta.' };
    const u = { id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: name.trim(), email, phone: (phone || '').trim(), pass: hash(password), createdAt: Date.now() };
    list.push(u); write(K.users, list); write(K.session, u.id);
    return { user: u };
  }
  function login(email, password) {
    email = String(email || '').trim().toLowerCase();
    const u = users().find(x => x.email === email && x.pass === hash(password || ''));
    if (!u) return { error: 'E-mail ou senha incorretos.' };
    write(K.session, u.id);
    return { user: u };
  }
  const logout = () => localStorage.removeItem(K.session);
  const currentUser = () => { const id = read(K.session, null); return users().find(u => u.id === id) || null; };

  /* ---------- Carrinho ---------- */
  const getCart = () => read(K.cart, []);
  const saveCart = c => write(K.cart, c);

  /* ---------- Pedidos ---------- */
  const getOrders = () => read(K.orders, []);
  function nextNumber() { const n = read(K.seq, 1000) + 1; write(K.seq, n); return n; }
  function addOrder(o) { const l = getOrders(); l.push(o); write(K.orders, l); return o; }
  function setStatus(id, status, note) {
    const l = getOrders(); const o = l.find(x => x.id === id); if (!o) return null;
    o.status = status; (o.statusLog = o.statusLog || []).push({ status, t: Date.now(), note: note || '' });
    write(K.orders, l); return o;
  }

  /* ---------- "Trilha" do cliente até o pagamento ---------- */
  function track(label) { const t = read(K.trail, []); t.push({ t: Date.now(), label }); write(K.trail, t.slice(-80)); }
  function consumeTrail() { const t = read(K.trail, []); localStorage.removeItem(K.trail); return t; }

  /* ---------- Chat ---------- */
  const getChats = () => read(K.chats, {});
  function sendMessage(tid, from, text, name) {
    const all = getChats();
    const th = all[tid] || (all[tid] = { id: tid, name: name || 'Visitante', messages: [], unreadAdmin: 0, unreadClient: 0 });
    if (name) th.name = name;
    th.messages.push({ from, text, t: Date.now() });
    th.updated = Date.now();
    if (from === 'client') th.unreadAdmin++;
    if (from === 'admin') th.unreadClient++;
    write(K.chats, all);
  }
  function markRead(tid, who) {
    const all = getChats(); const th = all[tid]; if (!th) return;
    const key = who === 'admin' ? 'unreadAdmin' : 'unreadClient';
    if (!th[key]) return;
    th[key] = 0; write(K.chats, all);
  }
  function guestId() {
    let g = read(K.guest, null);
    if (!g) { g = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); write(K.guest, g); }
    return g;
  }

  /* ---------- Textos de pagamento (cliente e admin usam os mesmos) ---------- */
  const payWhenText = o => o.payWhen === 'site' ? 'Pagamento pelo site' : (o.mode === 'entrega' ? 'Pagar na entrega' : 'Pagar na retirada');
  function payDetail(o) {
    let s = METHODS[o.method] || o.method || '—';
    if (o.method === 'dinheiro' && o.cash) {
      s += o.cash.noChange ? ' (sem troco)' : ` — troco para ${money(o.cash.payWith)} (devolver ${money(o.cash.change)})`;
    }
    if (o.card && o.card.last4) s += ` · ${o.card.brand} final ${o.card.last4}`;
    return s;
  }

  /* =====================================================================
     ILUSTRAÇÕES (SVG gerado por código — substitua por fotos reais depois)
     ===================================================================== */
  let uidCounter = 0;
  const f1 = n => (+n).toFixed(1);

  function scatter(n, R, minD, rnd) {
    const pts = []; let tries = 0;
    while (pts.length < n && tries < 3000) {
      tries++;
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * R;
      const x = 150 + Math.cos(a) * r, y = 150 + Math.sin(a) * r;
      if (pts.every(p => Math.hypot(p.x - x, p.y - y) >= minD)) pts.push({ x, y, rot: rnd() * 360, s: 0.88 + rnd() * 0.26 });
    }
    return pts;
  }
  const place = (pts, draw) => pts.map(p => `<g transform="translate(${f1(p.x)} ${f1(p.y)}) rotate(${f1(p.rot)}) scale(${f1(p.s)})">${draw(p)}</g>`).join('');
  function speckle(n, R, color, rnd, w = 2.4, h = 1) {
    let out = '';
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.283, r = Math.sqrt(rnd()) * R, x = 150 + Math.cos(a) * r, y = 150 + Math.sin(a) * r;
      out += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${w}" ry="${h}" fill="${color}" transform="rotate(${(rnd() * 180) | 0} ${f1(x)} ${f1(y)})"/>`;
    }
    return out;
  }
  const sector = (a0, a1, R, fill) => {
    const p = a => [150 + Math.cos(a) * R, 150 + Math.sin(a) * R];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `<path d="M150 150L${f1(x0)} ${f1(y0)}A${R} ${R} 0 0 1 ${f1(x1)} ${f1(y1)}Z" fill="${fill}"/>`;
  };

  const LEAF = '<path d="M0-13C11-9 12 9 0 15C-12 9-11-9 0-13Z" fill="#3f9a3a"/><path d="M0-11V13" stroke="#2a6a27" stroke-width="1.3"/>';
  const OLIVE = '<circle r="6.2" fill="#262626"/><circle r="2.4" fill="#f3d67a"/>';

  // Desenho de uma pizza inteira (círculo de 300x300, centro 150,150)
  function pizzaInner(type, uid) {
    const rnd = rngFrom('pz-' + type);
    const g = n => `${n}-${uid}`;
    let s = `<defs>
      <radialGradient id="${g('cr')}" cx="50%" cy="45%" r="58%"><stop offset="72%" stop-color="#e6aa58"/><stop offset="100%" stop-color="#b8681d"/></radialGradient>
      <radialGradient id="${g('ch')}" cx="45%" cy="42%" r="62%"><stop offset="0%" stop-color="#fde9a0"/><stop offset="100%" stop-color="#efbb45"/></radialGradient>
      <radialGradient id="${g('cc')}" cx="45%" cy="40%" r="62%"><stop offset="0%" stop-color="#6b3620"/><stop offset="100%" stop-color="#3e1d10"/></radialGradient>
    </defs>`;
    s += `<circle cx="150" cy="150" r="142" fill="url(#${g('cr')})"/>`;
    for (let i = 0; i < 26; i++) { const a = rnd() * 6.283; s += `<circle cx="${f1(150 + Math.cos(a) * 133)}" cy="${f1(150 + Math.sin(a) * 133)}" r="${f1(2 + rnd() * 4)}" fill="#c9792b" opacity=".55"/>`; }

    if (type === 'chocolate') {
      s += `<circle cx="150" cy="150" r="124" fill="#5b2d19"/><circle cx="150" cy="150" r="119" fill="url(#${g('cc')})"/>`;
    } else {
      s += `<circle cx="150" cy="150" r="124" fill="#c43b27"/><circle cx="150" cy="150" r="119" fill="url(#${g('ch')})"/>`;
      for (let i = 0; i < 16; i++) {
        const p = scatter(1, 100, 0, rnd)[0];
        s += `<ellipse cx="${f1(p.x)}" cy="${f1(p.y)}" rx="${f1(8 + rnd() * 12)}" ry="${f1(5 + rnd() * 8)}" fill="${rnd() > .5 ? '#fff0b8' : '#e9b03c'}" opacity=".5" transform="rotate(${f1(p.rot)} ${f1(p.x)} ${f1(p.y)})"/>`;
      }
    }

    switch (type) {
      case 'calabresa':
        s += place(scatter(15, 98, 30, rnd), () => '<circle r="15" fill="#b5503a"/><circle r="12" fill="none" stroke="#8d3624" stroke-width="1.5"/><circle cx="-4" cy="-3" r="1.8" fill="#e29a7e"/><circle cx="5" cy="3" r="1.6" fill="#e29a7e"/><circle cx="3" cy="-6" r="1.4" fill="#e29a7e"/>');
        s += place(scatter(14, 104, 22, rnd), () => '<path d="M-13 0A13 13 0 0 1 13 0" fill="none" stroke="#efe3f3" stroke-width="3" stroke-linecap="round"/>');
        s += place(scatter(7, 104, 24, rnd), () => OLIVE);
        break;
      case 'mussarela':
        s += place(scatter(8, 95, 32, rnd), () => '<circle r="15" fill="#d8402b"/><circle r="11.5" fill="#ee6b52"/><circle cx="-3" cy="-2" r="1.3" fill="#f8d98f"/><circle cx="3" cy="3" r="1.3" fill="#f8d98f"/>');
        s += speckle(70, 108, '#4c8a3a', rnd);
        break;
      case 'margherita':
        s += `<circle cx="150" cy="150" r="117" fill="#cf3b27" opacity=".9"/>`;
        s += place(scatter(9, 92, 33, rnd), () => '<circle r="18" fill="#fffaf0"/><circle cx="-4" cy="-4" r="10" fill="#fff"/><circle cx="5" cy="5" r="4" fill="#f6ecd2"/>');
        s += place(scatter(9, 100, 26, rnd), () => LEAF);
        s += speckle(30, 105, '#e9b03c', rnd, 3, 1.2);
        break;
      case 'portuguesa':
        s += place(scatter(7, 96, 34, rnd), () => '<rect x="-14" y="-9" width="28" height="18" rx="5" fill="#f0a3a3" stroke="#d97c7c" stroke-width="1.5"/>');
        s += place(scatter(4, 88, 44, rnd), () => '<circle r="14" fill="#fff"/><circle r="5.5" fill="#f5b82e"/><circle cx="-1.5" cy="-1.5" r="1.6" fill="#fde28a"/>');
        s += place(scatter(9, 104, 22, rnd), () => '<path d="M-13 0A13 13 0 0 1 13 0" fill="none" stroke="#3f9a3a" stroke-width="4" stroke-linecap="round"/>');
        s += place(scatter(9, 104, 22, rnd), () => '<path d="M-12 0A12 12 0 0 1 12 0" fill="none" stroke="#efe3f3" stroke-width="2.6" stroke-linecap="round"/>');
        s += place(scatter(7, 104, 24, rnd), () => OLIVE);
        break;
      case 'frango':
        s += place(scatter(15, 100, 24, rnd), () => '<ellipse rx="13" ry="8.5" fill="#ecd0a0" stroke="#c79c5a" stroke-width="1.4"/><path d="M-6-2Q0-5 6-1" stroke="#d9b57a" stroke-width="1.5" fill="none"/>');
        s += place(scatter(7, 95, 34, rnd), () => '<circle r="10" fill="#fffbe9"/><ellipse cx="-3" cy="-3" rx="5" ry="3" fill="#fff"/>');
        s += speckle(34, 105, '#f6c21a', rnd, 3, 3);
        s += speckle(26, 108, '#4c8a3a', rnd);
        break;
      case 'quatroqueijos': {
        const cols = ['#f7de92', '#fbf1cf', '#f2b052', '#ece2c3'];
        for (let i = 0; i < 4; i++) s += sector(i * Math.PI / 2, (i + 1) * Math.PI / 2, 117, cols[i]);
        s += '<path d="M150 33V267M33 150H267" stroke="#d99a2e" stroke-width="1.5" opacity=".5"/>';
        for (let i = 0; i < 18; i++) {
          const a = Math.PI / 2 + rnd() * Math.PI / 2, r = 14 + Math.sqrt(rnd()) * 92, x = 150 + Math.cos(a) * r, y = 150 + Math.sin(a) * r;
          s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${f1(3 + rnd() * 4)}" ry="${f1(2 + rnd() * 3)}" fill="#7c93bf" opacity=".85"/>`;
        }
        s += place(scatter(4, 90, 50, rnd), () => LEAF);
        s += speckle(34, 108, '#4c8a3a', rnd);
        break;
      }
      case 'pepperoni':
        s += place(scatter(17, 100, 29, rnd), () => '<circle r="17" fill="#a82019"/><circle r="15" fill="#c8352a"/><circle cx="-5" cy="-4" r="2" fill="#8a1812"/><circle cx="5" cy="4" r="2.2" fill="#8a1812"/><circle cx="4" cy="-6" r="1.6" fill="#8a1812"/><path d="M-10-6A12 12 0 0 1 2-12" stroke="#ec7466" stroke-width="2" fill="none" opacity=".7"/>');
        s += place(scatter(5, 100, 50, rnd), () => LEAF);
        s += speckle(40, 108, '#4c8a3a', rnd);
        break;
      case 'chocolate':
        for (let i = 0; i < 7; i++) { const a = rnd() * 6.283, r = 40 + rnd() * 50; s += `<path d="M${f1(150 + Math.cos(a) * r)} ${f1(150 + Math.sin(a) * r)}q${(rnd() * 50 - 25) | 0} ${(rnd() * 50 - 25) | 0} ${(rnd() * 60 - 30) | 0} ${(rnd() * 60 - 30) | 0}" stroke="#8a5233" stroke-width="3" fill="none" opacity=".55" stroke-linecap="round"/>`; }
        s += place(scatter(9, 92, 34, rnd), () => '<path d="M0-13C15-13 16 4 0 16C-16 4-15-13 0-13Z" fill="#d7263d"/><path d="M-7-12L0-19L7-12L0-9Z" fill="#3b8f3b"/><circle cx="-5" cy="-3" r="1" fill="#ffd9d0"/><circle cx="4" cy="-4" r="1" fill="#ffd9d0"/><circle cx="0" cy="3" r="1" fill="#ffd9d0"/><circle cx="-4" cy="7" r="1" fill="#ffd9d0"/><circle cx="5" cy="5" r="1" fill="#ffd9d0"/>');
        for (let i = 0; i < 6; i++) s += `<path d="M62 ${96 + i * 22}q20-14 40 0t40 0t40 0t40 0" stroke="#fff1dc" stroke-width="2.4" fill="none" opacity=".85" stroke-linecap="round"/>`;
        s += speckle(40, 108, '#2a130a', rnd, 2.6, 1.2);
        break;
    }
    return s;
  }

  // Pizza em prato de madeira (usada no cardápio)
  function pizzaSVG(type, label) {
    const uid = 'p' + (++uidCounter);
    return `<svg viewBox="-12 -12 324 324" role="img" aria-label="${esc(label || 'Pizza ' + type)}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="150" cy="150" r="158" fill="#7a4a24"/><circle cx="150" cy="150" r="150" fill="#8d5a2b"/>
      <path d="M40 60Q150 20 260 60M20 150Q150 110 280 150M40 240Q150 280 260 240" stroke="#7a4a24" stroke-width="3" fill="none" opacity=".5"/>
      ${pizzaInner(type, uid)}</svg>`;
  }

  // 8 fatias separadas, cada uma recortada da mesma pizza (usada na animação do topo)
  function heroPizza(type = 'pepperoni', n = 8) {
    let out = '';
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2, am = (a0 + a1) / 2, R = 146;
      const p = a => [f1(150 + Math.cos(a) * R), f1(150 + Math.sin(a) * R)];
      const [x0, y0] = p(a0), [x1, y1] = p(a1);
      const d = `M150 150L${x0} ${y0}A${R} ${R} 0 0 1 ${x1} ${y1}Z`;
      out += `<svg class="slice" viewBox="0 0 300 300" aria-hidden="true" style="--i:${i};--dx:${Math.cos(am).toFixed(3)};--dy:${Math.sin(am).toFixed(3)};--rot:${i % 2 ? 5 : -5}">
        <defs><clipPath id="wedge-${i}"><path d="${d}"/></clipPath></defs>
        <g clip-path="url(#wedge-${i})">${pizzaInner(type, 'h' + i)}</g>
        <path d="${d}" fill="none" stroke="rgba(90,40,10,.55)" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
    }
    return out;
  }

  function drinkSVG(kind) {
    const T = (txt, fs, y) => `<text x="100" y="${y}" text-anchor="middle" font-family="Nunito,Arial,sans-serif" font-weight="800" font-size="${fs}" fill="#fff">${txt}</text>`;
    const bottle = (liquid, cap, label, text, fs) => `
      <path d="M86 28H114V54C114 72 136 82 136 108V200Q136 212 124 212H76Q64 212 64 200V108C64 82 86 72 86 54Z" fill="${liquid}"/>
      <rect x="84" y="14" width="32" height="14" rx="3" fill="${cap}"/>
      <rect x="64" y="120" width="72" height="56" fill="${label}"/>${T(text, fs, 154)}
      <path d="M75 112V200" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round"/>`;
    const can = (color, text, fs) => `
      <rect x="64" y="38" width="72" height="172" rx="9" fill="${color}"/>
      <ellipse cx="100" cy="40" rx="36" ry="8" fill="#d3d7da"/><ellipse cx="100" cy="39" rx="28" ry="5" fill="#9aa1a6"/>
      <rect x="64" y="92" width="72" height="62" fill="#fff" fill-opacity=".92"/>
      <text x="100" y="131" text-anchor="middle" font-family="Nunito,Arial,sans-serif" font-weight="800" font-size="${fs}" fill="${color}">${text}</text>
      <path d="M74 54V200" stroke="#fff" stroke-opacity=".3" stroke-width="5" stroke-linecap="round"/>`;
    let inner = '';
    switch (kind) {
      case 'cola2l': inner = bottle('#2b120b', '#c8321e', '#c8321e', 'COLA', 17); break;
      case 'guarana2l': inner = bottle('#c97a1a', '#2f7d4f', '#2f7d4f', 'GUARANÁ', 12.5); break;
      case 'agua': inner = bottle('#bfe5f5', '#1b74c9', '#1b74c9', 'ÁGUA', 17); break;
      case 'colalata': inner = can('#c8321e', 'COLA', 17); break;
      case 'suco': inner = `
        <path d="M58 70H142L132 205Q131 214 122 214H78Q69 214 68 205Z" fill="#ffe9c4" fill-opacity=".7" stroke="#fff" stroke-width="2"/>
        <path d="M62 100H138L131 205Q130 212 122 212H78Q70 212 69 205Z" fill="#f79a1e"/>
        <path d="M96 30L108 150" stroke="#c8321e" stroke-width="6" stroke-linecap="round"/>
        <circle cx="140" cy="72" r="24" fill="#f6a21f"/><circle cx="140" cy="72" r="19" fill="#ffc45a"/>
        <path d="M140 53V91M121 72H159M127 59L153 85M153 59L127 85" stroke="#f6a21f" stroke-width="2"/>
        <path d="M72 108V196" stroke="#fff" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>`; break;
      case 'cerveja': inner = `
        <path d="M92 20H108V42C108 62 114 68 114 92V200Q114 212 104 212H96Q86 212 86 200V92C86 68 92 62 92 42Z" fill="#7a3f0a"/>
        <rect x="90" y="12" width="20" height="10" rx="2" fill="#e0a526"/>
        <rect x="86" y="118" width="28" height="52" fill="#f2c24a"/>
        <text x="100" y="148" text-anchor="middle" font-family="Nunito,Arial,sans-serif" font-weight="800" font-size="8" fill="#7a3f0a">PILSEN</text>
        <path d="M92 100V200" stroke="#fff" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/>`; break;
    }
    return `<svg viewBox="0 0 200 240" role="img" aria-label="Bebida" xmlns="http://www.w3.org/2000/svg"><ellipse cx="100" cy="222" rx="58" ry="9" fill="rgba(0,0,0,.2)"/>${inner}</svg>`;
  }

  return {
    K, SIZES, EDGES, MENU, METHODS, METHOD_ICON, STATUS, read, write, esc, money, fmtTime, fmtDate, hash, rngFrom,
    getSettings, saveSettings, getMenu, users, register, login, logout, currentUser,
    getCart, saveCart, getOrders, nextNumber, addOrder, setStatus, track, consumeTrail,
    getChats, sendMessage, markRead, guestId, payWhenText, payDetail, pizzaSVG, drinkSVG, heroPizza
  };
})();
