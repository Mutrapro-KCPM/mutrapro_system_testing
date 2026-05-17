// File: web-app/src/pages/TranscriberWorkspacePage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import taskApi from '../api/taskApi';
import fileApi from '../api/fileApi';
import orderApi from '../api/orderApi';
import './Workspace.css';

const DownloadFileButton = ({ orderId }) => {
    const [fileInfo, setFileInfo] = useState(null);
    const [downloading, setDownloading] = useState(false);
    
    useEffect(() => {
        const fetchFile = async () => {
            try {
                const files = await fileApi.getFilesByOrder(orderId);
                const audioFile = files.find(f => f.file_type === 'audio');
                if (audioFile) setFileInfo(audioFile);
            } catch (error) {
                console.error("Lỗi tải file info", error);
            }
        };
        fetchFile();
    }, [orderId]);

    return fileInfo ? (
        <button 
            onClick={async () => {
                setDownloading(true);
                try {
                    await fileApi.downloadFile(fileInfo.id, fileInfo.file_name);
                } catch (error) {
                    toast.error(error.message || 'Không thể tải file.');
                } finally {
                    setDownloading(false);
                }
            }} 
            className="form-button secondary" 
            disabled={downloading}
            style={{ textDecoration: 'none', display: 'inline-block', color: 'white', marginTop: '1rem' }}
        >
            Tải file âm thanh (MP3)
        </button>
    ) : <p>Không tìm thấy file âm thanh gốc.</p>;
};

