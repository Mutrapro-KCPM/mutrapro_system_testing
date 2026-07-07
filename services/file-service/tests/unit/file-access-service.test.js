// tests/unit/file-access-service.test.js
// Unit tests for fileAccessService functions: parsePositiveInt, assertCanUpload, assertCanReadOrderFiles

process.env.NODE_ENV = 'test';

jest.mock('axios');

const axios = require('axios');
const { parsePositiveInt, assertCanUpload, assertCanReadOrderFiles } = require('../../services/fileAccessService');

describe('fileAccessService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================================
    // parsePositiveInt
    // ============================================================
    describe('parsePositiveInt', () => {
        test('nhận số hợp lệ và trả về kiểu number', () => {
            expect(parsePositiveInt('123', 'testField')).toBe(123);
            expect(parsePositiveInt(456, 'testField')).toBe(456);
        });

        test('lỗi với giá trị 0', () => {
            expect(() => parsePositiveInt('0', 'testField')).toThrow('testField must be a positive integer.');
        });

        test('lỗi với số âm', () => {
            expect(() => parsePositiveInt('-5', 'testField')).toThrow('testField must be a positive integer.');
        });

        test('lỗi với chữ hoặc giá trị không hợp lệ', () => {
            expect(() => parsePositiveInt('abc', 'testField')).toThrow('testField must be a positive integer.');
            expect(() => parsePositiveInt('', 'testField')).toThrow('testField must be a positive integer.');
            expect(() => parsePositiveInt(null, 'testField')).toThrow('testField must be a positive integer.');
        });
    });

    // ============================================================
    // assertCanUpload (Role file types & order access)
    // ============================================================
    describe('assertCanUpload - Phân quyền loại file theo role', () => {
        const orderId = 10;
        const token = 'mock_token';

        // Helper mock cho order-service
        const mockOrderResponse = (customerId) => {
            axios.get.mockImplementation((url) => {
                if (url.includes('order-service')) {
                    return Promise.resolve({ data: { id: orderId, customer_id: customerId } });
                }
                return Promise.reject(new Error('unmatched url'));
            });
        };

        // Helper mock cho task-service
        const mockTaskResponse = (assignedToId) => {
            axios.get.mockImplementation((url) => {
                if (url.includes('task-service')) {
                    return Promise.resolve({ data: { assigned_to: assignedToId } });
                }
                return Promise.reject(new Error('unmatched url'));
            });
        };

        test('customer chỉ upload audio', async () => {
            mockOrderResponse(1);

            // Cho phép upload audio
            await expect(assertCanUpload({
                user: { id: 1, role: 'customer' },
                token,
                orderId,
                fileType: 'audio'
            })).resolves.not.toThrow();

            // Cấm upload notation, mix, final
            const invalidTypes = ['notation', 'mix', 'final'];
            for (const fileType of invalidTypes) {
                await expect(assertCanUpload({
                    user: { id: 1, role: 'customer' },
                    token,
                    orderId,
                    fileType
                })).rejects.toThrow('You are not allowed to upload this file type.');
            }
        });

        test('transcriber chỉ upload notation', async () => {
            mockTaskResponse(3);

            // Cho phép upload notation
            await expect(assertCanUpload({
                user: { id: 3, role: 'transcriber' },
                token,
                orderId,
                fileType: 'notation'
            })).resolves.not.toThrow();

            // Cấm upload audio, mix, final
            const invalidTypes = ['audio', 'mix', 'final'];
            for (const fileType of invalidTypes) {
                await expect(assertCanUpload({
                    user: { id: 3, role: 'transcriber' },
                    token,
                    orderId,
                    fileType
                })).rejects.toThrow('You are not allowed to upload this file type.');
            }
        });

        test('arranger chỉ upload mix', async () => {
            mockTaskResponse(4);

            // Cho phép upload mix
            await expect(assertCanUpload({
                user: { id: 4, role: 'arranger' },
                token,
                orderId,
                fileType: 'mix'
            })).resolves.not.toThrow();

            // Cấm upload audio, notation, final
            const invalidTypes = ['audio', 'notation', 'final'];
            for (const fileType of invalidTypes) {
                await expect(assertCanUpload({
                    user: { id: 4, role: 'arranger' },
                    token,
                    orderId,
                    fileType
                })).rejects.toThrow('You are not allowed to upload this file type.');
            }
        });

        test('artist chỉ upload audio', async () => {
            mockTaskResponse(5);

            // Cho phép upload audio
            await expect(assertCanUpload({
                user: { id: 5, role: 'artist' },
                token,
                orderId,
                fileType: 'audio'
            })).resolves.not.toThrow();

            // Cấm upload notation, mix, final
            const invalidTypes = ['notation', 'mix', 'final'];
            for (const fileType of invalidTypes) {
                await expect(assertCanUpload({
                    user: { id: 5, role: 'artist' },
                    token,
                    orderId,
                    fileType
                })).rejects.toThrow('You are not allowed to upload this file type.');
            }
        });

        test('coordinator/admin upload được mọi loại file', async () => {
            const allTypes = ['audio', 'notation', 'mix', 'final'];
            const roles = ['coordinator', 'admin'];

            for (const role of roles) {
                for (const fileType of allTypes) {
                    await expect(assertCanUpload({
                        user: { id: 20, role },
                        token,
                        orderId,
                        fileType
                    })).resolves.not.toThrow();
                }
            }
            // Không thực hiện gọi axios do role admin/coordinator được bỏ qua checks
            expect(axios.get).not.toHaveBeenCalled();
        });
    });

    // ============================================================
    // assertCanReadOrderFiles / canAccessOrder
    // ============================================================
    describe('canAccessOrder & assertCanReadOrderFiles - Quyền truy cập order', () => {
        const orderId = 10;
        const token = 'mock_token';

        test('customer chỉ đọc file nếu order.customer_id trùng user.id', async () => {
            // Trường hợp khớp
            axios.get.mockResolvedValueOnce({ data: { id: orderId, customer_id: 1 } });
            await expect(assertCanReadOrderFiles({
                user: { id: 1, role: 'customer' },
                token,
                orderId
            })).resolves.not.toThrow();

            // Trường hợp không khớp
            axios.get.mockResolvedValueOnce({ data: { id: orderId, customer_id: 2 } });
            await expect(assertCanReadOrderFiles({
                user: { id: 1, role: 'customer' },
                token,
                orderId
            })).rejects.toThrow('You are not allowed to access files for this order.');
        });

        test('specialist chỉ đọc file nếu task.assigned_to trùng user.id', async () => {
            // Trường hợp transcriber khớp task.assigned_to
            axios.get.mockResolvedValueOnce({ data: { assigned_to: 3 } });
            await expect(assertCanReadOrderFiles({
                user: { id: 3, role: 'transcriber' },
                token,
                orderId
            })).resolves.not.toThrow();

            // Trường hợp transcriber không khớp task.assigned_to
            axios.get.mockResolvedValueOnce({ data: { assigned_to: 9 } });
            await expect(assertCanReadOrderFiles({
                user: { id: 3, role: 'transcriber' },
                token,
                orderId
            })).rejects.toThrow('You are not allowed to access files for this order.');

            // Trường hợp task-service trả về 404 (không có task)
            axios.get.mockRejectedValueOnce({ response: { status: 404 } });
            await expect(assertCanReadOrderFiles({
                user: { id: 3, role: 'transcriber' },
                token,
                orderId
            })).rejects.toThrow('You are not allowed to access files for this order.');
        });

        test('admin/coordinator đọc được mọi order', async () => {
            const roles = ['admin', 'coordinator'];
            for (const role of roles) {
                await expect(assertCanReadOrderFiles({
                    user: { id: 20, role },
                    token,
                    orderId
                })).resolves.not.toThrow();
            }
            expect(axios.get).not.toHaveBeenCalled();
        });
    });
});
