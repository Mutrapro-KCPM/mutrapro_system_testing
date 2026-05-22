// web-app/src/pages/OrderDetailsPage.js (ĐÃ CẬP NHẬT)
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import orderApi from '../api/orderApi';
import fileApi from '../api/fileApi';
import FeedbackForm from '../components/FeedbackForm';
import PaymentConfirmModal from '../components/PaymentConfirmModal';

// === START: THÊM HÀM FORMAT TRẠNG THÁI ===
const STATUS_LABELS = {
    pending: 'Chờ xử lý',
    assigned: 'Đã phân công',
    in_progress: 'Đang thực hiện',
    completed: 'Hoàn thành',
    revision_requested: 'Yêu cầu chỉnh sửa',
    fixed: 'Đã chỉnh sửa',
    paid: 'Đã thanh toán',
    cancelled: 'Đã hủy'
};

const formatStatusText = (status) => STATUS_LABELS[status] || status;
// === END: THÊM HÀM FORMAT TRẠNG THÁI ===

// Component Revision Modal (Giữ nguyên)
const RevisionRequestModal = ({ order, onClose, onSubmit, loading }) => {
    const [comment, setComment] = useState('');
    const handleSubmit = () => {
        if (!comment.trim()) {
            toast.warn('Vui lòng nhập lý do cần chỉnh sửa.');
            return;
        }
        onSubmit(comment);
    };
    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h2>Yêu cầu chỉnh sửa cho đơn hàng #{order.id}</h2>
                <p>Vui lòng mô tả chi tiết những điểm bạn muốn chuyên viên thay đổi.
                Yêu cầu của bạn sẽ được gửi đến Điều phối viên.</p>
                <div className="form-group">
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows="5"
                        placeholder="Ví dụ: Vui lòng tăng tốc độ ở đoạn điệp khúc và thêm tiếng piano..."
                        style={{ width: '100%', color: '#333', backgroundColor: '#fff', border: '1px solid #ccc', padding: '10px' }}
                    />
                </div>
                <div className="modal-actions">
                    <button onClick={onClose} className="form-button secondary" disabled={loading}>
                        Hủy
                    </button>
                    <button onClick={handleSubmit} className="form-button" disabled={loading}>
                        {loading ? 'Đang gửi...' : 'Gửi Yêu Cầu'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const OrderDetailsPage = () => {
    const { orderId } = useParams();
    const { user } = useAuth();
    const [order, setOrder] = useState(null);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    // Bỏ state hasFeedback vì order giờ đã chứa thông tin đó
    // const [hasFeedback, setHasFeedback] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [showRevisionModal, setShowRevisionModal] = useState(false);
    const [revisionLoading, setRevisionLoading] = useState(false);

    const fetchData = useCallback(async () => {
        if (!orderId) return;
        try {
            setLoading(true);
            // Giờ chỉ cần gọi 2 API, vì feedback đã có trong orderData
            const [orderData, filesData] = await Promise.all([
                orderApi.getOrderById(orderId),
                fileApi.getFilesByOrder(orderId),
            ]);
            setOrder(orderData);
            setFiles(filesData);
            // setHasFeedback(feedbackData.hasFeedback); // Bỏ
        } catch (error) {
            console.error("Failed to fetch order details:", error);
            toast.error("Không thể tải chi tiết đơn hàng.");
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Hàm handlePayment (Giữ nguyên)
    const handlePayment = async () => {
        if (!user || !order) return;
        setPaymentLoading(true);
        try {
            await orderApi.payForOrder(order.id, {
                customer_id: user.id,
                amount: order.price,
                method: 'credit_card'
            });
            toast.success("Thanh toán thành công!");
            setShowPaymentModal(false);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.error || "Thanh toán thất bại!");
        } finally {
            setPaymentLoading(false);
        }
    };

    // Hàm handleRequestRevision (Giữ nguyên)
    const handleRequestRevision = async (comment) => {
        setRevisionLoading(true);
        try {
            // Giả sử ID 2 là của Coordinator
            await orderApi.requestRevision(order.id, { comment, coordinatorId: 2 });
            toast.success('Yêu cầu chỉnh sửa đã được gửi đi!');
            setShowRevisionModal(false);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.error || "Gửi yêu cầu thất bại!");
        } finally {
            setRevisionLoading(false);
        }
    };

    if (loading) return <div className="page-container"><p>Đang tải chi tiết đơn hàng...</p></div>;
    if (!order) return <div className="page-container"><p>Không tìm thấy đơn hàng.</p></div>;

    // Cập nhật logic:
    // 1. Dùng order.rating để kiểm tra feedback
    // 2. hasFeedback = (order.rating !== null)
    const hasFeedback = order.rating != null;
    const canShowFeedbackForm = user && user.role === 'customer' && order.status === 'paid' && !hasFeedback;
    const canRequestRevision = user && user.role === 'customer' && (order.status === 'completed' || order.status === 'fixed');
    return (
        <>
            <div className="page-container" style={{ alignItems: 'flex-start', maxWidth: '1000px', margin: 'auto' }}>
                <h2>Chi Tiết Đơn Hàng #{order.id}</h2>
                <div className="dashboard-features">
                    
                    {/* === START: THÊM DÒNG MỚI === */}
                    {/* Chỉ hiển thị nếu có tên (hữu ích cho Admin/Coordinator) */}
                    {order.customer_name && (
                        <p><strong>Khách hàng:</strong> {order.customer_name} (ID: {order.customer_id})</p>
                    )}
                    {/* === END: THÊM DÒNG MỚI === */}

                    <p><strong>Dịch vụ:</strong> {order.service_type}</p>
                    <p><strong>Mô tả:</strong> {order.description}</p>
                    {/* === START: SỬA HIỂN THỊ TRẠNG THÁI === */}
                    <p><strong>Trạng thái:</strong> <span style={{ fontWeight: 'bold' }}>{formatStatusText(order.status)}</span></p>
                    {/* === END: SỬA HIỂN THỊ TRẠNG THÁI === */}
                    <p><strong>Ngày tạo:</strong> {new Date(order.created_at).toLocaleString()}</p>
                    
                    {/* === START: HIỂN THỊ COMMENT (FIX 1.1) === */}
                    {order.rating != null && (
                        <p><strong>Đánh giá:</strong> {' ⭐ '.repeat(order.rating)}</p>
                    )}
                    {order.comment && (
                        <p><strong>Bình luận:</strong> {order.comment}</p>
                    )}
                    {/* === END: HIỂN THỊ COMMENT === */}
                    
                    {user && user.role === 'customer' && (order.status === 'completed' || order.status === 'fixed') && (
                        <button onClick={() => setShowPaymentModal(true)} className="form-button" style={{ marginTop: '20px' }}>
                            Thanh toán ngay
                        </button>
                    )}
                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                        {canRequestRevision && (
                            <button onClick={() => setShowRevisionModal(true)} className="form-button secondary">
                                Yêu cầu chỉnh sửa
                            </button>
                        )}
                    </div>
                </div>

                <h3 style={{ marginTop: '30px' }}>Các File Của Đơn Hàng</h3>
                <div className="dashboard-features">
                    {files.length > 0 ? (
                        <ul>
                            {files.map(file => (
                                <li key={file.id}>
                                    <button
                                        type="button"
                                        onClick={() => fileApi.downloadFile(file.id, file.file_name).catch(error => toast.error(error.message || 'Không thể tải file.'))}
                                        className="file-download-link"
                                    >
                                        {file.file_name}
                                    </button>
                                    ({file.file_type}) - Tải lên lúc: {new Date(file.created_at).toLocaleString()}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>Chưa có file nào được nộp cho đơn hàng này.</p>
                    )}
                </div>

                {canShowFeedbackForm && (
                    <FeedbackForm orderId={order.id} onFeedbackSubmitted={fetchData} />
                )}
            </div>

            {showPaymentModal && (
                <PaymentConfirmModal
                    order={order}
                    onConfirm={handlePayment}
                    onCancel={() => setShowPaymentModal(false)}
                    loading={paymentLoading}
                />
            )}

            {showRevisionModal && (
                <RevisionRequestModal
                    order={order}
                    onClose={() => setShowRevisionModal(false)}
                    onSubmit={handleRequestRevision}
                    loading={revisionLoading}
                />
            )}
        </>
    );
};

export default OrderDetailsPage;
