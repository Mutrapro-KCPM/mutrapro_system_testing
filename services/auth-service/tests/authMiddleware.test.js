const jwt = require("jsonwebtoken");

const {
    authMiddleware,
    checkRole
} = require("../middleware/authMiddleware");

const {
    AppError
} = require("../../../shared/middleware/errorHandler");

jest.mock("jsonwebtoken");

const createReq = () => ({
    headers: {},
    user: null
});

const res = {};

let next;

beforeEach(() => {
    next = jest.fn();
});

describe("authMiddleware", () => {

    test("TC01 - Không có Authorization Header", () => {

        const req = createReq();

        authMiddleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);

        const error = next.mock.calls[0][0];

        expect(error).toBeInstanceOf(AppError);

        expect(error.statusCode).toBe(401);

        expect(error.message)
            .toBe("Token không hợp lệ hoặc đã hết hạn");

    });

});

test("TC02 - Authorization không đúng định dạng Bearer", () => {

    const req = createReq();

    req.headers.authorization = "Basic abc123";

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    const error = next.mock.calls[0][0];

    expect(error).toBeInstanceOf(AppError);

    expect(error.statusCode).toBe(401);

});

test("TC03 - JWT không hợp lệ", () => {

    jwt.verify.mockImplementation(() => {
        throw new Error("Expired");
    });

    const req = createReq();

    req.headers.authorization = "Bearer token";

    authMiddleware(req, res, next);

    const error = next.mock.calls[0][0];

    expect(error).toBeInstanceOf(AppError);

    expect(error.statusCode).toBe(401);

});

test("TC04 - JWT hợp lệ", () => {

    jwt.verify.mockReturnValue({
        id: 1,
        role: "admin"
    });

    const req = createReq();

    req.headers.authorization = "Bearer token";

    authMiddleware(req, res, next);

    expect(req.user.id).toBe(1);

    expect(req.user.role).toBe("admin");

    expect(next).toHaveBeenCalled();

});

describe("checkRole", () => {

    test("TC05 - Không có user", () => {

        const middleware = checkRole("admin");

        const req = createReq();

        middleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);

        const error = next.mock.calls[0][0];

        expect(error).toBeInstanceOf(AppError);

        expect(error.statusCode).toBe(403);

        expect(error.message)
            .toBe("Bạn không có quyền truy cập vào tài nguyên này");

    });

});

test("TC06 - User không đúng role", () => {

    const middleware = checkRole("admin");

    const req = createReq();

    req.user = {
        id: 1,
        role: "artist"
    };

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    const error = next.mock.calls[0][0];

    expect(error).toBeInstanceOf(AppError);

    expect(error.statusCode).toBe(403);

});

test("TC07 - User có đúng role", () => {

    const middleware = checkRole("admin");

    const req = createReq();

    req.user = {
        id: 10,
        role: "admin"
    };

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    expect(next).toHaveBeenCalledWith();

});

test("TC08 - User thuộc một trong nhiều role được phép", () => {

    const middleware = checkRole(
        "admin",
        "manager",
        "artist"
    );

    const req = createReq();

    req.user = {
        role: "artist"
    };

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();

});

test("TC09 - Role phân biệt chữ hoa chữ thường", () => {

    const middleware = checkRole("admin");

    const req = createReq();

    req.user = {
        role: "Admin"
    };

    middleware(req, res, next);

    const error = next.mock.calls[0][0];

    expect(error.statusCode).toBe(403);

});