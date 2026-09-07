import assert from 'node:assert/strict';
import {
  canAccessFeature,
  isCrossSupportAdminDocumentReader,
} from '../src/lib/accessControl.ts';

let assertions = 0;
const check = (actual, expected) => {
  assert.equal(actual, expected);
  assertions += 1;
};
const profile = (department, overrides = {}) => ({
  id: 'test-profile',
  auth_user_id: 'test-auth',
  full_name: 'Test User',
  email: 'test@pertalife.com',
  role_level: 'STAFF_MARKETING_SUPPORT',
  unit: 'Marketing Support',
  department,
  manager_id: null,
  legacy_user_id: null,
  active: true,
  ...overrides,
});

for (const department of ['Marketing Communication', 'Digital & Affinity']) {
  const reader = profile(department);
  check(isCrossSupportAdminDocumentReader(reader), true);
  check(canAccessFeature(reader, 'DOCUMENT_ADMIN'), true);
  check(canAccessFeature(reader, 'SYSTEM_ADMIN'), false);
  check(canAccessFeature(reader, 'TARGET_RKAP'), false);
  check(canAccessFeature(reader, 'BOOKING_PIPELINE'), false);
  check(canAccessFeature(reader, 'PRODUCTION'), false);
  check(canAccessFeature(reader, 'DOCUMENT_MARCOMM'), false);
  check(canAccessFeature({ ...reader, active: false }, 'DOCUMENT_ADMIN'), false);
  check(canAccessFeature({ ...reader, unit: 'Other Unit' }, 'DOCUMENT_ADMIN'), false);
}

const existingMarketing = profile('Captive I', { unit: 'Captive Marketing', role_level: 'STAFF_MARKETING', legacy_user_id: 'USR-000013' });
check(canAccessFeature(existingMarketing, 'DOCUMENT_ADMIN'), true);
check(canAccessFeature({ ...existingMarketing, legacy_user_id: null }, 'DOCUMENT_ADMIN'), false);
const existingAdmin = profile('Marketing Administration', { legacy_user_id: 'USR-000026' });
check(canAccessFeature(existingAdmin, 'DOCUMENT_ADMIN'), true);
check(canAccessFeature(existingAdmin, 'DOCUMENT_MARCOMM'), false);
check(canAccessFeature(existingAdmin, 'TANDA_TERIMA'), true);
check(canAccessFeature({ ...existingAdmin, active: false }, 'DOCUMENT_ADMIN'), false);
check(canAccessFeature(profile(null), 'DOCUMENT_ADMIN'), false);
check(canAccessFeature(profile(null, { role_level: 'SYSTEM_ADMIN', unit: 'Administrasi Sistem' }), 'DOCUMENT_ADMIN'), false);
check(canAccessFeature(null, 'DOCUMENT_ADMIN'), false);
console.log(`Admin document RBAC: ${assertions} assertions passed.`);
