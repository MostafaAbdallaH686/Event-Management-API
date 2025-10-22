import prisma from './src/prisma.js';

const main = async () => {
  // Create a test user
  const newUser = await prisma.user.create({
    data: {
      username: 'mostafa',
      email: 'mostafa@example.com',
      passwordHash: '123456',
    },
  });

  console.log('✅ User created:', newUser);

  // Fetch all users
  const users = await prisma.user.findMany();
  console.log('📦 All users:', users);
};

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });