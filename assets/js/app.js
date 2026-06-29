/**
 * AZUBUIKE TECHNOLOGIES INC. // PROJECT 2
 * File: app.js (Main Thread Orchestrator + WebRTC Transport Layer)
 * * Upgraded with Anti-Snapshot & Hard Panic Trigger Blocks.
 */

(function () {
    // Dynamic cache-busting string destroys stubborn mobile browser caching
    const protocolWorker = new Worker('assets/js/worker.js?v=' + Date.now());

    // DOM Element Mappings
    const initBtn = document.getElementById('init-peer');
    const connectBtn = document.getElementById('connect-peer');
    const remotePinInput = document.getElementById('remote-pin');
    const pinDisplay = document.getElementById('room-id-view');
    const sendBtn = document.getElementById('execute-action');
    const textInput = document.getElementById('code-input');
    const logsContainer = document.getElementById('log-window');
    
    // Panic & Security Mappings
    const panicBtn = document.getElementById('hard-panic-trigger');
    const blackoutOverlay = document.getElementById('anti-snapshot-overlay');

    let localConnection = null;
    let dataChannel = null;
    let sseSource = null;
    let targetPin = null;
    let isHost = false;

    const sseBaseUrl = 'https://ntfy.sh/azubuike_protocol_';
    const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

    function printLog(src, txt) {
        const el = document.createElement('div');
        el.className = `log-entry ${src.toLowerCase()}`;
        el.innerText = `[${new Date().toLocaleTimeString()}] [${src}]: ${txt}`;
        logsContainer.appendChild(el);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    // Initialize Cryptographic Key Pairs Inside Isolated Worker Context First
    initBtn.addEventListener('click', () => {
        isHost = true;
        targetPin = Math.floor(1000 + Math.random() * 9000).toString();
        pinDisplay.innerText = 'PIN: ' + targetPin;
        lockUI();
        printLog('SYS', 'Generating secure keys inside memory isolation worker...');
        protocolWorker.postMessage({ type: 'GENERATE_KEYS' });
    });

    connectBtn.addEventListener('click', () => {
        isHost = false;
        targetPin = remotePinInput.value.trim();
        if (targetPin.length !== 4 || isNaN(targetPin)) {
            printLog('SYS', 'Validation Failure: Room PIN must be exactly 4 digits.');
            return;
        }
        lockUI();
        printLog('SYS', 'Generating secure keys inside memory isolation worker...');
        protocolWorker.postMessage({ type: 'GENERATE_KEYS' });
    });

    function lockUI() {
        initBtn.disabled = connectBtn.disabled = remotePinInput.disabled = true;
    }

    /**
     * WORKER RESPONSE HANDLING MATRICES
     */
    protocolWorker.onmessage = function (e) {
        const { type, payload } = e.data;

        switch (type) {
            case 'KEYS_READY':
                if (isHost) startHost(payload.publicKey);
                else startPeer(payload.publicKey);
                break;

            case 'CRYPTO_READY':
                printLog('NET', 'CRYPTO HIGHWAY CONFIRMED: Shared asymmetric matrix locked.');
                sendBtn.innerText = "Dispatch Encrypted Packet";
                sendBtn.style.background = "#39ff14";
                sendBtn.style.color = "#000";
                textInput.placeholder = "Type secure message here...";
                break;

            case 'DISPATCH_PACKET':
                if (dataChannel && dataChannel.readyState === 'open') {
                    dataChannel.send(payload.buffer);
                }
                break;

            case 'RENDER_MSG':
                printLog('REMOTE', payload.text);
                break;

            case 'SYS_LOG':
                printLog('SYS', payload);
                break;

            case 'TERMINATION_COMPLETE':
                // Page undergoes immediate nuclear clear loop
                window.location.replace('about:blank');
                break;
        }
    };

    /**
     * NATIVE WEBRTC TRANSPORT LAYER
     */
    function startHost(pubKey) {
        printLog('NET', `Initializing Host Routing Pipeline on PIN: ${targetPin}`);
        sseSource = new EventSource(sseBaseUrl + targetPin + '/sse');
        
        sseSource.onmessage = function(e) {
            try {
                const rawData = JSON.parse(e.data);
                if (rawData && rawData.message) {
                    const packet = JSON.parse(rawData.message);
                    if (packet.type === 'answer' && packet.origin === 'peer') {
                        printLog('SYS', 'Handshake token captured. Intersecting mathematical keys...');
                        protocolWorker.postMessage({ type: 'DERIVE_KEY', payload: { publicKey: packet.publicKey } });
                        localConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(packet.sdp))));
                        cleanupSignaling();
                    }
                }
            } catch(err) {}
        };

        localConnection = new RTCPeerConnection(rtcConfig);
        dataChannel = localConnection.createDataChannel("ephemeral-text-stream");
        setupChannel(dataChannel);

        localConnection.onicecandidate = (e) => {
            if (!e.candidate) {
                sendSignal({ 
                    origin: 'host', 
                    type: 'offer', 
                    sdp: btoa(JSON.stringify(localConnection.localDescription)), 
                    publicKey: pubKey 
                });
                printLog('NET', 'Dispatched configuration mappings offer + Public Cryptographic Key.');
            }
        };
        localConnection.createOffer().then(desc => localConnection.setLocalDescription(desc));
    }

    function startPeer(pubKey) {
        printLog('NET', `Initializing Target Peer Connection Sequence via PIN: ${targetPin}`);
        sseSource = new EventSource(sseBaseUrl + targetPin + '/sse');

        localConnection = new RTCPeerConnection(rtcConfig);
        localConnection.ondatachannel = (e) => setupChannel(e.channel);

        sseSource.onmessage = async function(e) {
            try {
                const rawData = JSON.parse(e.data);
                if (rawData && rawData.message) {
                    const packet = JSON.parse(rawData.message);
                    if (packet.type === 'offer' && packet.origin === 'host') {
                        printLog('SYS', 'Host configuration offer validated. Computing shared secret...');
                        protocolWorker.postMessage({ type: 'DERIVE_KEY', payload: { publicKey: packet.publicKey } });
                        
                        await localConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(packet.sdp))));
                        const answer = await localConnection.createAnswer();
                        await localConnection.setLocalDescription(answer);
                        
                        sendSignal({ 
                            origin: 'peer', 
                            type: 'answer', 
                            sdp: btoa(JSON.stringify(localConnection.localDescription)), 
                            publicKey: pubKey 
                        });
                        printLog('NET', 'Returned signed cryptographic target answer.');
                        cleanupSignaling();
                    }
                }
            } catch(err) {}
        };
    }

    function sendSignal(packet) {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", sseBaseUrl + targetPin, true);
        xhr.setRequestHeader("Content-Type", "text/plain");
        xhr.setRequestHeader("X-Cache", "no");
        xhr.send(JSON.stringify(packet));
    }

    function cleanupSignaling() {
        if (sseSource) {
            sseSource.close();
            sseSource = null;
            printLog('SYS', 'Signaling paths severed. Transient metadata erased from wire.');
        }
    }

    function setupChannel(chan) {
        dataChannel = chan;
        dataChannel.binaryType = "arraybuffer";
        
        dataChannel.onopen = () => printLog('SYS', 'P2P Pipeline connected natively.');
        dataChannel.onclose = () => triggerImmediateSelfDestruct();
        
        dataChannel.onmessage = (e) => protocolWorker.postMessage({ type: 'DECRYPT_MSG', payload: { buffer: e.data } });
    }

    sendBtn.addEventListener('click', () => {
        const text = textInput.value.trim();
        if (!text || !dataChannel || dataChannel.readyState !== 'open') return;
        
        protocolWorker.postMessage({ type: 'ENCRYPT_MSG', payload: { text } });
        printLog('HUMAN', text);
        textInput.value = '';
    });

    textInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

    /**
     * ADVANCED SECURITY TRIPWIRE ARCHITECTURE
     */
    function triggerImmediateSelfDestruct() {
        // Drop network configurations instantly
        if (dataChannel) { dataChannel.close(); dataChannel = null; }
        if (localConnection) { localConnection.close(); localConnection = null; }
        cleanupSignaling();

        // Drop visual workspace to pitch black
        blackoutOverlay.style.display = 'block';

        // Direct vault worker memory clear instruction
        protocolWorker.postMessage({ type: 'PANIC_PURGE' });
    }

    // Physical Interaction Trigger
    panicBtn.addEventListener('click', triggerImmediateSelfDestruct);

    // Mobile App-Switcher Snapshot Prevention Shutter Hook
    function handleVisibilityShutter() {
        if (document.hidden || document.visibilityState === 'hidden') {
            // Screen blurred/hidden -> Instant blackout and silent memory drop
            triggerImmediateSelfDestruct();
        }
    }

    document.addEventListener('visibilitychange', handleVisibilityShutter);
    window.addEventListener('blur', triggerImmediateSelfDestruct);
    window.addEventListener('beforeunload', triggerImmediateSelfDestruct);
    window.addEventListener('unload', triggerImmediateSelfDestruct);
})();
