// web-app/src/pages/CreateOrderPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import orderApi from '../api/orderApi';
import fileApi from '../api/fileApi';

const CreateOrderPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [serviceType, setServiceType] = useState('transcription');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);

    // Đồng bộ danh sách đuôi file hợp lệ với config audio bên file-service
    const ALLOWED_EXTENSIONS = ['.mp3', '.mp4', '.m4a', '.wav'];

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!user) {
            toast.error('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');
            return;
        }

        // ======================= PHẦN FIX LỖI =======================
        // Kiểm tra định dạng file ngay tại client TRƯỚC KHI tạo đơn hàng
        if (file) {
            const fileName = file.name.toLowerCase();
            const isValidFormat = ALLOWED_EXTENSIONS.some(ext => fileName.endsWith(ext));
            
            if (!isValidFormat) {
                toast.error(`Vui lòng chọn định dạng file hợp lệ (${ALLOWED_EXTENSIONS.join(', ')}).`);
                return; // Dừng thực thi, không gọi API orderApi.createOrder
            }
        }
        // ============================================================

        setLoading(true);

        let price = 0;
        switch (serviceType) {
            case 'transcription':
                price = 300000;
                break;
            case 'arrangement':
                price = 800000;
                break;
            case 'recording':
                price = 500000;
                break;
            default:
                price = 0;
        }

        try {
            // Bước 1: Tạo đơn hàng
            const orderData = {
                customer_id: user.id,
                service_type: serviceType,
                description: description,
                price: price 
            };
            const newOrder = await orderApi.createOrder(orderData);

            // Bước 2: Upload file (lúc này chắc chắn file đã đúng định dạng)
            if (file) {
                await fileApi.uploadFile(file, newOrder.id, 'audio');
            }

            toast.success('Tạo đơn hàng thành công!');
            navigate('/orders/history');
        } catch (err) {
            toast.error(err.message || 'Tạo đơn hàng thất bại. Vui lòng thử lại.');
            console.error("Create order failed:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-container">
            <form onSubmit={handleSubmit} className="form-card">
                <h2>Tạo Yêu Cầu Dịch Vụ Mới</h2>
                <div className="form-group">
                    <label>Chọn loại dịch vụ</label>
                    <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                        <option value="transcription">Ký âm (Transcription) - 300.000 VNĐ</option>
                        <option value="arrangement">Hòa âm, Phối khí (Arrangement) - 800.000 VNĐ</option>
                        <option value="recording">Thu âm (Recording) - 500.000 VNĐ</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Mô tả chi tiết yêu cầu</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        rows="5"
                        placeholder="Ví dụ: Em cần ký âm bài hát 'See Tình' của Hoàng Thùy Linh..."
                        style={{ resize: 'none', width: '339px' }}
                    />
                </div>
                <div className="form-group">
                    <label>Tải lên tệp âm thanh (MP3, MP4, WAV...)</label>
                    <input
                        type="file"
                        onChange={handleFileChange}
                        accept=".mp3,.mp4,.wav,.m4a"
                        className="file-input"
                    />
                </div>
                <button type="submit" className="form-button" disabled={loading}>
                    {loading ? 'Đang gửi yêu cầu...' : 'Gửi Yêu Cầu'}
                </button>
            </form>
        </div>
    );
};

export default CreateOrderPage;