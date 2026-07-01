const express = require("express");
const request = require("supertest");

const {
    registerValidation,
    loginValidation
} = require("../../../shared/middleware/validation");

const app = express();

app.use(express.json());

app.post(
    "/register",
    registerValidation,
    (req, res) => {
        res.status(200).json({
            success: true
        });
    }
);

app.post(
    "/login",
    loginValidation,
    (req, res) => {
        res.status(200).json({
            success: true
        });
    }
);

test("TC01 - Register hợp lệ", async () => {

    const res = await request(app)
        .post("/register")
        .send({
            name: "Gia Bao",
            email: "gia@test.com",
            password: "123456"
        });

    expect(res.statusCode).toBe(200);

});

test("TC02 - Thiếu tên", async () => {

    const res = await request(app)
        .post("/register")
        .send({
            email: "gia@test.com",
            password: "123456"
        });

    expect(res.statusCode).toBe(400);

});

test("TC03 - Name quá ngắn", async () => {

    const res = await request(app)
        .post("/register")
        .send({
            name: "A",
            email: "gia@test.com",
            password: "123456"
        });

    expect(res.statusCode).toBe(400);

});

test("TC04 - Email sai định dạng", async () => {

    const res = await request(app)
        .post("/register")
        .send({
            name: "Gia Bao",
            email: "abc",
            password: "123456"
        });

    expect(res.statusCode).toBe(400);

});

test("TC05 - Password rỗng", async () => {

    const res = await request(app)
        .post("/register")
        .send({
            name: "Gia Bao",
            email: "gia@test.com",
            password: ""
        });

    expect(res.statusCode).toBe(400);

});

test("TC06 - Password dưới 6 ký tự", async () => {

    const res = await request(app)
        .post("/register")
        .send({
            name: "Gia Bao",
            email: "gia@test.com",
            password: "12345"
        });

    expect(res.statusCode).toBe(400);

});

test("TC07 - Login hợp lệ", async () => {

    const res = await request(app)
        .post("/login")
        .send({
            email: "gia@test.com",
            password: "123456"
        });

    expect(res.statusCode).toBe(200);

});


test("TC08 - Email rỗng", async () => {

    const res = await request(app)
        .post("/login")
        .send({
            email: "",
            password: "123456"
        });

    expect(res.statusCode).toBe(400);

});

test("TC09 - Password rỗng", async () => {

    const res = await request(app)
        .post("/login")
        .send({
            email: "gia@test.com",
            password: ""
        });

    expect(res.statusCode).toBe(400);

});

