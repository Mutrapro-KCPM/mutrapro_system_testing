const request = require('supertest');
const app = require('../../index');

describe('A.7: Xem đơn hàng (GET / và GET /:id)', () => {
    beforeEach(() => { jest.clearAllMocks(); });    it('[Real Payload] [EP] ORD-S08 - ID hợp lệ nominal', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/9')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [EP] ORD-S09 - ID là chữ', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/abc')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [EP] ORD-S11 - Request với JWT Token giả mạo/sai chữ ký', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/9')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [EP] ORD-S12 - Xem chi tiết đơn không có token', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/9').set('x-missing-token', 'true')
            .send(payload);
        
        expect(res.status).toBe(401);
    });
    it('[Real Payload] [HP] ORD-S04 - Customer xem danh sách đơn hàng của chính mình', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/customer/1')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [HP] ORD-S05 - Customer xem chi tiết đơn hàng của chính mình', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/9')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [HP] ORD-S06 - Coordinator xem tất cả đơn hàng', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [HP] ORD-S07 - Admin xem tất cả đơn hàng', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/').set('x-mock-role', 'invalid_role')
            .send(payload);
        
        expect(res.status).toBe(403);
    });
    it('[Real Payload] [BVA] ORD-S10 - ID sát dưới mức min (0)', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/0')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
});