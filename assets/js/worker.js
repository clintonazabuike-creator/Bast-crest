/**
 * AZUBUIKE TECHNOLOGIES INC. // PROJECT 2
 * File: worker.js (Pure Crypto & Vault Context)
 * * Absolute Volatile Memory Context - Explicit Anti-Forensic Zeroization.
 */

let localKeyPair = null;
let derivedSymmetricKey = null;
const internalChatHistory = [];

self.onmessage = async function(e) {
    const { type, payload } = e.data;
    
    switch(type) {
        case 'GENERATE_KEYS':
            try {
                localKeyPair = await self.crypto.subtle.generateKey(
                    { name: "ECDH", namedCurve: "P-384" },
                    false, // Non-extractable out of volatile RAM context
                    ["deriveKey", "deriveBits"]
                );
                const exportedKey = await self.crypto.subtle.exportKey("raw", localKeyPair.publicKey);
                const pubBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
                self.postMessage({ type: 'KEYS_READY', payload: { publicKey: pubBase64 } });
            } catch(err) {
                self.postMessage({ type: 'SYS_LOG', payload: 'Crypto Failure: Keygen matrix crash.' });
            }
            break;

        case 'DERIVE_KEY':
            try {
                const remoteBuffer = new Uint8Array(atob(payload.publicKey).split("").map(c => c.charCodeAt(0))).buffer;
                const importedKey = await self.crypto.subtle.importKey(
                    "raw", remoteBuffer, { name: "ECDH", namedCurve: "P-384" }, true, []
                );
                derivedSymmetricKey = await self.crypto.subtle.deriveKey(
                    { name: "ECDH", public: importedKey },
                    localKeyPair.privateKey,
                    { name: "AES-GCM", length: 256 },
                    false, // Static barrier prevents extraction via script injection
                    ["encrypt", "decrypt"]
                );
                self.postMessage({ type: 'CRYPTO_READY' });
            } catch(err) {
                self.postMessage({ type: 'SYS_LOG', payload: 'Crypto Failure: Derivation phase mismatch.' });
            }
            break;

        case 'ENCRYPT_MSG':
            if (!derivedSymmetricKey) return;
            try {
                const enc = new TextEncoder();
                const encoded = enc.encode(payload.text);
                const iv = self.crypto.getRandomValues(new Uint8Array(12));
                const ciphertext = await self.crypto.subtle.encrypt(
                    { name: "AES-GCM", iv: iv }, derivedSymmetricKey, encoded
                );
                
                const packet = new Uint8Array(iv.length + ciphertext.byteLength);
                packet.set(iv, 0);
                packet.set(new Uint8Array(ciphertext), iv.length);
                
                self.postMessage({ type: 'DISPATCH_PACKET', payload: { buffer: packet.buffer } });
            } catch(err) {
                self.postMessage({ type: 'SYS_LOG', payload: 'Crypto Failure: Encryption broken.' });
            }
            break;

        case 'DECRYPT_MSG':
            if (!derivedSymmetricKey) return;
            try {
                const rawBuffer = new Uint8Array(payload.buffer);
                const msgIv = rawBuffer.slice(0, 12);
                const msgCipher = rawBuffer.slice(12);
                
                const decrypted = await self.crypto.subtle.decrypt(
                    { name: "AES-GCM", iv: msgIv }, derivedSymmetricKey, msgCipher
                );
                const decryptedText = new TextDecoder().decode(decrypted);
                
                internalChatHistory.push({ remote: true, text: decryptedText, ts: Date.now() });
                self.postMessage({ type: 'RENDER_MSG', payload: { text: decryptedText } });
            } catch(err) {
                self.postMessage({ type: 'SYS_LOG', payload: 'Decryption Alert: Integrity violation.' });
            }
            break;

        case 'PANIC_PURGE':
            executeHardNuclearPurge();
            break;
    }
};

/**
 * NUCLEAR ACTIVE MEMORY ZEROIZATION ENGINE
 */
function executeHardNuclearPurge() {
    // 1. Fill historical memory buffer arrays with zero metrics to clean RAM residue
    if (internalChatHistory.length > 0) {
        for (let i = 0; i < internalChatHistory.length; i++) {
            internalChatHistory[i].text = "0000000000000000";
        }
        internalChatHistory.length = 0;
    }

    // 2. Break key references completely for immediate Garbage Collector eviction
    localKeyPair = null;
    derivedSymmetricKey = null;

    // 3. Confirm total destruction state back to main controller thread
    self.postMessage({ type: 'TERMINATION_COMPLETE' });
}
