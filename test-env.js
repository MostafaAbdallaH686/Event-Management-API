import dotenv from 'dotenv';
import fs from 'fs';

console.log('Before dotenv, DATABASE_URL:', process.env.DATABASE_URL);
dotenv.config({ path: './.env', override: true });
console.log('After dotenv, DATABASE_URL:', process.env.DATABASE_URL);

// Also print what’s literally in .env for comparison
const raw = fs.readFileSync('./.env', 'utf8');
console.log('\nRaw .env file contents:');
console.log(raw.split('\n').find(l => l.startsWith('DATABASE_URL')) || '(no DATABASE_URL line)');