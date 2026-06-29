/**
 * AZUBUIKE TECHNOLOGIES INC. // PROJECT 2
 * File: worker.js (Pure Crypto + Binary Chunk Reassembly Context)
 * * Absolute Volatile Memory Context - Structural Slice Assemblies.
 */

let localKeyPair = null;
let derivedSymmetricKey = null;
const internalChatHistory = [];

// Volatile reassembly mapping arrays for inbound streams
let incomingFileBuffer = [];
let receivedChunksTracker = 0;

self.onmessage = async function(e) {
    const { type, payload } = e.data;
    
    switch(type) {
        case 'GENERATE_KEYS':
            try {
                localKeyPair = await self.crypto.subtle.generateKey(
                    { name: "ECDH", namedCurve: "P-384" },
                    false, 
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
                    false, 
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
                
                // Pack message header with [0x01] type marker flag
                const packet = new Uint8Array(1 + iv.length + ciphertext.byteLength);
                packet[0] = 0x01; 
                packet.set(iv, 1);
                packet.set(new Uint8Array(ciphertext), 1 + iv.length);
                
                self.postMessage({ type: 'DISPATCH_PACKET', payload: { buffer: packet.buffer } });
            } catch(err) {
                self.postMessage({ type: 'SYS_LOG', payload: 'Crypto Failure: Encryption broken.' });
            }
            break;

        case 'ENCRYPT_FILE_CHUNK':
            if (!derivedSymmetricKey) return;
            try {
                const iv = self.crypto.getRandomValues(new Uint8Array(12));
                const ciphertext = await self.crypto.subtle.encrypt(
                    { name: "AES-GCM", iv: iv }, derivedSymmetricKey, payload.buffer
                );

                // Build structural payload wrapper metadata JSON string
                const metaString = JSON.stringify({
                    name: payload.name,
                    mime: payload.mime,
                    size: payload.size,
                    index: payload.index,
                    total: payload.total
                });
                const metaBytes = new TextEncoder().encode(metaString);

                // Setup binary allocation bounds: [0x02] + [METADATA_LENGTH(2 bytes)] + [METADATA] + [IV(12)] + [CIPHERTEXT]
                const packet = new Uint8Array(1 + 2 + metaBytes.byteLength + iv.length + ciphertext.byteLength);
                packet[0] = 0x02; // Type Marker File Slice Flag
                packet[1] = (metaBytes.byteLength >> 8) & 0xFF;
                packet[2] = metaBytes.byteLength & 0xFF;
                packet.set(metaBytes, 3);
                packet.set(iv, 3 + metaBytes.byteLength);
                packet.set(new Uint8Array(ciphertext), 3 + metaBytes.byteLength + iv.length);

                // Track active transfer percentage back to UI viewport
                const percent = Math.floor(((payload.index + 1) / payload.total) * 100);
                self.postMessage({ type: 'TX_PROGRESS', payload: { percent } });
                self.postMessage({ type: 'DISPATCH_PACKET', payload: { buffer: packet.buffer } });
            } catch(err) {
                self.postMessage({ type: 'SYS_LOG', payload: 'File Pipeline Error: Slice encryption crash.' });
            }
            break;

        case 'DECRYPT_MSG':
            if (!derivedSymmetricKey) return;
            try {
                const rawBuffer = new Uint8Array(payload.buffer);
                const dataMarkerFlag = rawBuffer[0];

                if (dataMarkerFlag === 0x01) {
                    // Standard Text Message Handling Routine
                    const msgIv = rawBuffer.slice(1, 13);
                    const msgCipher = rawBuffer.slice(13);
                    
                    const decrypted = await self.crypto.subtle.decrypt(
                        { name: "AES-GCM", iv: msgIv }, derivedSymmetricKey, msgCipher
                    );
                    const decryptedText = new TextDecoder().decode(decrypted);
                    
                    internalChatHistory.push({ remote: true, text: decryptedText, ts: Date.now() });
                    self.postMessage({ type: 'RENDER_MSG', payload: { text: decryptedText } });
                } 
                else if (dataMarkerFlag === 0x02) {
                    // Ephemeral File Piece Decryption Handling Routine
                    const metaLength = (rawBuffer[1] << 8) | rawBuffer[2];
                    const metaBytes = rawBuffer.slice(3, 3 + metaLength);
                    const meta = JSON.parse(new TextDecoder().decode(metaBytes));

                    const offsetIv = 3 + metaLength;
                    const msgIv = rawBuffer.slice(offsetIv, offsetIv + 12);
                    const msgCipher = rawBuffer.slice(offsetIv + 12);

                    const decryptedSlice = await self.crypto.subtle.decrypt(
                        { name: "AES-GCM", iv: msgIv }, derivedSymmetricKey, msgCipher
                    );

                    // Reconstruct index markers directly in volatile buffer stack arrays
                    if (incomingFileBuffer.length === 0) {
                        incomingFileBuffer = new Array(meta.total);
                        receivedChunksTracker = 0;
                    }

                    incomingFileBuffer[meta.index] = decryptedSlice;
                    receivedChunksTracker++;

                    const rxPercent = Math.floor((receivedChunksTracker / meta.total) * 100);
                    self.postMessage({ type: 'RX_PROGRESS', payload: { percent: rxPercent } });

                    if (receivedChunksTracker === meta.total) {
                        // All structural parts compiled -> Build unified ArrayBuffer sequence
                        let totalLength = 0;
                        for (let block of incomingFileBuffer) totalLength += block.byteLength;

                        const completeFileBytes = new Uint8Array(totalLength);
                        let fileWriteOffset = 0;
                        for (let block of incomingFileBuffer) {
                            completeFileBytes.set(new Uint8Array(block), fileWriteOffset);
                            fileWriteOffset += block.byteLength;
                        }

                        // Send the full compiled object back to the UI thread via non-copy reference strings
                        self.postMessage({
                            type: 'COMPILE_FILE_BLOB',
                            payload: {
                                buffer: completeFileBytes.buffer,
                                name: meta.name,
                                mime: meta.mime
                            }
                        }, [completeFileBytes.buffer]);

                        // Instantly clear memory blocks out of isolation heaps
                        incomingFileBuffer = [];
                        receivedChunksTracker = 0;
                    }
                }
            } catch(err) {
                self.postMessage({ type: 'SYS_LOG', payload: 'Decryption Mismatch: Packet dropped or compromised.' });
            }
            break;

        case 'PANIC_PURGE':
            executeHardNuclearPurge();
            break;
    }
};

function executeHardNuclearPurge() {
    if (internalChatHistory.length > 0) {
        for (let i = 0; i < internalChatHistory.length; i++) {
            internalChatHistory[i].text = "0000000000000000";
        }
        internalChatHistory.length = 0;
    }

    // Force zeroization of file fragments left inside the memory stack array
    if (incomingFileBuffer.length > 0) {
        for (let i = 0; i < incomingFileBuffer.length; i++) {
            if (incomingFileBuffer[i]) {
                const zeroFiller = new Uint8Array(incomingFileBuffer[i]);
                zeroFiller.fill(0);
            }
        }
        incomingFileBuffer = [];
    }
    receivedChunksTracker = 0;

    localKeyPair = null;
    derivedSymmetricKey = null;

    self.postMessage({ type: 'TERMINATION_COMPLETE' });
            }
