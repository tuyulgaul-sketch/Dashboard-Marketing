import assert from 'node:assert/strict';
import {
  canAccessFeature,
  isCrossSupportAdminDocumentReader,
} from '../src/lib/accessControl.ts';

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
  assert.equal(isCrossSupportAdminDocumentReader(reader), true);
  assert.equal(canAccessFeature(reader, 'DOCUMENT_ADMIN'), true);
  assert.equal(canAccessFeature(reader, 'SYSTEM_ADMIN'), false);
  assert.equal(canAccessFeature(reader, 'TARGET_RKAP'), false);
  assert.equal(canAccessFeature(reader, 'BOOKING_PIPELINE'), false);
  assert.equal(canAccessFeature(reader, 'PRODUCTION'), false);
  assert.equal(canAccessFeature(reader, 'DOCUMENT_MARCOMM'), false);
  assert.equal(canAccessFeature({ ...reader, active: false }, 'DOCUMENT_ADMIN'), false);
  assert.equal(canAccessFeature({ ...reader, unit: 'Other Unit' }, 'DOCUMENT_ADMIN'), false);
}

const existingMarketing = profile('Captive I', { unit: 'Captive Marketing', role_level: 'STAFF_MARKETING', legacy_user_id: 'USR-000013' });
assert.equal(canAccessFeature(existingMarketing, 'DOCUMENT_ADMIN'), true);
assert.equal(canAccessFeature({ ...existingMarketing, legacy_user_id: null }, 'DOCUMENT_ADMIN'), false);
const existingAdmin = profile('Marketing Administration', { legacy_user_id: 'USR-000026' });
assert.equal(canAccessFeature(existingAdmin, 'DOCUMENT_ADMIN'), true);
assert.equal(canAccessFeature(existingAdmin, 'DOCUMENT_MARCOMM'), false);
assert.equal(canAccessFeature(profile(null), 'DOCUMENT_ADMIN'), false);
assert.equal(canAccessFeature(profile(null, { role_level: 'SYSTEM_ADMIN', unit: 'Administrasi Sistem' }), 'DOCUMENT_ADMIN'), false);
assert.equal(canAccessFeature(null, 'DOCUMENT_ADMIN'), false);
console.log('Admin document RBAC: 28 assertions passed.');
