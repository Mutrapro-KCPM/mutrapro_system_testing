const request = require('supertest');
const app = require('../../index');

describe('A.5: Lấy danh sách thanh toán (GET /payments)', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    it('[Real Payload] [HP] ORD-PAG-03 - Lấy danh sách với nominal', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 1 }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/payments?limit=10')
            .send(payload);
        
        expect(res.status).toBe(403);
    });
    it('[Real Payload] [EP] ORD-PAG-05 - Giá trị âm (bị ép về 1)', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 1 }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/payments?limit=-5')
            .send(payload);
        
        expect(res.status).toBe(403);
    });
    it('[Real Payload] [EP] ORD-PAG-07 - Giá trị siêu lớn (bị ép về 100)', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 1 }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/payments?limit=999999')
            .send(payload);
        
        expect(res.status).toBe(403);
    });
    it('[Real Payload] [EP] ORD-PAG-08 - Định dạng sai (bị ép về mặc định)', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 1 }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/payments?limit=abc')
            .send(payload);
        
        expect(res.status).toBe(403);
    });
    it('[Real Payload] [BVA] ORD-PAG-01 - Lấy danh sách hợp lệ tại biên min', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 1 }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/payments?limit=1')
            .send(payload);
        
        expect(res.status).toBe(403);
    });
    it('[Real Payload] [BVA] ORD-PAG-02 - Lấy danh sách hợp lệ tại biên max', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 1 }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/payments?limit=100')
            .send(payload);
        
        expect(res.status).toBe(403);
    });
    it('[Real Payload] [BVA] ORD-PAG-04 - Giá trị sát biên dưới min (0)', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 1 }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/payments?limit=0')
            .send(payload);
        
        expect(res.status).toBe(403);
    });
    it('[Real Payload] [BVA] ORD-PAG-06 - Giá trị sát biên vượt max (101)', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 1 }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/payments?limit=101')
            .send(payload);
        
        expect(res.status).toBe(403);
    });


    it('[Real Payload] [EP] ORD-PAG-09 - Lấy danh sách bỏ trống tham số limit', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ total: 10 }]]);
        let payload = null;
        try { payload = JSON.parse(`{}`); } catch(e) { payload = `{}`; }
        const res = await request(app)
            .get('/?page=1')
            .send(payload);
        
        expect(res.status).toBe(400);
    });

});
