# MuTraPro API Documentation

Base URL: `http://localhost:3007/api`

Response thanh cong moi nen theo dang:
```json
{ "success": true, "message": "Success", "data": {} }
```

Response loi:
```json
{ "success": false, "message": "Error message", "errors": [] }
```;

## Auth
| Method | Endpoint | Role | Mo ta |
|---|---|---|---|
| POST | `/auth/register` | Public | Dang ky customer |
| POST | `/auth/login` | Public | Dang nhap, tra JWT |
| GET | `/auth/verify` | Authenticated | Kiem tra token |
| PUT | `/auth/users/:id` | Owner | Cap nhat profile |
| PUT | `/auth/users/:id/password` | Owner | Doi mat khau |
| GET | `/auth/admin/users` | Admin | Danh sach user |
| POST | `/auth/admin/users` | Admin | Tao user |
| PUT | `/auth/admin/users/:id` | Admin | Cap nhat user |
| DELETE | `/auth/admin/users/:id` | Admin | Xoa user |

## Orders / Service Requests
| Method | Endpoint | Role | Mo ta |
|---|---|---|---|
| POST | `/orders` | Customer | Tao service request |
| GET | `/orders` | Admin, Coordinator | Xem tat ca request |
| GET | `/orders/customer/:customerId` | Owner, Admin, Coordinator | Xem request cua customer |
| GET | `/orders/:id` | Owner/Staff | Chi tiet request |
| PUT | `/orders/:id/status` | Admin, Coordinator | Cap nhat trang thai |
| POST | `/orders/:id/pay` | Customer owner | Mock payment thanh cong |
| POST | `/orders/:id/feedback` | Customer owner | Gui feedback |
| POST | `/orders/:id/request-revision` | Customer owner | Yeu cau chinh sua |
| GET | `/orders/stats` | Admin, Coordinator | Thong ke don hang |

## Payments
| Method | Endpoint | Role | Mo ta |
|---|---|---|---|
| POST | `/payments` | Customer owner | Tao payment pending cho order completed/fixed |
| GET | `/payments` | Admin, Coordinator | Danh sach payment co pagination/filter |
| GET | `/payments/:id` | Owner, Admin, Coordinator | Chi tiet payment |
| POST | `/payments/:id/mock-success` | Owner, Admin | Gia lap thanh toan thanh cong |
| POST | `/payments/:id/mock-fail` | Owner, Admin | Gia lap thanh toan that bai |

## Tasks
| Method | Endpoint | Role | Mo ta |
|---|---|---|---|
| POST | `/tasks` | Coordinator | Phan cong task |
| PUT | `/tasks/:id/status` | Assigned specialist, Admin, Coordinator | Cap nhat trang thai task |
| GET | `/tasks/specialist/:specialistId` | Owner, Admin, Coordinator | Lay task theo specialist |
| GET | `/tasks/order/:orderId` | Internal | Lay task moi nhat cua order |

## Files
| Method | Endpoint | Role | Mo ta |
|---|---|---|---|
| POST | `/files/upload` | Authenticated by ownership/role | Upload file |
| GET | `/files/files/order/:orderId` | Owner/related staff | Lay metadata file theo order |
| GET | `/files/files/download/:fileId` | Owner/related staff | Download file |

## Studio
| Method | Endpoint | Role | Mo ta |
|---|---|---|---|
| GET | `/studio/studios` | Public | Danh sach phong thu |
| POST | `/studio/bookings` | Artist | Dat lich phong thu |
| GET | `/studio/bookings/all` | Studio Admin | Xem lich dat |
| POST | `/studio/bookings/:id/confirm` | Studio Admin, Admin | Xac nhan booking |
| POST | `/studio/bookings/:id/reject` | Studio Admin, Admin | Tu choi booking |
| POST | `/studio/bookings/:id/cancel` | Owner, Studio Admin, Admin | Huy booking |
| PUT | `/studio/studios/:id/status` | Studio Admin | Cap nhat trang thai phong |

## Notifications
| Method | Endpoint | Role | Mo ta |
|---|---|---|---|
| GET | `/notifications` | Authenticated | Lay notification cua user hien tai |
| PATCH | `/notifications/:id/read` | Owner, Admin | Mark notification as read |
| POST | `/notifications/register-device` | Authenticated | Dang ky device token |
| POST | `/notifications/notify` | Internal | Tao/gui thong bao |

## Reports
| Method | Endpoint | Role | Mo ta |
|---|---|---|---|
| GET | `/analytics/stats` | Admin, Coordinator | Bao cao dashboard neu NiFi/analytics data san sang |
| GET | `/reports/overview` | Admin, Coordinator | Alias RESTful cho bao cao tong quan |
