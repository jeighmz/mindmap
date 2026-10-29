import {
  USER_TIERS,
  canUseFeature,
  getFeatureLimit,
  isExportFormatAllowed,
} from './userTiers';

test('free tier cannot use real-time collaboration', () => {
  expect(canUseFeature(USER_TIERS.FREE, 'realTimeCollaboration')).toBe(false);
});

test('creator tier can use real-time collaboration', () => {
  expect(canUseFeature(USER_TIERS.CREATOR_AI, 'realTimeCollaboration')).toBe(true);
});

test('free tier is limited to png export', () => {
  expect(isExportFormatAllowed(USER_TIERS.FREE, 'png')).toBe(true);
  expect(isExportFormatAllowed(USER_TIERS.FREE, 'pdf')).toBe(false);
});

test('unknown tiers have no feature access', () => {
  expect(getFeatureLimit('NOPE', 'maxMindMaps')).toBe(0);
  expect(canUseFeature('NOPE', 'autosave')).toBe(false);
});
