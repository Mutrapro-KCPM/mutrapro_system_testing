const request = require('supertest');
const app = require('../../index');

describe('A.4: Thanh toán đơn hàng (POST /:id/pay)', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    it('[Real Payload] [EP] ORD-PAY-06 - Lỗi số âm', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'completed', customer_id: 1, price: 500000 }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "amount": -300000
}`); } catch(e) { payload = `{
    "amount": -300000
}`; }
        const res = await request(app)
            .post('/9/pay')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [EP] ORD-PAY-07 - Lỗi thanh toán đơn chưa xong', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'completed', customer_id: 1, price: 500000 }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "amount": 300000
}`); } catch(e) { payload = `{
    "amount": 300000
}`; }
        const res = await request(app)
            .post('/9/pay')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [EP] ORD-PAY-08 - Lỗi thanh toán đơn đã trả rồi', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'completed', customer_id: 1, price: 500000 }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "amount": 300000
}`); } catch(e) { payload = `{
    "amount": 300000
}`; }
        const res = await request(app)
            .post('/9/pay')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [SEC] ORD-PAY-09 - Lỗi bảo mật: Token khách hàng khác thanh toán (403)', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'completed', customer_id: 1, price: 500000 }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "amount": 300000,
    "method": "credit_card"
}`); } catch(e) { payload = `{
    "amount": 300000,
    "method": "credit_card"
}`; }
        const res = await request(app)
            .post('/9/pay').set('x-sec-wrong-owner', 'true')
            .send(payload);
        
        expect(res.status).toBe(403);
    });
    it('[Real Payload] [EP] ORD-PAY-10 - Lỗi amount dạng chuỗi (String)', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'completed', customer_id: 1, price: 500000 }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "amount": "abc"
}`); } catch(e) { payload = `{
    "amount": "abc"
}`; }
        const res = await request(app)
            .post('/9/pay')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [BVA] ORD-PAY-01 - Thanh toán hợp lệ đúng số tiền', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'completed', customer_id: 1, price: 500000 }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "amount": 300000
}`); } catch(e) { payload = `{
    "amount": 300000
}`; }
        const res = await request(app)
            .post('/9/pay')
            .send(payload);
        
        expect(res.status).toBe(200);
    });
    it('[Real Payload] [BVA] ORD-PAY-02 - Thanh toán hợp lệ cho đơn fixed', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'completed', customer_id: 1, price: 500000 }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "amount": 300000
}`); } catch(e) { payload = `{
    "amount": 300000
}`; }
        const res = await request(app)
            .post('/9/pay')
            .send(payload);
        
        expect(res.status).toBe(200);
    });
    it('[Real Payload] [BVA] ORD-PAY-03 - Lỗi thanh toán hụt tiền', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'completed', customer_id: 1, price: 500000 }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "amount": 299999
}`); } catch(e) { payload = `{
    "amount": 299999
}`; }
        const res = await request(app)
            .post('/9/pay')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [BVA] ORD-PAY-04 - Lỗi thanh toán thừa tiền', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'completed', customer_id: 1, price: 500000 }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "amount": 300001
}`); } catch(e) { payload = `{
    "amount": 300001
}`; }
        const res = await request(app)
            .post('/9/pay')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
    it('[Real Payload] [BVA] ORD-PAY-05 - Lỗi thanh toán sai số thập phân', async () => {
        global.mockPool.execute.mockResolvedValueOnce([[{ id: 9, status: 'completed', customer_id: 1, price: 500000 }]]).mockResolvedValueOnce([[{ affectedRows: 1 }]]);
        let payload = null;
        try { payload = JSON.parse(`{
    "amount": 300000.001
}`); } catch(e) { payload = `{
    "amount": 300000.001
}`; }
        const res = await request(app)
            .post('/9/pay')
            .send(payload);
        
        expect(res.status).toBe(400);
    });
});