const TranscriberWorkspacePage = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [loading, setLoading] = useState(true);

    const [notes, setNotes] = useState('');
    const [uploadFile, setUploadFile] = useState(null);

    const fetchTasks = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await taskApi.getTasksBySpecialist(user.id);
            setTasks(data);
            
            if (selectedTask) {
                const updatedSelectedTask = data.find(t => t.id === selectedTask.id);
                setSelectedTask(updatedSelectedTask || (data.length > 0 ? data[0] : null));
            } else if (data.length > 0) {
                setSelectedTask(data[0]);
            } else {
                setSelectedTask(null);
            }
        } catch (error) {
            toast.error("Không thể tải danh sách công việc.");
        } finally {
            setLoading(false);
        }
    }, [user, selectedTask?.id]);

    useEffect(() => {
        if (user) {
            fetchTasks();
        }
    }, [user, fetchTasks]);

    const handleSelectTask = (task) => {
        setSelectedTask(task);
        setNotes('');
        setUploadFile(null);
    };

    const handleStartTask = async () => {
        if (!selectedTask) return;
        try {
            await taskApi.updateTaskStatus(selectedTask.id, 'in_progress');
            toast.success('Đã bắt đầu công việc!');
            
            const updatedTasks = await taskApi.getTasksBySpecialist(user.id);
            setTasks(updatedTasks);

            const newlyUpdatedTask = updatedTasks.find(t => t.id === selectedTask.id);
            if (newlyUpdatedTask) {
                setSelectedTask(newlyUpdatedTask);
            }
        } catch (error) {
            toast.error('Có lỗi xảy ra!');
        }
    };

    // === START: SỬA LỖI LOGIC UPLOAD VÀ UPDATE STATUS ===
    const ALLOWED_NOTATION_EXTS = ['.pdf', '.xml', '.mxl', '.musicxml'];

    const handleCompleteTask = async () => {
        if (!uploadFile) {
            toast.warn('Vui lòng chọn file bản ký âm (PDF, XML...) để nộp!');
            return;
        }

        // BƯỚC 1: Validate đuôi file ngay tại frontend
        const fileName = uploadFile.name.toLowerCase();
        const isValidFormat = ALLOWED_NOTATION_EXTS.some(ext => fileName.endsWith(ext));
        
        if (!isValidFormat) {
            toast.error(`Sai định dạng! Chỉ chấp nhận: ${ALLOWED_NOTATION_EXTS.join(', ')}`);
            return; // Dừng lập tức, không gọi API
        }

        setLoading(true);
        try {
            // BƯỚC 2: Upload file (Truyền đúng type 'notation')
            await fileApi.uploadFile(uploadFile, selectedTask.order_id, 'notation');

            // BƯỚC 3: Upload thành công 100% thì mới cập nhật trạng thái Task và Order
            await taskApi.updateTaskStatus(selectedTask.id, 'done');
            
            const newOrderStatus = selectedTask.status === 'revision_requested' ? 'fixed' : 'completed';
            await orderApi.updateOrderStatus(selectedTask.order_id, newOrderStatus);
            
            toast.success('Nộp sản phẩm thành công!');
            
            // Tải lại danh sách và dọn dẹp
            const updatedTasks = await taskApi.getTasksBySpecialist(user.id);
            setTasks(updatedTasks);
            setSelectedTask(updatedTasks.length > 0 ? updatedTasks[0] : null);
            setUploadFile(null); // Reset file input
            setNotes('');
            
        } catch (error) {
            // Nếu upload lỗi, trạng thái vẫn giữ nguyên in_progress, F5 không bị lỗi
            toast.error(error.response?.data?.message || error.message || 'Nộp sản phẩm thất bại!');
            console.error("Lỗi khi nộp task:", error);
        } finally {
            setLoading(false);
        }
    };
    // === END: SỬA LỖI ===

    return (
        <div className="page-container workspace-layout">
            <aside className="task-sidebar">
                <h2>Việc Ký Âm Của Bạn</h2>
                {loading && <p>Đang tải...</p>}
                <div className="task-list">
                    {tasks.length === 0 && !loading && <p>Bạn không có công việc nào.</p>}
                    {tasks.map(task => (
                        <div 
                            key={task.id}
                            className={`task-list-item ${selectedTask?.id === task.id ? 'selected' : ''}`}
                            onClick={() => handleSelectTask(task)}
                        >
                            <p>Đơn hàng #{task.order_id}</p>
                            <small>Trạng thái: {task.status}</small>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="workspace-main">
                {!selectedTask ? (
                    <div className="dashboard-features"><h3>Vui lòng chọn một công việc từ danh sách bên trái.</h3></div>
                ) : (
                    <div className="dashboard-features">
                        <h3>Chi tiết công việc (Đơn hàng #{selectedTask.order_id})</h3>
                        <p><strong>Yêu cầu từ khách:</strong> {selectedTask.description}</p>
                        <p><strong>Trạng thái:</strong> {selectedTask.status}</p>
                        {selectedTask.status === 'revision_requested' && (
                            <p style={{color: '#dc3545', fontWeight: 'bold'}}>
                                <strong>Lý do sửa:</strong> {selectedTask.revision_comment}
                            </p>
                        )}
                        <DownloadFileButton orderId={selectedTask.order_id} />

                        {selectedTask.status === 'assigned' && (
                            <button onClick={handleStartTask} className="form-button" style={{ marginTop: '20px' }}>Bắt đầu ký âm</button>
                        )}

                        {(selectedTask.status === 'in_progress' || selectedTask.status === 'revision_requested') && (
                            <div className="cooking-area">
                                <h3>Không gian làm việc</h3>
                                <div className="form-group">
                                    <label>Ghi chú ký âm (Nháp)</label>
                                    <textarea
                                        className="transcriber-notes"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Ghi chú lại các hợp âm, tiết tấu..."
                                    />
                                </div>
                                <div className="upload-section">
                                    <label>Nộp file bản ký âm (PDF, MusicXML...)</label>
                                    <input 
                                        type="file" 
                                        onChange={(e) => setUploadFile(e.target.files[0])}
                                        accept=".pdf,.xml,.mxl,.musicxml" 
                                    />
                                    <button 
                                        onClick={handleCompleteTask} 
                                        className="form-button" 
                                        disabled={!uploadFile || loading}
                                    >
                                        {loading ? 'Đang nộp...' : 'Hoàn thành & Nộp'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default TranscriberWorkspacePage;