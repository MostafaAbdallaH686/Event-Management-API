// reset-password.js
import prisma from './src/prisma.js';
import bcrypt from 'bcryptjs';

async function resetPassword(email, newPassword) {
  try {
    // Find the user
    const user = await prisma.users.findUnique({
      where: { email }
    });
    
    if (!user) {
      console.log('User not found:', email);
      return;
    }
    
    console.log('Found user:', {
      id: user.id,
      email: user.email,
      username: user.username,
      currentHashLength: user.passwordHash.length
    });
    
    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Update the user's password
    const updated = await prisma.users.update({
      where: { email },
      data: { passwordHash }
    });
    
    console.log('Password updated for:', updated.email);
    
    // Test the password
    const isValid = await bcrypt.compare(newPassword, passwordHash);
    console.log('Password validation test:', isValid);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Reset password to YOUR actual password
resetPassword('moo@gmail.com', '123456');  // Changed to 123456