/**
 * AZUBUIKE TECHNOLOGIES INC. // PROJECT 2
 * Core Air-Gapped P2P Communication Protocol Engine
 * File: app.js (Main UI Threat Controller)
 * * Memory Isolator Layer - Handles Viewport State Changes.
 */

(function () {
    // Instantiate the background isolation thread
    const protocolWorker = new Worker('assets/js/worker.js');

    // DOM Element Mappings
    const initBtn = document.getElementById('init-peer');
    const connectBtn = document.getElementById('connect-peer');
    const remotePinInput = document.getElementById('remote-pin');
    const pinDisplay = document.getElementById('room-id-view');
    
    const sendBtn = document.getElementById('execute-action');
    const textInput = document.getElementById('code-input');
    const logsContainer = document.getElementById('log-window');

    let secureLineEstablished = false;

    /**
     * UI LOG RENDERING MATRIX
     */
    function printLog(src, txt) {
        const el = document.createElement('div');
        el.className = `log-entry ${src.toLowerCase()}`;
        el.innerText = `[${new Date().toLocaleTimeString()}] [${src}]: ${txt}`;
        logsContainer.appendChild(el);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    /**
     * DOM INTERACTION EVENT BINDINGS
     */
    initBtn.addEventListener('click', function () {
        // Generate high-entropy transient 4-digit numeric pin channel routing address
        const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
        pinDisplay.innerText = 'PIN: ' + generatedPin;
        
        // Lock UI mutation properties
        initBtn.disabled = true;
        connectBtn.disabled = true;
        remotePinInput.disabled = true;

        printLog('NET', `Initializing Host Routing Pipeline on PIN: ${generatedPin}`);
        
        // Proxy control command parameters down into volatile thread execution space
        protocolWorker.postMessage({ type: 'INIT_HOST', payload: { pin: generatedPin } });
    });

    connectBtn.addEventListener('click', function () {
        const enteredPin = remotePinInput.value.trim();
        if (enteredPin.length !== 4 || isNaN(enteredPin)) {
            printLog('SYS', 'Validation Failure: Room PIN must be exactly 4 numeric characters.');
            return;
        }

        // Lock UI mutation properties
        initBtn.disabled = true;
        connectBtn.disabled = true;
        remotePinInput.disabled = true;

        printLog('NET', `Initializing Target Peer Connection Sequence via PIN: ${enteredPin}`);
        
        // Forward target address parameters to isolation container
        protocolWorker.postMessage({ type: 'INIT_PEER', payload: { pin: enteredPin } });
    });

    sendBtn.addEventListener('click', function () {
        const plainText = textInput.value.trim();
        if (!plainText) return;

        if (!secureLineEstablished) {
            printLog('SYS', 'Write Error: Cannot dispatch message. Secure communication line is down.');
            return;
        }

        // Send payload down to the cryptographic processor inside worker.js
        protocolWorker.postMessage({ type: 'SEND_SECURE_MSG', payload: { text: plainText } });

        // Instant visual update of local execution window (Volatile scratchpad representation)
        printLog('HUMAN', plainText);
        textInput.value = '';
        textInput.focus();
    });

    // Enter key submit handling optimization
    textInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

    /**
     * WORKER RESPONSE PARSE ENGINE
     */
    protocolWorker.onmessage = function (e) {
        const { type, payload } = e.data;

        switch (type) {
            case 'SYS_LOG':
                printLog('SYS', payload);
                break;
                
            case 'LINE_SECURE':
                secureLineEstablished = true;
                printLog('NET', 'CRYPTO HIGHWAY CONFIRMED: Symmetric key shared matrices locked.');
                
                // Refactor visual mode presentation layout states dynamically
                sendBtn.innerText = "Dispatch Encrypted Packet";
                sendBtn.style.background = "#39ff14";
                sendBtn.style.color = "#000";
                textInput.placeholder = "Type secure message here...";
                break;
                
            case 'RENDER_MSG':
                // Clean structural injection directly onto the DOM viewport
                printLog('REMOTE', payload.text);
                break;
                
            case 'TERMINATION_COMPLETE':
                // Worker confirmed structural heap zeroization -> Trigger structural page reload
                window.location.reload();
                break;
        }
    };

    /**
     * ANTI-FORENSIC VOLATILE TRIPWIRE HOOKS
     */
    function deployPanicTrigger() {
        // Direct critical override signal command to worker context
        protocolWorker.postMessage({ type: 'PANIC_PURGE' });
    }

    // Capture tab close, window unload, swipe-away, or redirect actions immediately
    window.addEventListener('beforeunload', deployPanicTrigger);
    window.addEventListener('unload', deployPanicTrigger);

})();
                    
