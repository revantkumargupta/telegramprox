// MTProxy for Render.com
// Simple but working MTProxy implementation

const net = require('net');
const crypto = require('crypto');

const PORT = process.env.PORT || 8443;
const SECRET = 'dd00000000000000000000000000000001';

// Telegram servers (official DCs)
const TELEGRAM_SERVERS = [
    { host: '149.154.175.50', port: 443 }, // DC1
    { host: '149.154.167.51', port: 443 }, // DC2  
    { host: '149.154.175.100', port: 443 }, // DC3
    { host: '149.154.167.91', port: 443 }, // DC4
    { host: '149.154.171.5', port: 443 }   // DC5
];

function createMTProxy() {
    const server = net.createServer((clientSocket) => {
        console.log(`New MTProxy connection from: ${clientSocket.remoteAddress}`);
        
        let targetSocket = null;
        let handshakeComplete = false;
        let buffer = Buffer.alloc(0);

        clientSocket.on('data', (data) => {
            buffer = Buffer.concat([buffer, data]);
            
            if (!handshakeComplete) {
                // Wait for initial handshake (64 bytes minimum)
                if (buffer.length >= 64) {
                    handleHandshake(buffer, clientSocket, (socket) => {
                        if (socket) {
                            targetSocket = socket;
                            handshakeComplete = true;
                            setupBidirectionalForwarding(clientSocket, targetSocket);
                            
                            // Send any remaining data
                            if (buffer.length > 64) {
                                const remainingData = buffer.slice(64);
                                targetSocket.write(remainingData);
                            }
                        }
                    });
                    buffer = Buffer.alloc(0); // Clear buffer after handshake
                }
            } else if (targetSocket) {
                // Forward data to Telegram servers
                targetSocket.write(data);
            }
        });

        clientSocket.on('error', (err) => {
            console.error('Client error:', err);
            if (targetSocket) targetSocket.destroy();
        });

        clientSocket.on('close', () => {
            console.log('Client disconnected');
            if (targetSocket) targetSocket.destroy();
        });
    });

    return server;
}

function handleHandshake(data, clientSocket, callback) {
    try {
        // Simple handshake - select random Telegram server
        const server = TELEGRAM_SERVERS[Math.floor(Math.random() * TELEGRAM_SERVERS.length)];
        
        console.log(`Connecting to Telegram: ${server.host}:${server.port}`);
        
        const targetSocket = net.createConnection(server.port, server.host, () => {
            console.log(`Connected to Telegram server: ${server.host}:${server.port}`);
            
            // Send handshake data to Telegram
            targetSocket.write(data);
            
            callback(targetSocket);
        });

        targetSocket.on('error', (err) => {
            console.error('Telegram connection error:', err);
            clientSocket.destroy();
            callback(null);
        });

    } catch (error) {
        console.error('Handshake error:', error);
        clientSocket.destroy();
        callback(null);
    }
}

function setupBidirectionalForwarding(clientSocket, targetSocket) {
    // Forward data from Telegram to client
    targetSocket.on('data', (data) => {
        try {
            clientSocket.write(data);
        } catch (error) {
            console.error('Error forwarding to client:', error);
            targetSocket.destroy();
        }
    });

    targetSocket.on('close', () => {
        console.log('Telegram connection closed');
        clientSocket.destroy();
    });

    targetSocket.on('error', (err) => {
        console.error('Telegram socket error:', err);
        clientSocket.destroy();
    });
}

// Start MTProxy server
const server = createMTProxy();

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MTProxy server running on port ${PORT}`);
    console.log(`📱 Add to Telegram:`);
    console.log(`   Method 1: Use this link:`);
    console.log(`   https://t.me/proxy?server=your-app.onrender.com&port=${PORT}&secret=${SECRET}`);
    console.log(`   Method 2: Manual setup:`);
    console.log(`   Server: your-app.onrender.com`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Secret: ${SECRET}`);
    console.log(`\n⚠️  Note: Replace 'your-app' with your actual Render app name`);
});

server.on('error', (err) => {
    console.error('MTProxy server error:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down MTProxy server...');
    server.close(() => {
        console.log('MTProxy server stopped');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down...');
    server.close(() => {
        console.log('MTProxy server stopped');
        process.exit(0);
    });
});
