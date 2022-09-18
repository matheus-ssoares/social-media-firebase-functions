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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.authenticate = exports.create = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const validaton = __importStar(require("@stone-ton/validaton"));
const zod_1 = require("zod");
const social_media_backend_5c5e3_396f342855c1_json_1 = __importDefault(require("../social-media-backend-5c5e3-396f342855c1.json"));
admin.initializeApp({ credential: admin.credential.cert(social_media_backend_5c5e3_396f342855c1_json_1.default) });
exports.create = functions.https.onCall(async (data) => {
    functions.logger.info("User create request", data === null || data === void 0 ? void 0 : data.email);
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
    const validationResult = createUserSchema.safeParse(data);
    if (!validationResult.success) {
        functions.logger.error("User create request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", "", validationResult.error);
    }
    const userData = validationResult.data;
    const firestore = admin.firestore(functions.config().firebase);
    try {
        const createdUser = await firestore
            .collection(process.env.USERS_TABLE)
            .add(userData);
        const firebaseToken = await admin.auth().createCustomToken(createdUser.id);
        functions.logger.info("create user successfully", createdUser.id);
        return {
            id: createdUser.id,
            token: firebaseToken,
        };
    }
    catch (error) {
        functions.logger.error("create user error", error);
        throw new functions.https.HttpsError("internal", "");
    }
});
exports.authenticate = functions.https.onCall(async (data) => {
    var _a;
    const authenticateSchema = zod_1.z.object({
        email: zod_1.z.string().email(),
        password: zod_1.z.string().min(6),
    });
    functions.logger.info("User login request", data === null || data === void 0 ? void 0 : data.email);
    const validationResult = authenticateSchema.safeParse(data);
    functions.logger.info("validation result", validationResult);
    if (!validationResult.success) {
        functions.logger.error("User login request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", "", validationResult.error);
    }
    const { email, password } = validationResult.data;
    const firestore = admin.firestore();
    const usersRef = firestore.collection(process.env.USERS_TABLE);
    const queryResult = await usersRef.where("email", "==", email).get();
    if (queryResult.empty) {
        functions.logger.error("User login not found", {
            queryResult,
        });
        throw new functions.https.HttpsError("not-found", "");
    }
    let userData;
    queryResult.forEach((user) => {
        userData = user;
    });
    functions.logger.info("get user query success", userData === null || userData === void 0 ? void 0 : userData.data());
    if (((_a = userData === null || userData === void 0 ? void 0 : userData.data()) === null || _a === void 0 ? void 0 : _a.password) !== password)
        throw new functions.https.HttpsError("permission-denied", "Email or password is invalid");
    const firebaseToken = await admin.auth().createCustomToken(userData.id);
    functions.logger.info("User login request validation success", {
        id: userData.id,
        email: userData.email,
    });
    return {
        token: firebaseToken,
    };
});
exports.getMe = functions.https.onCall(async (data, context) => {
    const auth = context.auth;
    if (!auth) {
        functions.logger.error("unauthenticated user getMe", context);
        throw new functions.https.HttpsError("unauthenticated", "");
    }
    try {
        const firestore = admin.firestore();
        const usersRef = firestore.collection(process.env.USERS_TABLE);
        const queryResult = await usersRef.where("id", "==", auth.uid).get();
        let userData;
        queryResult.forEach((user) => {
            userData = user;
        });
        if (!userData) {
            functions.logger.error("user not found", auth);
            throw new functions.https.HttpsError("invalid-argument", "");
        }
        return Object.assign({}, userData === null || userData === void 0 ? void 0 : userData.data());
    }
    catch (error) {
        functions.logger.error("error on getme", error);
        throw new functions.https.HttpsError("permission-denied", "");
    }
});
//# sourceMappingURL=index.js.map