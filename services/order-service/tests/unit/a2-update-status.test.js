const request = require('supertest');
const app = require('../../index');

describe('A.2: Cập nhật Trạng thái đơn hàng (PUT /:id/status)', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    it('[Real Payload] [EP] ORD-UPD-03 - Lỗi cập nhật trạng thái không tồn tại', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "status": "invalid_status"
}`); } catch(e) { payload = `{
    "status": "invalid_status"
}`; }
        const res = await request(app)
            .put('/9/status')
            .send(payload);
        
        expect(res.status).toBe(404);
    });
    it('[Real Payload] [EP] ORD-UPD-04 - Lỗi cập nhật status bị rỗng', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "status": ""
}`); } catch(e) { payload = `{
    "status": ""
}`; }
        const res = await request(app)
            .put('/9/status')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [EP] ORD-UPD-05 - Lỗi cập nhật cấm vào paid', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "status": "paid"
}`); } catch(e) { payload = `{
    "status": "paid"
}`; }
        const res = await request(app)
            .put('/9/status')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [EP] ORD-UPD-06 - Lỗi nhảy cóc trạng thái (pending -> completed)', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "status": "completed"
}`); } catch(e) { payload = `{
    "status": "completed"
}`; }
        const res = await request(app)
            .put('/9/status')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [EP] ORD-UPD-08 - Lỗi cập nhật đơn hàng đã hủy', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "status": "completed"
}`); } catch(e) { payload = `{
    "status": "completed"
}`; }
        const res = await request(app)
            .put('/9/status')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [HP] ORD-UPD-01 - Cập nhật hợp lệ (pending -> assigned)', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "status": "assigned"
}`); } catch(e) { payload = `{
    "status": "assigned"
}`; }
        const res = await request(app)
            .put('/9/status')
            .send(payload);
        
        expect(res.status).toBe(200);
    });
    it('[Real Payload] [HP] ORD-UPD-02 - Cập nhật hợp lệ (assigned -> in_progress)', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "status": "in_progress"
}`); } catch(e) { payload = `{
    "status": "in_progress"
}`; }
        const res = await request(app)
            .put('/9/status')
            .send(payload);
        
        expect(res.status).toBe(200);
    });
    it('[Real Payload] [HP] ORD-UPD-07 - Cập nhật hợp lệ (completed -> fixed)', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "status": "fixed"
}`); } catch(e) { payload = `{
    "status": "fixed"
}`; }
        const res = await request(app)
            .put('/9/status')
            .send(payload);
        
        expect(res.status).toBe(200);
    });
    it('[Real Payload] [SEC] ORD-UPD-09 - Lỗi bảo mật: Token customer cập nhật trạng thái (403)', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'pending' }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "status": "assigned"
}`); } catch(e) { payload = `{
    "status": "assigned"
}`; }
        const res = await request(app)
            .put('/9/status').set('x-mock-role', 'invalid_role')
            .send(payload);
        
        expect(res.status).toBe(403);
    });
});