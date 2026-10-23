# Pacotes de entregas pré-pagos (Pix)

Como a plataforma cobra as lojas: a loja compra um **pacote de entregas**, paga por **Pix** direto na chave do dono da plataforma, avisa que pagou e o admin confirma. Só então as entregas entram no saldo.

## Configuração (.env e Render)

Adicione no `.env` da API e nas variáveis de ambiente do Render:

```
# Chave Pix que recebe os pagamentos
PIX_KEY=sua-chave-pix                 # CPF/CNPJ só com números, e-mail, +5535999999999 ou chave aleatória
PIX_RECEIVER_NAME=Seu Nome            # aparece no app do banco de quem paga (máx. 25 caracteres)
PIX_RECEIVER_CITY=Sua Cidade          # máx. 15 caracteres
PIX_DESCRIPTION=Delivroo Express      # opcional

# Quem recebe o e-mail "pagamento informado" (pode ser mais de um, separados por vírgula)
ADMIN_NOTIFICATION_EMAIL=voce@exemplo.com
# Opcional: link do painel admin que vai no botão do e-mail
ADMIN_PANEL_URL=https://admin.seudominio.com.br/recargas
```

Sem `PIX_KEY`, `PIX_RECEIVER_NAME` e `PIX_RECEIVER_CITY`, a loja recebe "Pagamento indisponível" (HTTP 503) ao tentar comprar. Sem `ADMIN_NOTIFICATION_EMAIL`, o e-mail não é enviado (o aviso no painel funciona do mesmo jeito) e aparece um alerta no log da API.

Instale a dependência nova: `npm install` (adicionou o pacote `qrcode`).

## Regras

- **Pré-pago e sem validade.** O saldo é a soma de entregas grátis (promoção) + entregas compradas.
- **Gasto na conclusão da entrega.** Primeiro as grátis, depois as compradas. Entrega cancelada ou devolvida não gasta.
- **Bloqueio na hora.** Sem saldo, `POST /stores/deliveries` responde `402` com `code: INSUFFICIENT_CREDITS`. O saldo precisa cobrir também as entregas que já estão em andamento (`availableToRequest`).
- **Um pedido em aberto por loja.** Garantido por índice no banco.
- **"Já paguei" não libera nada.** Só avisa. O saldo só sobe quando o admin confirma.
- **Pacotes** são criados, editados, desabilitados e excluídos no admin. Cada pedido guarda uma cópia do pacote (nome, quantidade, preço), então editar ou excluir o pacote não muda pedidos antigos.
- **Extrato.** Toda entrada e saída do saldo comprado fica em `CreditTransaction` (compra, entrega, ajuste manual). Há índices únicos que impedem creditar a mesma recarga ou cobrar a mesma entrega duas vezes.

## Fluxo

1. Loja escolhe o pacote → `POST /stores/credits/orders` → recebe QR code e "Pix copia e cola" (pedido `pending`).
2. Loja paga no app do banco e clica em **Já paguei** → `POST /stores/credits/orders/:id/inform` (comprovante e observação opcionais) → pedido `informed`.
3. O admin recebe um e-mail e um destaque no painel (contador no menu e aviso em tempo real).
4. Admin confere o Pix no banco e **confirma** (`POST /admin/recharge-orders/:id/confirm`) ou **recusa** com motivo (`.../reject`). Confirmar credita o saldo e avisa a loja por e-mail e em tempo real.

Como conferir: o Pix é "estático", sem confirmação automática. Compare o **valor**, o **horário** e o **nome de quem pagou** com o pedido (código `R…`, valor do pacote, loja). O código do pedido vai como identificador no Pix, mas nem todo banco mostra esse campo para quem recebe.

## Eventos em tempo real (WebSocket)

O mesmo endereço do WebSocket aceita o token da loja ou o do admin (`?token=`).

- Admin recebe `recharge:informed` (loja clicou em "Já paguei") e `recharge:resolved` (outro admin confirmou/recusou).
- Loja recebe `credits:updated` (recarga confirmada ou recusada, ajuste do admin).

## Taxa por entrega e faturamento

`deliveryFee` (Settings) continua sendo o valor de tabela por entrega e é gravado em `delivery.platformFee`. Para entregas pagas com pacote (`paidWithCredit: true`) esse é o valor de tabela, não o que a loja efetivamente pagou: a receita real é a soma dos pedidos de recarga **confirmados** (`GET /admin/recharge-orders?status=confirmed`).

## Se algo falhar

- **Confirmar deu erro 500 "Não foi possível creditar":** o pedido volta ao estado anterior, é só tentar de novo.
- **Loja diz que pagou e o pedido sumiu da fila:** filtre por `status=confirmed` ou `rejected`.
- **Loja sem saldo logo após o deploy:** lojas antigas começam com `deliveryCredits: 0`. Dê uma cortesia pelo admin (`POST /admin/stores/:id/credits`) ou peça para comprarem um pacote.
