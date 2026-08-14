import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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