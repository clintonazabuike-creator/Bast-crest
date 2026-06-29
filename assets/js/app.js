/**
 * AZUBUIKE TECHNOLOGIES INC. // PROJECT 2
 * File: app.js (Main Thread Orchestrator + WebRTC Transport Layer)
 */

(function () {
    const protocolWorker = new Worker('assets/js/worker.js');

    const initBtn = document.getElementById('init-peer');
    const connectBtn = document.getElementById('connect-peer');
    const remotePinInput = document.getElementById('remote-pin');
    const pinDisplay = document.getElementById('room-id-view');
    const sendBtn = document.getElementById('execute-action');
    const textInput = document.getElementById('code-input');
    const logsContainer = document.getElementById('log-window');

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

    // 1. Kickoff Keys Generation inside Vault Worker
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
        if (targetPin.length !== 4) return;
        lockUI();
        printLog('SYS', 'Generating secure keys inside memory isolation worker...');
        protocolWorker.postMessage({ type: 'GENERATE_KEYS' });
    });

    function lockUI() {
        initBtn.disabled = connectBtn.disabled = remotePinInput.disabled = true;
    }

    // 2. Worker Feedback Intercept Engine
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
                window.location.reload();
                break;
        }
    };

    // WebRTC Implementations on Main Window Scope
    function startHost(pubKey) {
        printLog('NET', `Initializing Host Routing Pipeline on PIN: ${targetPin}`);
        sseSource = new EventSource(sseBaseUrl + targetPin + '/sse');
        
        sseSource.onmessage = function(e) {
            try {
                const packet = JSON.parse(JSON.parse(e.data).message);
                if (packet.type === 'answer' && packet.origin === 'peer') {
                    protocolWorker.postMessage({ type: 'DERIVE_KEY', payload: { publicKey: packet.publicKey } });
                    localConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(packet.sdp))));
                    if(sseSource) { sseSource.close(); sseSource = null; }
                }
            } catch(err) {}
        };

        localConnection = new RTCPeerConnection(rtcConfig);
        dataChannel = localConnection.createDataChannel("ephemeral-text-stream");
        setupChannel(dataChannel);

        localConnection.onicecandidate = (e) => {
            if (!e.candidate) {
                sendSignal({ origin: 'host', type: 'offer', sdp: btoa(JSON.stringify(localConnection.localDescription)), publicKey: pubKey });
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
                const packet = JSON.parse(JSON.parse(e.data).message);
                if (packet.type === 'offer' && packet.origin === 'host') {
                    protocolWorker.postMessage({ type: 'DERIVE_KEY', payload: { publicKey: packet.publicKey } });
                    await localConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(atob(packet.sdp))));
                    const answer = await localConnection.createAnswer();
                    await localConnection.setLocalDescription(answer);
                    sendSignal({ origin: 'peer', type: 'answer', sdp: btoa(JSON.stringify(localConnection.localDescription)), publicKey: pubKey });
                    if(sseSource) { sseSource.close(); sseSource = null; }
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

    function setupChannel(chan) {
        dataChannel = chan;
        dataChannel.binaryType = "arraybuffer";
        dataChannel.onopen = () => printLog('SYS', 'P2P Pipeline connected natively.');
        dataChannel.onclose = () => protocolWorker.postMessage({ type: 'PANIC_PURGE' });
        dataChannel.onmessage = (e) => protocolWorker.postMessage({ type: 'DECRYPT_MSG', payload: { buffer: e.data } });
    }

    sendBtn.addEventListener('click', () => {
        const text = textInput.value.trim();
        if (!text || !dataChannel || dataChannel.readyState !== 'open') return;
        protocolWorker.postMessage({ type: 'ENCRYPT_MSG', payload: { text } });
        printLog('HUMAN', text);
        textInput.value = '';
    });
    
    window.addEventListener('beforeunload', () => protocolWorker.postMessage({ type: 'PANIC_PURGE' }));
})();
                
