# Pizzaria — site modelo (HTML + CSS + JavaScript)

## Como abrir no VS Code
1. Abra a pasta `pizzaria` no VS Code (Arquivo > Abrir Pasta).
2. Instale a extensão **Live Server** (Ritwick Dey), clique com o botão direito em `index.html` > **Open with Live Server**.
   (Também funciona dando duplo clique no `index.html`.)
3. Painel da loja: abra `admin.html` — senha inicial: **admin123**.
4. Para testar o fluxo completo: abra o site, crie uma conta, faça um pedido e veja-o aparecer na aba **Atendimento** do painel (em outra aba do mesmo navegador, em tempo real).

## Arquivos
- `index.html` — site do cliente · `admin.html` — painel da loja
- `css/style.css`, `css/admin.css` — estilos (cores no topo, em `:root`)
- `js/shared.js` — **cardápio, configurações padrão, ilustrações SVG**, armazenamento
- `js/app.js` — lógica do cliente · `js/admin.js` — lógica do painel

## Como adaptar para outra pizzaria
- Nome, telefone, endereço, horário, taxa, chave Pix, senha: pelo painel > **Configurações** (ou `DEFAULT_SETTINGS` em `shared.js`).
- Sabores e preços: array `MENU` em `js/shared.js`.
- Bordas (Sem borda / Catupiry / Cheddar) e o valor adicional de cada uma: objeto `EDGES` em `js/shared.js`.
- Cores: variáveis `--red`, `--gold`, `--ink`, `--cream` no início de `css/style.css` e `css/admin.css`.
- Fotos reais: em `app.js`, nas funções `pizzaCard` / `drinkCard`, troque `PZ.pizzaSVG(...)` por `<img src="img/calabresa.jpg" alt="...">`.
- Textos de "Nossa história" e "Contato": direto no `index.html`.

## IMPORTANTE antes de vender (limites desta versão)
Tudo é **front-end puro**: os dados ficam no `localStorage` do navegador. Por isso cliente e painel só se enxergam no **mesmo navegador/computador**. Para uso real é preciso:
1. **Backend + banco de dados** (Node/Express, PHP, Firebase, Supabase…) para contas, pedidos e chat compartilhados entre aparelhos; senhas com bcrypt/argon2 e login do admin no servidor.
2. **Gateway de pagamento** (Mercado Pago, Stripe, Pagar.me, Asaas…) para Pix e cartão reais. Hoje o QR Code Pix é ilustrativo e há um botão "Simular pagamento aprovado". Os dados do cartão **não são guardados** (só bandeira e final), e nunca devem passar pelo seu servidor sem um gateway certificado (PCI).
3. Apagar os dados de teste: painel > Configurações > "Apagar pedidos, conversas e contas".
