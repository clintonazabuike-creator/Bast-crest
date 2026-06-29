// app.js - UI Controller Thread
const protocolWorker = new Worker('assets/js/worker.js');

const initBtn = document.getElementById('init-peer');
const connectBtn = document.getElementById('connect-peer');
const remotePinInput = document.getElementById('remote-pin');
const pinDisplay = document.getElementById('room-id-view');

initBtn.addEventListener('click', function() {
    const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();
    pinDisplay.innerText = 'PIN: ' + generatedPin;
    initBtn.disabled = true;
    
    protocolWorker.postMessage({ type: 'INIT_HOST', payload: { pin: generatedPin } });
});

connectBtn.addEventListener('click', function() {
    const enteredPin = remotePinInput.value.trim();
    if(enteredPin.length !== 4) return;
    connectBtn.disabled = true;
    
    protocolWorker.postMessage({ type: 'INIT_PEER', payload: { pin: enteredPin } });
});

// Worker Feedback Intercept Pipeline
protocolWorker.onmessage = function(e) {
    const { type, payload } = e.data;
    
    switch(type) {
        case 'SYS_LOG':
            console.log(`[Worker Signal]: ${payload}`);
            break;
        case 'LINE_SECURE':
            // Update UI to reveal messaging interface, hide connections
            break;
        case 'RENDER_MSG':
            // Direct append to screen DOM node, do not save anywhere else
            break;
        case 'TERMINATION_COMPLETE':
            window.location.reload();
            break;
    }
};

// Hard physical tripwire execution logic
window.addEventListener('beforeunload', () => {
    protocolWorker.postMessage({ type: 'PANIC_PURGE' });
});

