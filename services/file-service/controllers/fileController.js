const express = require('express');

const { asyncHandler } = require('../shared/middleware/errorHandler');
const { handleSingleFileUpload } = require('../config/uploadConfig');
const { authMiddleware } = require('../middleware/authMiddleware');
const { createFileService } = require('../services/fileService');

const createFileController = ({ pool, logger }) => {
    const router = express.Router();
    const fileService = createFileService({ pool, logger });

    router.post(
        '/upload',
        authMiddleware,
        handleSingleFileUpload('file'),
        asyncHandler(async (req, res) => {
            const result = await fileService.uploadFile({
                user: req.user,
                token: req.token,
                body: req.body,
                uploadedFile: req.file
            });

            res.success({ statusCode: 201, message: result.message, data: { id: result.id } });
        })
    );

    router.get(
        '/files/order/:orderId',
        authMiddleware,
        asyncHandler(async (req, res) => {
            const files = await fileService.getFilesByOrder({
                user: req.user,
                token: req.token,
                orderId: req.params.orderId
            });

            res.success({ message: 'Files loaded successfully.', data: files });
        })
    );

    router.get(
        '/files/download/:fileId',
        authMiddleware,
        asyncHandler(async (req, res, next) => {
            const downloadInfo = await fileService.getDownloadInfo({
                user: req.user,
                token: req.token,
                fileId: req.params.fileId
            });

            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadInfo.fileName)}`);
            res.sendFile(downloadInfo.absolutePath, (err) => {
                if (err) next(err);
            });
        })
    );

    return router;
};

module.exports = { createFileController };
