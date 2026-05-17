// web-app/src/pages/StudioBookingPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import studioApi from '../api/studioApi';
import { useAuth } from '../context/AuthContext';
import { io } from "socket.io-client";

const StudioBookingPage = () => {
    const { user } = useAuth();
    const [studios, setStudios] = useState([]);
    const [selectedStudio, setSelectedStudio] = useState('');
    const [orderId, setOrderId] = useState('');
    const [startTime, setStartTime] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchStudios = async () => {
            try {
                const data = await studioApi.getStudios();
                setStudios(data);
                const availableStudio = data.find(s => s.status === 'available');
                if (availableStudio) {
                    setSelectedStudio(availableStudio.id);
                }
            } catch (error) {
                console.error("Failed to fetch studios", error);
            }
        };
        fetchStudios();

        const socket = io("http://localhost:3006");
        socket.on('studio_status_updated', (data) => {
            console.log("Nhận được cập nhật trạng thái studio real-time:", data);
            setStudios(prevStudios => 
                prevStudios.map(studio => 
                    studio.id === Number(data.studioId)
                        ? { ...studio, status: data.newStatus } 
                        : studio
                )
            );
        });
        
        return () => {
            socket.disconnect();
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user || !selectedStudio || !startTime || !orderId) {
            toast.warn("Vui lòng điền đầy đủ thông tin.");
            return;
        }
        
        setLoading(true);

        try {
            // SỬA LỖI Ở ĐÂY: Dùng Date object và đẩy cả 2 về chuẩn ISO có múi giờ Z
            const startDateObj = new Date(startTime);
            const endDateObj = new Date(startDateObj.getTime() + 2 * 60 * 60 * 1000);

            await studioApi.createBooking({
                studio_id: selectedStudio,
                artist_id: user.id,
                order_id: orderId,
                start_time: startDateObj.toISOString(),
                end_time: endDateObj.toISOString()
            });
            
            toast.success("Đặt phòng thành công!");
            navigate('/dashboard'); 
        } catch (error) {
            // Hiển thị trực tiếp lỗi từ backend trả về để dễ debug nếu có lỗi khác (vd: trùng giờ)
            const errorMsg = error.response?.data?.message || "Đặt phòng thất bại! Vui lòng kiểm tra lại thông tin.";
            toast.error(errorMsg);
            console.error("Failed to create booking", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-container">
            <form onSubmit={handleSubmit} className="form-card">
                <h2>Đặt Lịch Phòng Thu</h2>
                <div className="form-group">
                    <label>Chọn phòng thu</label>
                    <select value={selectedStudio} onChange={(e) => setSelectedStudio(e.target.value)}>
                        {studios.map(studio => (
                            <option key={studio.id} value={studio.id} disabled={studio.status !== 'available'}>
                                {studio.name} - {studio.location} ({studio.status})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>ID Đơn hàng liên quan</label>
                    <input type="number" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="Nhập ID đơn hàng cần thu âm" required />
                </div>
                <div className="form-group">
                    <label>Thời gian bắt đầu</label>
                    <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                </div>
                <button type="submit" className="form-button" disabled={loading}>
                    {loading ? 'Đang gửi...' : 'Xác nhận Đặt lịch'}
                </button>
            </form>
        </div>
    );
};

export default StudioBookingPage;