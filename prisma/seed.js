import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // Categories
  console.log('Creating categories...');
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Conference' },
      update: {},
      create: { name: 'Conference' },
    }),
    prisma.category.upsert({
      where: { name: 'Workshop' },
      update: {},
      create: { name: 'Workshop' },
    }),
    prisma.category.upsert({
      where: { name: 'Seminar' },
      update: {},
      create: { name: 'Seminar' },
    }),
    prisma.category.upsert({
      where: { name: 'Webinar' },
      update: {},
      create: { name: 'Webinar' },
    }),
    prisma.category.upsert({
      where: { name: 'Meetup' },
      update: {},
      create: { name: 'Meetup' },
    }),
  ]);
  console.log(`✅ ${categories.length} categories created\n`);

  // Users
  console.log('Creating users...');
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@eventmanagement.com' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@eventmanagement.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin: ${admin.email}`);

  const organizerPassword = await bcrypt.hash('Organizer@123', 10);
  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@eventmanagement.com' },
    update: {},
    create: {
      username: 'organizer',
      email: 'organizer@eventmanagement.com',
      passwordHash: organizerPassword,
      role: 'ORGANIZER',
    },
  });
  console.log(`✅ Organizer: ${organizer.email}`);

  const attendeePassword = await bcrypt.hash('Attendee@123', 10);
  const attendee = await prisma.user.upsert({
    where: { email: 'attendee@eventmanagement.com' },
    update: {},
    create: {
      username: 'attendee',
      email: 'attendee@eventmanagement.com',
      passwordHash: attendeePassword,
      role: 'ATTENDEE',
    },
  });
  console.log(`✅ Attendee: ${attendee.email}\n`);

  // Event
  console.log('Creating sample event...');
  const event = await prisma.event.create({
    data: {
      title: 'Tech Conference 2024',
      description: 'Annual technology conference',
      dateTime: new Date('2024-06-15T09:00:00Z'),
      location: 'San Francisco',
      maxAttendees: 100,
      paymentRequired: false,
      organizerId: organizer.id,
      categoryId: categories[0].id,
    },
  });
  console.log(`✅ Event: ${event.title}\n`);

  console.log('🎉 Seeding completed!\n');
  console.log('Test credentials:');
  console.log('  Admin:     admin@eventmanagement.com / Admin@123');
  console.log('  Organizer: organizer@eventmanagement.com / Organizer@123');
  console.log('  Attendee:  attendee@eventmanagement.com / Attendee@123\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });