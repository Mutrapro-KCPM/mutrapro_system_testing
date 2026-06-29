const express = require('express');
const proxy = require('express-http-proxy');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
const INTERNAL_PROTOCOL = process.env.INTERNAL_SERVICE_PROTOCOL || 'http';
const serviceUrl = (host, port, path = '') => `${INTERNAL_PROTOCOL}://${host}:${port}${path}`;

app.disable('x-powered-by');
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
        auth: serviceUrl('auth-service', 3001, '/health'),
        order: serviceUrl('order-service', 3002, '/health'),
        task: serviceUrl('task-service', 3003, '/health'),
        file: serviceUrl('file-service', 3004, '/health'),
        studio: serviceUrl('studio-service', 3005, '/health'),
        notification: serviceUrl('notification-service', 3006, '/health'),
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
app.use('/api/auth', proxy(serviceUrl('auth-service', 3001)));
app.use('/api/orders', proxy(serviceUrl('order-service', 3002)));
app.use('/api/payments', proxy(serviceUrl('order-service', 3002, '/payments')));
app.use('/api/tasks', proxy(serviceUrl('task-service', 3003)));

// === START: PHẦN CẬP NHẬT CHA�NH NẰM �? ĐA�Y ===
// ThA�m { limit: '50mb' } để cho phA�p upload file nặng
app.use('/api/files', proxy(serviceUrl('file-service', 3004), {
    limit: '50mb' 
}));
// === END: PHẦN CẬP NHẬT ===

app.use('/api/send', proxy(serviceUrl('notification-service', 3006, '/send')));
app.use('/api/studio', proxy(serviceUrl('studio-service', 3005)));
app.use('/api/notifications', proxy(serviceUrl('notification-service', 3006)));
app.use('/api/analytics', proxy(serviceUrl('analytics-service', 3008)));
app.use('/api/reports/overview', proxy(serviceUrl('analytics-service', 3008), {
    proxyReqPathResolver: () => '/reports/overview'
}));

//  d���  Start server
const PORT = 3007;
app.listen(PORT, () => {
    console.log(`API Gateway is running on port ${PORT}`);
});

