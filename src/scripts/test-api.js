
import 'dotenv/config';

const BASE_URL = `http://localhost:${process.env.PORT || 8080}`;

async function test() {
  console.log('🧪 Testing Event Management API\n');
  console.log('=' .repeat(50));

  // Test 1: Health check
  console.log('\n1️⃣ Testing health endpoint...');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    console.log('✅ Health:', data.status);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    process.exit(1);
  }

  // Test 2: Login
  console.log('\n2️⃣ Testing login...');
  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@eventmanagement.com',
        password: 'Admin@123',
      }),
    });
    const data = await response.json();
    if (data.token) {
      console.log('✅ Login successful');
      console.log('   User:', data.user.username);
      console.log('   Role:', data.user.role);
    } else {
      console.log('❌ Login failed:', data.message);
    }
  } catch (error) {
    console.log('❌ Login failed:', error.message);
  }

  // Test 3: Get events
  console.log('\n3️⃣ Testing get events...');
  try {
    const response = await fetch(`${BASE_URL}/api/events`);
    const data = await response.json();
    console.log(`✅ Found ${data.length} events`);
  } catch (error) {
    console.log('❌ Get events failed:', error.message);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('✨ Tests completed!\n');
}

test();