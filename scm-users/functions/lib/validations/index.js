"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.searchUsersSchema = exports.getUserSchema = exports.createUserSchema = void 0;
const zod_1 = require("zod");
const validaton = __importStar(require("@stone-ton/validaton"));
const VALUES = ["Male", "Female"];
const createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    name: zod_1.z.string().superRefine((val, ctx) => {
        const validationResult = validaton.validateName(val);
        if (validationResult) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: String(validationResult),
            });
            return;
        }
    }),
    password: zod_1.z.string().min(6),
});
exports.createUserSchema = createUserSchema;
const updateUserSchema = zod_1.z.object({
    name: zod_1.z.string().superRefine((val, ctx) => {
        const validationResult = validaton.validateName(val !== null && val !== void 0 ? val : "");
        if (validationResult) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: String(validationResult),
            });
            return;
        }
    }),
    zipcode: zod_1.z
        .string()
        .superRefine((val, ctx) => {
        const validationResult = validaton.validateCep(val !== null && val !== void 0 ? val : "");
        if (validationResult) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: String(validationResult),
            });
            return;
        }
    })
        .optional(),
    birthdate: zod_1.z
        .string()
        .superRefine((val, ctx) => {
        const validationResult = validaton.validateCep(val !== null && val !== void 0 ? val : "");
        if (validationResult) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: String(validationResult),
            });
            return;
        }
    })
        .optional(),
    phone: zod_1.z
        .string()
        .superRefine((val, ctx) => {
        const validationResult = validaton.validatePhone(val !== null && val !== void 0 ? val : "");
        if (validationResult) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                message: String(validationResult),
            });
            return;
        }
    })
        .optional(),
    gender: zod_1.z.enum(VALUES).optional(),
    image_url: zod_1.z.string().optional(),
});
exports.updateUserSchema = updateUserSchema;
const getUserSchema = zod_1.z.object({
    user_id: zod_1.z.string(),
});
exports.getUserSchema = getUserSchema;
const searchUsersSchema = zod_1.z.object({
    name: zod_1.z.string(),
});
exports.searchUsersSchema = searchUsersSchema;
//# sourceMappingURL=index.js.map