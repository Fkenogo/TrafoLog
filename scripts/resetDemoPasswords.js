/**
 * Reset Phase 9F demo account passwords to the documented local default.
 *
 * This keeps local demo credentials recoverable after user-management testing.
 */
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kVAssetTracker';
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || 'Phase9F@1234';

const DEMO_USERS = [
  'super.admin@phase9f.io',
  'operations.manager@phase9f.io',
  'supervisor.north@phase9f.io',
  'supervisor.south@phase9f.io',
  'technician1@phase9f.io',
  'technician2@phase9f.io',
  'technician3@phase9f.io',
  'technician4@phase9f.io',
  'technician5@phase9f.io',
  'viewer1@phase9f.io',
  'viewer2@phase9f.io'
];

async function main() {
  await mongoose.connect(MONGODB_URI);

  const results = [];
  for (const email of DEMO_USERS) {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      results.push({ email, status: 'MISSING' });
      continue;
    }

    user.password = DEMO_PASSWORD;
    user.login_attempts = 0;
    user.lock_until = undefined;
    user.reset_password_token = undefined;
    user.reset_password_expires = undefined;
    user.refresh_tokens = [];
    await user.save();

    results.push({ email, status: 'RESET', role: user.role, active: user.is_active });
  }

  console.log('=================================');
  console.log('Demo Password Reset');
  console.log(`Password: ${DEMO_PASSWORD}`);
  console.log('=================================');
  for (const result of results) {
    const suffix = result.status === 'RESET'
      ? `${result.role} | ${result.active ? 'active' : 'inactive'}`
      : 'run node scripts/phase9fSeedData.js first';
    console.log(`${result.status.padEnd(7)} ${result.email} ${suffix}`);
  }
  console.log('=================================');

  if (results.some((result) => result.status === 'MISSING')) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
