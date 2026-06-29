/**
 * AZUBUIKE TECHNOLOGIES INC. // PROJECT 2
 * File: worker.js (Pure Crypto & Vault Context)
 */

let localKeyPair = null;
let derivedSymmetricKey = null;
const internalChatHistory = [];

self.onmessage = async function(e) {
    const { type, payload } = e.data;
    
    switch(type) {
        case 'GENERATE_KEYS':
            localKeyPair = await self.crypto.subtle.generateKey(
                { name: "ECDH", namedCurve: "P-384" },
                false, 
                ["deriveKey", "deriveBits"]
            );
            const exportedKey = await self.crypto.subtle.exportKey("raw", localKeyPair.publicKey);
            const pubBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
            self.postMessage({ type: 'KEYS_READY', payload: { publicKey: pubBase64 } });
            break;

        case 'DERIVE_KEY':
            const remoteBuffer = new Uint8Array(atob(payload.publicKey).split("").map(c => c.charCodeAt(0))).buffer;
            const importedKey = await self.crypto.subtle.importKey(
                "raw", remoteBuffer, { name: "ECDH", namedCurve: "P-384" }, true, []
            );
            derivedSymmetricKey = await self.crypto.subtle.deriveKey(
                { name: "ECDH", public: importedKey },
                localKeyPair.privateKey,
                { name: "AES-GCM", length: 256 },
                false,
                ["encrypt", "decrypt"]
            );
            self.postMessage({ type: 'CRYPTO_READY' });
            break;

        case 'ENCRYPT_MSG':
            if (!derivedSymmetricKey) return;
            const enc = new TextEncoder();
            const encoded = enc.encode(payload.text);
            const iv = self.crypto.getRandomValues(new Uint8Array(12));
            const ciphertext = await self.crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv }, derivedSymmetricKey, encoded
            );
            const packet = new Uint8Array(iv.length + ciphertext.byteLength);
            packet.set(iv, 0);
            packet.set(new Uint8Array(ciphertext), iv.length);
            
            // Pass the encrypted buffer back to main thread to send over WebRTC
            self.postMessage({ type: 'DISPATCH_PACKET', payload: { buffer: packet.buffer } });
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
                self.postMessage({ type: 'SYS_LOG', payload: 'Decryption failed: Integrity violation.' });
            }
            break;

        case 'PANIC_PURGE':
            localKeyPair = null;
            derivedSymmetricKey = null;
            internalChatHistory.length = 0;
            self.postMessage({ type: 'TERMINATION_COMPLETE' });
            break;
    }
};
