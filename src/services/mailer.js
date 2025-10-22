import { createTransport, createTestAccount, getTestMessageUrl } from 'nodemailer';

let transporter;

export async function initMailer() {
  console.log('Initializing mailer...');
  
  try {
    if (process.env.SMTP_HOST) {
      transporter = createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        } : undefined,
      });
      await transporter.verify();
    } else if (process.env.NODE_ENV!== 'production') {
      const test = await createTestAccount();
      transporter = createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user: test.user, pass: test.pass },
      });
      console.log(' Ethereal mailer ready:', test.user);
    } else {
      console.log(' No mailer configured');
    }
  } catch (e) {
    console.error(' Mailer initialization failed:', e);
    // This is the crucial change: throw the error to stop the server startup
    throw new Error('Mailer failed to initialize. Server will not start.');
  }
}
export async function sendMail({ to, subject, html, text, from }) {
  // Check if disabled
  if (process.env.MAIL_DISABLE === 'true') {
    console.log('[MAIL_DISABLED by env] Would send:', { to, subject });
    return;
  }
  
  // Check if transporter exists
  if (!transporter) {
    console.log('[MAIL_DISABLED no transporter] Would send:', { to, subject });
    return;
  }
  
  try {
    const info = await transporter.sendMail({
      from: from || process.env.EMAIL_FROM || 'no-reply@localhost',
      to, 
      subject, 
      html, 
      text,
    });
    
    console.log('✉️ Email sent successfully to:', to);
    console.log('Message ID:', info.messageId);
    
    const url = getTestMessageUrl(info);
    if (url) console.log('📬 Preview URL:', url);
    
    return info;
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
}

export function registrationEmail({ username, eventTitle, dateTime }) {
  return {
    subject: `Registration confirmed: ${eventTitle}`,
    html: `<p>Hi ${username},</p>
           <p>You are registered for <b>${eventTitle}</b> on <b>${new Date(dateTime).toLocaleString()}</b>.</p>
           <p>See you there!</p>`,
  };
}