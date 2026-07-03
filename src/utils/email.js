const nodemailer = require('nodemailer');
const { logger } = require('./logger');

let transporter;

const initializeTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
};

const sendEmail = async ({ to, subject, html, text = null }) => {
  if (!process.env.SMTP_HOST) {
    logger.warn(`Email skipped (SMTP_HOST not configured): to="${to}", subject="${subject}"`);
    return null;
  }

  try {
    const transporter = initializeTransporter();
    
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@kVAssetTracker.com',
      to,
      subject,
      ...(html && { html }),
      ...(text && { text })
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Email sending failed: ${error.message}`);
    throw error;
  }
};

module.exports = { sendEmail };