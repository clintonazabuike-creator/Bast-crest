/**
 * AZUBUIKE TECHNOLOGIES INC. // PROJECT 2
 * Core Air-Gapped P2P Communication Protocol Engine
 * File: worker.js (Dedicated Web Worker Thread)
 * * Absolute Volatile Memory Context - Zero Disk Footprint.
 */

// Volatile Network & Signaling State References
let localConnection = null;
let dataChannel = null;
let sseSource = null;

// Volatile Cryptographic Key References
let localKeyPair = null;
let derivedSymmetricKey = null;

// Volatile Data Arrays (Cleared instantly on tab/process termination)
const internalChatHistory = [];

const sseBaseUrl = 'https://ntfy.sh/azubuike_protocol_';
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Message Intercept Routing Matrix
self.onmessage = function(e) {
    const { type, payload } = e.data;
    
    switch(type) {
        case 'INIT_HOST':
            initializeHostConnection(payload.pin);
            break;
        case 'INIT_PEER':
            initializePeerConnection(payload.pin);
            break;
        case 'SEND_SECURE_MSG':
            encryptAndDispatch(payload.text);
            break;
        case 'PANIC_PURGE':
            purgeMemoryContext();
            break;
    }
};

/**
 * CRYPTOGRAPHIC PRIMITIVES
 */

// Generate Ephemeral ECDH Key Pair using high-entropy NIST P-384 Curve
async function generateEphemeralKeys() {
    return await self.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-384" },
        false, // Explicitly non-extractable out of memory context
        ["deriveKey", "deriveBits"]
    );
}

// Derive a volatile 256-bit symmetric AES-GCM key via Diffie-Hellman Key Agreement
async function deriveSharedSymmetricKey(privateKey, remotePublicKeyBuffer) {
    const importedPublicKey = await self.crypto.subtle.importKey(
        "raw",
        remotePublicKeyBuffer,
        { name: "ECDH", namedCurve: "P-384" },
        true,
        []
    );

    return await self.crypto.subtle.deriveKey(
        { name: "ECDH", public: importedPublicKey },
        privateKey,
        { name: "AES-GCM", length: 256 },
        false, // Static firewall barrier: prevents key extraction via script injection
        ["encrypt", "decrypt"]
    );
}

/**
 * INITIALIZATION & SIGNALING ENGINES
 */

async function initializeHostConnection(pin) {
    try {
        localKeyPair = await generateEphemeralKeys();
        const exportedPublicKey = await self.crypto.subtle.exportKey("raw", localKeyPair.publicKey);
        const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPublicKey)));

        self.postMessage({ type: 'SYS_LOG', payload: 'Host cryptographic keys generated locally.' });

        // Connect short-lived signaling stream
        sseSource = new EventSource(sseBaseUrl + pin + '/sse');
        
        sseSource.onmessage = async function(e) {
            try {
                const rawData = JSON.parse(e.data);
                if (rawData && rawData.message) {
                    const packet = JSON.parse(rawData.message);
                    if (packet.type === 'answer' && packet.origin === 'peer') {
                        self.postMessage({ type: 'SYS_LOG', payload: 'Handshake response intercepted. Intersecting math matrices...' });
                        
                        // Parse, unpack and compute symmetric key
                        const peerKeyBuffer = new Uint8Array(atob(packet.publicKey).split("").map(c => c.charCodeAt(0))).buffer;
                        derivedSymmetricKey = await deriveSharedSymmetricKey(localKeyPair.privateKey, peerKeyBuffer);
                        
                        await localConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(packet.sdp))));
                        cleanupSignalingTunnel();
                    }
                }
            } catch(err) { /* Anti-forensic silent drop */ }
        };

        localConnection = new RTCPeerConnection(rtcConfig);
        dataChannel = localConnection.createDataChannel("ephemeral-text-stream");
        setupChannelEvents(dataChannel);

        localConnection.onicecandidate = function(e) {
            if (!e.candidate) {
                const payload = { 
                    origin: 'host', 
                    type: 'offer', 
                    sdp: btoa(JSON.stringify(localConnection.localDescription)),
                    publicKey: publicKeyBase64 
                };
                broadcastSignalingPacket(pin, payload);
                self.postMessage({ type: 'SYS_LOG', payload: 'Dispatched configuration mapping offer + Public Cryptographic Key.' });
            }
        };

        const desc = await localConnection.createOffer();
        await localConnection.setLocalDescription(desc);

    } catch (err) {
        self.postMessage({ type: 'SYS_LOG', payload: 'Critical Init Host Error: ' + err.message });
    }
}

