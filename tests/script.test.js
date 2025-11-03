const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', 'public', 'script.js');
const {
  resolveTranslationKey,
  translate,
  buildBadgeDescriptors,
  testing,
  DEFAULT_LANGUAGE,
} = require(scriptPath);

test('resolveTranslationKey returns nested values', () => {
  const translations = { badges: { pending: { title: 'Pending deeds' } } };
  const value = resolveTranslationKey('badges.pending.title', translations);
  assert.equal(value, 'Pending deeds');
});

test('translate uses the active language when available', () => {
  testing.clearTranslations();
  testing.cacheTranslations(DEFAULT_LANGUAGE, {
    greeting: { hello: 'Hello {{name}}' },
  });
  testing.cacheTranslations('ht', {
    greeting: { hello: 'Bonjou {{name}}' },
  });
  testing.setActiveLanguage('ht');

  const result = translate('greeting.hello', { name: 'Mina' });
  assert.equal(result, 'Bonjou Mina');
});

test('translate falls back to default language when key missing', () => {
  testing.clearTranslations();
  testing.cacheTranslations(DEFAULT_LANGUAGE, {
    greeting: { hello: 'Hello {{name}}' },
  });
  testing.cacheTranslations('ht', {
    greeting: {},
  });
  testing.setActiveLanguage('ht');

  const result = translate('greeting.hello', { name: 'Rosa' });
  assert.equal(result, 'Hello Rosa');
});

test('translate returns null when translation missing', () => {
  testing.clearTranslations();
  testing.cacheTranslations(DEFAULT_LANGUAGE, {});
  testing.setActiveLanguage('en');

  const result = translate('greeting.hello', { name: 'Sky' });
  assert.equal(result, null);
});

test('buildBadgeDescriptors returns badges for thresholds', () => {
  const summary = {
    pendingCount: 2,
    verifiedCount: 10,
  };

  const descriptors = buildBadgeDescriptors(summary);
  assert.equal(descriptors.length, 4);
  assert.deepEqual(
    descriptors.map((descriptor) => descriptor.titleKey),
    [
      'badges.pending.title',
      'badges.firstVerified.title',
      'badges.communityBuilder.title',
      'badges.blockCaptain.title',
    ],
  );
});
