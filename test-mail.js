import dotenv from 'dotenv';
dotenv.config();

console.log('ENV CHECK:');
console.log('MAIL_DISABLE:', process.env.MAIL_DISABLE);
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_USER:', process.env.SMTP_USER);

import { initMailer, sendMail } from './src/services/mailer.js';

async function test() {
  await initMailer();
  
  if (process.env.MAIL_DISABLE === 'false') {
    const result = await sendMail({
      to: 'mostafaabdallah686@gmail.com',
      subject: 'Test Email from Event App',
      html: '<h1>It works!</h1>',
    });
    console.log('Result:', result);
  }
}

test().catch(console.error);