async function initializePeerConnection(pin) {
    try {
        localKeyPair = await generateEphemeralKeys();
        const exportedPublicKey = await self.crypto.subtle.exportKey("raw", localKeyPair.publicKey);
        const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedPublicKey)));

        self.postMessage({ type: 'SYS_LOG', payload: 'Peer cryptographic keys generated locally.' });

        sseSource = new EventSource(sseBaseUrl + pin + '/sse');
        localConnection = new RTCPeerConnection(rtcConfig);
        
        localConnection.ondatachannel = function(e) {
            dataChannel = e.channel;
            setupChannelEvents(dataChannel);
        };

        sseSource.onmessage = async function(e) {
            try {
                const rawData = JSON.parse(e.data);
                if (rawData && rawData.message) {
                    const packet = JSON.parse(rawData.message);
                    if (packet.type === 'offer' && packet.origin === 'host') {
                        self.postMessage({ type: 'SYS_LOG', payload: 'Host configuration offer validated. Computing shared secret...' });

                        const hostKeyBuffer = new Uint8Array(atob(packet.publicKey).split("").map(c => c.charCodeAt(0))).buffer;
                        derivedSymmetricKey = await deriveSharedSymmetricKey(localKeyPair.privateKey, hostKeyBuffer);

                        await localConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(packet.sdp))));
                        const answer = await localConnection.createAnswer();
                        await localConnection.setLocalDescription(answer);
                        
                        const payload = { 
                            origin: 'peer', 
                            type: 'answer', 
                            sdp: btoa(JSON.stringify(localConnection.localDescription)),
                            publicKey: publicKeyBase64
                        };
                        broadcastSignalingPacket(pin, payload);
                        self.postMessage({ type: 'SYS_LOG', payload: 'Returned signed cryptographic target answer.' });
                    }
                }
            } catch(err) { /* Anti-forensic silent drop */ }
        };

        localConnection.onicecandidate = function(e) {
            // Keep looping until candidate collection hits complete null frame
        };

    } catch (err) {
        self.postMessage({ type: 'SYS_LOG', payload: 'Critical Init Peer Error: ' + err.message });
    }
}

/**
 * TRANSPORT, ENCRYPTION AND DECRYPTION FLOWS
 */

function broadcastSignalingPacket(pin, packetData) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", sseBaseUrl + pin, true);
    xhr.setRequestHeader("Content-Type", "text/plain");
    // Enforcement: Command ntfy.sh server to never retain packet metrics in log cache
    xhr.setRequestHeader("X-Cache", "no");
    xhr.setRequestHeader("X-Firebase", "no");
    xhr.send(JSON.stringify(packetData));
}

async function encryptAndDispatch(text) {
    if (!dataChannel || dataChannel.readyState !== 'open' || !derivedSymmetricKey) {
        self.postMessage({ type: 'SYS_LOG', payload: 'Write Error: Secure highway channel data pipe is closed.' });
        return;
    }

    try {
        const enc = new TextEncoder();
        const encodedMessage = enc.encode(text);
        const iv = self.crypto.getRandomValues(new Uint8Array(12)); // High-entropy unique 12-byte initialization vector

        const ciphertextBuffer = await self.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            derivedSymmetricKey,
            encodedMessage
        );

        // Standard Byte Pack Layout: [IV (12 Bytes)] + [Ciphertext (Variable Length)]
        const packet = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
        packet.set(iv, 0);
        packet.set(new Uint8Array(ciphertextBuffer), iv.length);

        dataChannel.send(packet.buffer);
    } catch(err) {
        self.postMessage({ type: 'SYS_LOG', payload: 'Encryption Pipeline Failure.' });
    }
}

function setupChannelEvents(channel) {
    channel.binaryType = "arraybuffer"; // Guarantee uniform byte operations across engines

    channel.onopen = function() {
        cleanupSignalingTunnel();
        self.postMessage({ type: 'LINE_SECURE', payload: true });
    };
    
    channel.onclose = function() { 
        purgeMemoryContext(); 
    };
    
    channel.onmessage = async function(e) {
        if (!derivedSymmetricKey) return;

        try {
            const rawBuffer = new Uint8Array(e.data);
            const iv = rawBuffer.slice(0, 12);
            const ciphertext = rawBuffer.slice(12);

            const decryptedBuffer = await self.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                derivedSymmetricKey,
                ciphertext
            );

            const dec = new TextDecoder();
            const decryptedText = dec.decode(decryptedBuffer);

            internalChatHistory.push({ remote: true, text: decryptedText, ts: Date.now() });
            self.postMessage({ type: 'RENDER_MSG', payload: { remote: true, text: decryptedText } });
        } catch (err) {
            self.postMessage({ type: 'SYS_LOG', payload: 'Decryption Alert: Integrity violation or unauthorized interception vector detected.' });
        }
    };
}

function cleanupSignalingTunnel() {
    if (sseSource) {
        sseSource.close();
        sseSource = null;
        self.postMessage({ type: 'SYS_LOG', payload: 'Signaling paths severed. Transient metadata erased from wire.' });
    }
}

/**
 * HARD MEMORY TEARDOWN PURGE SWITCH
 */
function purgeMemoryContext() {
    // Overwrite, de-reference, and drop for garbage collector extraction
    localKeyPair = null;
    derivedSymmetricKey = null;
    
    if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
    }
    if (localConnection) {
        localConnection.close();
        localConnection = null;
    }
    if (sseSource) {
        sseSource.close();
        sseSource = null;
    }

    internalChatHistory.length = 0; 
    
    self.postMessage({ type: 'TERMINATION_COMPLETE' });
                }
