// worker.js - Absolute Volatile Engine Room
let localConnection = null;
let dataChannel = null;
let sseSource = null;
let sessionKey = null; // Derived AES-GCM Key object will live here in RAM
const sseBaseUrl = 'https://ntfy.sh/azubuike_protocol_';
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Volatile message cache (disappears instantly when thread terminates)
const internalChatHistory = [];

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

function initializeHostConnection(pin) {
    sseSource = new EventSource(sseBaseUrl + pin + '/sse');
    
    sseSource.onmessage = async function(e) {
        try {
            const rawData = JSON.parse(e.data);
            if (rawData && rawData.message) {
                const packet = JSON.parse(rawData.message);
                if (packet.type === 'answer' && packet.origin === 'peer') {
                    // Ephemeral connection setup logic
                    await localConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(packet.sdp))));
                    cleanupSignalingTunnel();
                }
            }
        } catch(err) { /* Silent fail to prevent logging footprint */ }
    };

    localConnection = new RTCPeerConnection(rtcConfig);
    dataChannel = localConnection.createDataChannel("ephemeral-text-stream");
    setupChannelEvents(dataChannel);

    localConnection.onicecandidate = function(e) {
        if (!e.candidate) {
            const payload = { origin: 'host', type: 'offer', sdp: btoa(JSON.stringify(localConnection.localDescription)) };
            broadcastSignalingPacket(pin, payload);
        }
    };

    localConnection.createOffer().then(desc => localConnection.setLocalDescription(desc));
}

function initializePeerConnection(pin) {
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
                    const decodedOffer = JSON.parse(atob(packet.sdp));
                    await localConnection.setRemoteDescription(new RTCSessionDescription(decodedOffer));
                    const answer = await localConnection.createAnswer();
                    await localConnection.setLocalDescription(answer);
                    
                    const payload = { origin: 'peer', type: 'answer', sdp: btoa(JSON.stringify(localConnection.localDescription)) };
                    broadcastSignalingPacket(pin, payload);
                }
            }
        } catch(err) {}
    };
}

function broadcastSignalingPacket(pin, packetData) {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", sseBaseUrl + pin, true);
    xhr.setRequestHeader("Content-Type", "text/plain");
    // CRITICAL: Disable caching on ntfy.sh to prevent metadata logging
    xhr.setRequestHeader("X-Cache", "no");
    xhr.setRequestHeader("X-Firebase", "no");
    xhr.send(JSON.stringify(packetData));
}

function cleanupSignalingTunnel() {
    if (sseSource) {
        sseSource.close();
        sseSource = null;
        self.postMessage({ type: 'SYS_LOG', payload: 'Signaling bridges purged permanently from memory.' });
    }
}

function setupChannelEvents(channel) {
    channel.onopen = function() {
        cleanupSignalingTunnel();
        self.postMessage({ type: 'LINE_SECURE', payload: true });
    };
    
    channel.onclose = function() {
        purgeMemoryContext();
    };

    channel.onmessage = async function(e) {
        // Here we will insert the AES-GCM decryption hook in Phase 2
        const rawIncomingMessage = e.data; 
        
        internalChatHistory.push({ remote: true, text: rawIncomingMessage, ts: Date.now() });
        self.postMessage({ type: 'RENDER_MSG', payload: { remote: true, text: rawIncomingMessage } });
    };
}

function purgeMemoryContext() {
    // Explicit destruction mechanism to clear references for garbage collection
    localConnection = null;
    dataChannel = null;
    sessionKey = null;
    internalChatHistory.length = 0; 
    
    self.postMessage({ type: 'TERMINATION_COMPLETE' });
}

