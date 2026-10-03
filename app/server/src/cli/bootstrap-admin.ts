import { openDatabase } from '../db/database.js';
import { createInitialAdmin } from '../auth/auth.service.js';
import { z } from 'zod';

const bootstrapSchema = z.object({
  email: z.string().trim().email().max(254),
  fullname: z.string().trim().min(1).max(140),
  password: z.string().min(12).max(256),
});
const input = bootstrapSchema.safeParse({
  email: process.env.ADMIN_EMAIL,
  fullname: process.env.ADMIN_NAME,
  password: process.env.ADMIN_PASSWORD,
});

if (!input.success) {
  console.error('Set ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD before bootstrapping.');
  console.error('Use a valid email, a name, and a 12–256 character password.');
  process.exitCode = 1;
} else {
  const database = openDatabase();
  try {
    await createInitialAdmin(database, input.data);
    console.log(`Created the initial System Manager: ${input.data.email}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    database.close();
  }
}
