import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Escapa texto vindo de usuários antes de entrar no HTML do e-mail (e as
// chaves, para um valor nunca virar outro marcador {{...}} do template).
export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');

const formatBRL = (value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const loadTemplate = (name, variables = {}) => {
  const filePath = path.join(__dirname, '../templates/emails', `${name}.html`);
  let html = fs.readFileSync(filePath, 'utf8');

  for (const [key, value] of Object.entries(variables)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }

  return html;
};

export const generateVerificationCode = () => {
  const strRandomNumber = Math.random().toString();
  return strRandomNumber.substring(strRandomNumber.length - 4);
};

const sendEmail = async (to, subject, html) => {
  const transporter = nodemailer.createTransport({
    pool: true,
    host: process.env.SMTP_HOST,
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const info = await transporter.sendMail({
    from: `"Delivroo Express" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });

  console.log('Email sent:', info.response);
  return info;
};

export const sendRiderVerificationAccountEmail = async (to, code) => {
  const html = loadTemplate('verification', { CODE: code });
  return sendEmail(to, 'Código de verificação — Delivroo Express', html);
};

export const sendStoreVerificationAccountEmail = async (to, code) => {
  const html = loadTemplate('verification.store', { CODE: code });
  return sendEmail(to, 'Código de verificação — Delivroo Express', html);
};

export const sendAccountVerifiedEmail = async (to) => {
  const html = loadTemplate('account-verified');
  return sendEmail(to, 'Conta ativada com sucesso — Delivroo Express', html);
};

export const sendStoreAccountVerifiedEmail = async (to) => {
  const html = loadTemplate('account-verified.store');
  return sendEmail(to, 'Conta ativada com sucesso — Delivroo Express', html);
};

export const sendRiderPasswordResetEmail = async (to, code) => {
  const html = loadTemplate('password-reset', { CODE: code });
  return sendEmail(to, 'Redefinição de senha — Delivroo Express', html);
}

export const sendStorePasswordResetEmail = async (to, code) => {
  const html = loadTemplate('password-reset', { CODE: code });
  return sendEmail(to, 'Redefinição de senha — Delivroo Express', html);
}

export const sendRiderAccountApprovedEmail = async (to, name) => {
  const html = loadTemplate('account-approved', { NAME: name || 'Entregador' });
  return sendEmail(to, 'Conta aprovada — Delivroo Express', html);
};

// Endereços que recebem os avisos do admin (ex.: "pagamento informado"),
// separados por vírgula em ADMIN_NOTIFICATION_EMAIL.
export const getAdminNotificationEmails = () =>
  (process.env.ADMIN_NOTIFICATION_EMAIL ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

// Avisa o admin geral que uma loja clicou em "Já paguei".
export const sendAdminRechargeInformedEmail = async ({ order, store }) => {
  const recipients = getAdminNotificationEmails();
  if (recipients.length === 0) {
    console.warn('ADMIN_NOTIFICATION_EMAIL não configurado: e-mail de pagamento informado não enviado.');
    return null;
  }

  const panelUrl = process.env.ADMIN_PANEL_URL || '#';
  const html = loadTemplate('recharge-informed.admin', {
    CODE: escapeHtml(order.code),
    PACKAGE: escapeHtml(order.package.name),
    DELIVERIES: escapeHtml(order.package.deliveries),
    PRICE: escapeHtml(formatBRL(order.package.price)),
    STORE_NAME: escapeHtml(store.name),
    STORE_EMAIL: escapeHtml(store.email),
    STORE_PHONE: escapeHtml(store.phone ?? '—'),
    NOTE: escapeHtml(order.payerNote || '—'),
    RECEIPT: order.receiptUrl
      ? `<a href="${escapeHtml(order.receiptUrl)}" style="color:#FF6B35;">Abrir comprovante</a>`
      : 'Não enviado',
    PANEL_URL: escapeHtml(panelUrl),
  });

  return sendEmail(
    recipients.join(', '),
    `Pagamento informado — ${store.name} (${order.code})`,
    html,
  );
};

export const sendStoreRechargeConfirmedEmail = async (to, { name, packageName, deliveries, balance }) => {
  const html = loadTemplate('recharge-confirmed.store', {
    NAME: escapeHtml(name),
    PACKAGE: escapeHtml(packageName),
    DELIVERIES: escapeHtml(deliveries),
    BALANCE: escapeHtml(balance),
  });
  return sendEmail(to, 'Recarga confirmada — Delivroo Express', html);
};

export const sendStoreRechargeRejectedEmail = async (to, { name, code, reason }) => {
  const html = loadTemplate('recharge-rejected.store', {
    NAME: escapeHtml(name),
    CODE: escapeHtml(code),
    REASON: escapeHtml(reason),
  });
  return sendEmail(to, 'Recarga não confirmada — Delivroo Express', html);
};
