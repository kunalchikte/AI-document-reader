const bcrypt = require("bcryptjs");
const UserRepository = require("../models/userRepository");
const { genToken } = require("../middleware/auth/auth");

const SALT_ROUNDS = 10;

exports.register = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 400,
                msg: "Email and password are required",
                data: null,
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                status: 400,
                msg: "Password must be at least 6 characters",
                data: null,
            });
        }

        const existing = await UserRepository.findByEmail(email);
        if (existing) {
            return res.status(409).json({
                status: 409,
                msg: "An account with this email already exists",
                data: null,
            });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await UserRepository.create({
            email,
            passwordHash,
            name: name || email.split("@")[0],
        });

        const tokenResult = await genToken({ id: user.id, email: user.email });
        if (!tokenResult.status) {
            return res.status(500).json({
                status: 500,
                msg: "Failed to create session token",
                data: null,
            });
        }

        return res.status(201).json({
            status: 201,
            msg: "Account created successfully",
            data: {
                token: tokenResult.token,
                user,
            },
        });
    } catch (error) {
        console.error("Register error:", error);
        return res.status(500).json({
            status: 500,
            msg: `Registration failed: ${error.message}`,
            data: null,
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 400,
                msg: "Email and password are required",
                data: null,
            });
        }

        const row = await UserRepository.findByEmail(email);
        if (!row) {
            return res.status(401).json({
                status: 401,
                msg: "Invalid email or password",
                data: null,
            });
        }

        const match = await bcrypt.compare(password, row.password_hash);
        if (!match) {
            return res.status(401).json({
                status: 401,
                msg: "Invalid email or password",
                data: null,
            });
        }

        const user = UserRepository.formatUser(row);
        const tokenResult = await genToken({ id: user.id, email: user.email });

        return res.status(200).json({
            status: 200,
            msg: "Logged in successfully",
            data: {
                token: tokenResult.token,
                user,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            status: 500,
            msg: `Login failed: ${error.message}`,
            data: null,
        });
    }
};

exports.me = async (req, res) => {
    try {
        const user = await UserRepository.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                status: 404,
                msg: "User not found",
                data: null,
            });
        }

        return res.status(200).json({
            status: 200,
            msg: "User retrieved",
            data: user,
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            msg: `Failed to load user: ${error.message}`,
            data: null,
        });
    }
};

exports.logout = async (req, res) => {
    return res.status(200).json({
        status: 200,
        msg: "Logged out successfully",
        data: null,
    });
};
