import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const generateVerificationCode = () => {

    const  strRandomNumber = Math.random().toString();
    return strRandomNumber.substring(strRandomNumber.length-4);

}

const sendEmail = async (to, subject, body) => {

  const transporter = nodemailer.createTransport({
    pool: true,
    host: process.env.SMTP_HOST,
    port: 465,
    secure: true, // use TLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: to,
    subject: subject,
    text: body,
  };

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
      } else {
        console.log('Email sent:', info.response);
      }
    });

}

export const sendRiderVerificationAccountEmail = async(to,code) => {

  const subject = "Código de verificação Delivroo Express";
  const body = `Por favor, informe o seguinte código ${code} para ativar a sua conta no Delivroo Express e começar a receber pedidos de entregas.\nEsta é uma mensagem automática, não é necessário respondê-la.\n\nAtenciosamente\n\nEquipe Delivroo Express`;
  sendEmail(to, subject, body);
  
}

export const sendAccountVerifiedEmail = async(to,code) => {

   const subject = "Conta Ativada com Sucesso";
}