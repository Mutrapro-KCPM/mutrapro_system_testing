const express = require('express');
const proxy = require('express-http-proxy');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));

// Health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API Gateway is running',
        data: {
            service: 'api-gateway',
            status: 'ok',
            timestamp: new Date().toISOString()
        }
    });
});

app.get('/api/health/all', async (req, res) => {
    const services = {
        auth: 'http://auth-service:3001/health',
        order: 'http://order-service:3002/health',
        task: 'http://task-service:3003/health',
        file: 'http://file-service:3004/health',
        studio: 'http://studio-service:3005/health',
        notification: 'http://notification-service:3006/health',
    };
    const results = {};
    for (const [name, url] of Object.entries(services)) {
        try {
            const response = await fetch(url);
            const data = await response.json();
            results[name] = { status: data.status || 'ok', timestamp: data.timestamp };
        } catch {
            results[name] = { status: 'error', message: 'Service unreachable' };
        }
    }
    res.json({
        success: true,
        message: 'Health check completed',
        data: results
    });
});

//  d���  Proxy routes
app.use('/api/auth', proxy('http://auth-service:3001'));
app.use('/api/orders', proxy('http://order-service:3002'));
app.use('/api/payments', proxy('http://order-service:3002/payments'));
app.use('/api/tasks', proxy('http://task-service:3003'));

// === START: PHẦN CẬP NHẬT CHA�NH NẰM �? ĐA�Y ===
// ThA�m { limit: '50mb' } để cho phA�p upload file nặng
app.use('/api/files', proxy('http://file-service:3004', {
    limit: '50mb' 
}));
// === END: PHẦN CẬP NHẬT ===

app.use('/api/send', proxy('http://notification-service:3006/send'));
app.use('/api/studio', proxy('http://studio-service:3005'));
app.use('/api/notifications', proxy('http://notification-service:3006'));
app.use('/api/analytics', proxy('http://analytics-service:3008'));
app.use('/api/reports', proxy('http://analytics-service:3008/reports'));

//  d���  Start server
const PORT = 3007;
app.listen(PORT, () => {
    console.log(`API Gateway is running on port ${PORT}`);
});

