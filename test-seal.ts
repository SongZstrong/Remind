/**
 * Test Script for The Void Core Functionality
 * Tests encryption, decryption, and storage adapters
 */

import { encryptNote, decryptNote, generateFingerprintFromPassword, generateMasterKey } from './utils/seal-engine';

async function testSealEngine() {
  console.log('🧪 Testing Seal Engine...\n');

  // Test 1: Encryption and Decryption
  console.log('Test 1: Encrypt and Decrypt');
  const testPassword = 'silence-is-golden';
  const testContent = 'This is a secret note from the void.';

  try {
    // Encrypt
    console.log('  Encrypting...');
    const encrypted = await encryptNote(testContent, testPassword);
    console.log('  ✓ Encrypted successfully');
    console.log('  Encrypted data: [ENCRYPTED_PAYLOAD]');

    // Decrypt
    console.log('\n  Decrypting...');
    const decrypted = await decryptNote(encrypted, testPassword);
    console.log('  ✓ Decrypted successfully');
    console.log('  Decrypted content:', decrypted);

    // Verify
    if (decrypted === testContent) {
      console.log('  ✅ Content matches!');
    } else {
      console.log('  ❌ Content mismatch!');
    }
  } catch (error) {
    console.log('  ❌ Error:', error);
  }

  // Test 2: Wrong Password
  console.log('\nTest 2: Wrong Password');
  try {
    const encrypted = await encryptNote(testContent, testPassword);
    await decryptNote(encrypted, 'wrong-password');
    console.log('  ❌ Should have thrown SEAL_BROKEN error');
  } catch (error) {
    if ((error as Error).message === 'SEAL_BROKEN') {
      console.log('  ✅ Correctly threw SEAL_BROKEN error');
    } else {
      console.log('  ⚠️  Threw different error:', error);
    }
  }

  // Test 3: Key Fingerprint (from password)
  console.log('\nTest 3: Fingerprint from Password');
  try {
    const fingerprint = await generateFingerprintFromPassword(testPassword);
    console.log('  ✓ Generated fingerprint:', fingerprint);
    console.log('  Fingerprint length:', fingerprint.length);
    console.log('  ✅ Fingerprint generated successfully');
  } catch (error) {
    console.log('  ❌ Error:', error);
  }

  // Test 4: Master Key Generation (from CryptoKey)
  console.log('\nTest 4: Generate Master Key with Fingerprint');
  try {
    const masterKey = await generateMasterKey();
    console.log('  ✓ Generated master key');
    console.log('  Key fingerprint:', masterKey.fingerprint);
    console.log('  Fingerprint length:', masterKey.fingerprint.length);
    console.log('  ✅ Master key generated successfully');
  } catch (error) {
    console.log('  ❌ Error:', error);
  }

  console.log('\n✨ All tests completed!\n');
}

// Run tests
testSealEngine().catch(console.error);
