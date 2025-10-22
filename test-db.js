import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('Testing with URL:', process.env.DATABASE_URL);
  
  try {
    // Parse the connection string
    const url = process.env.DATABASE_URL.replace('mysql://', '');
    const [credentials, hostAndDb] = url.split('@');
    const [user, password] = credentials.split(':');
    const [hostPort, database] = hostAndDb.split('/');
    const [host, port] = hostPort.split(':');
    
    console.log('Connecting to:', {
      host,
      port: port || 3306,
      user,
      database,
      hasPassword: !!password
    });
    
    const connection = await mysql.createConnection({
      host: host || 'localhost',
      port: parseInt(port) || 3306,
      user: user || 'root',
      password: password || '',
      database
    });
    
    console.log('✅ Connected successfully!');
    await connection.end();
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    
    // Try without password if failed
    if (error.message.includes('Access denied')) {
      console.log('\nTrying without password...');
      try {
        const connection = await mysql.createConnection({
          host: '127.0.0.1',
          port: 3306,
          user: 'root',
          password: '',
          database: 'bonita'
        });
        console.log('✅ Connected without password!');
        console.log('Update your .env file to: DATABASE_URL="mysql://root@127.0.0.1:3306/bonita"');
        await connection.end();
      } catch (err) {
        console.error('Still failed:', err.message);
      }
    }
  }
}

testConnection();