import WebSocket from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:3000/ws/widget';
const API_KEY = process.env.API_KEY || 'wk_test_abc123def456';

function timestamp() {
    return new Date().toISOString();
}

function log(type, message, data = null) {
    const prefix = {
        'info': '📘',
        'success': '✅',
        'error': '❌',
        'recv': '📥',
        'send': '📤',
        'ping': '🏓',
    }[type] || '📝';

    console.log(`[${timestamp()}] ${prefix} ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
}

function connect() {
    log('info', `Connecting to ${WS_URL}...`);

    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        log('success', 'Connection opened');

        const auth_message = { type: 'auth', api_key: API_KEY };
        log('send', 'Sending auth message', auth_message);
        ws.send(JSON.stringify(auth_message));
    });

    ws.on('message', (data) => {
        const message = data.toString();

        if (message === 'pong') {
            log('ping', 'Received pong');
            return;
        }

        try {
            const parsed = JSON.parse(message);
            log('recv', `Received message (type: ${parsed.type || 'unknown'})`, parsed);
        } catch {
            log('recv', `Received raw message: ${message}`);
        }
    });

    ws.on('ping', () => {
        log('ping', 'Received ping from server');
    });

    ws.on('pong', () => {
        log('ping', 'Received pong from server');
    });

    ws.on('close', (code, reason) => {
        log('info', `Connection closed - code: ${code}, reason: ${reason.toString() || 'none'}`);
    });

    ws.on('error', (error) => {
        log('error', `WebSocket error: ${error.message}`);
    });

    // Send ping every 25 seconds to keep connection alive
    const ping_interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            log('ping', 'Sending ping');
            ws.send('ping');
        }
    }, 25000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        log('info', 'Shutting down...');
        clearInterval(ping_interval);
        ws.close();
        process.exit(0);
    });
}

log('info', '=== Widget WebSocket Test Client ===');
log('info', `URL: ${WS_URL}`);
log('info', `API Key: ${API_KEY}`);
log('info', 'Press Ctrl+C to exit\n');

connect();
