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
exports.onUpdateUser = exports.getAllUserPosts = exports.getUserData = exports.getUserInfos = exports.getMe = exports.authenticate = exports.updateUser = exports.create = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const zod_1 = require("zod");
const bcrypt_1 = require("bcrypt");
const validations_1 = require("./validations");
const helpers_1 = require("./helpers");
admin.initializeApp();
const firestore = admin.firestore();
exports.create = functions.https.onCall(async (data) => {
    functions.logger.info("User create request", process.env.PROJECT_ID, process.env.SERVICE_ACCOUNT_ID);
    const validationResult = validations_1.createUserSchema.safeParse(data);
    if (!validationResult.success) {
        functions.logger.error("User create request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", "", validationResult.error);
    }
    const userData = validationResult.data;
    const firestore = admin.firestore(functions.config().firebase);
    try {
        const passwordHash = await (0, bcrypt_1.hash)(userData.password, 12);
        const userRef = firestore.collection(process.env.USERS_TABLE);
        const result = await userRef.where("email", "==", userData.email).get();
        if (!result.empty) {
            functions.logger.error("user already exists", userData.email);
            throw new functions.https.HttpsError("internal", "");
        }
        const createdUser = await userRef.add(Object.assign(Object.assign({}, userData), { password: passwordHash }));
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
exports.updateUser = functions.https.onCall(async (data, context) => {
    const auth = (0, helpers_1.validateUserAuth)(context.auth);
    functions.logger.info("updateUser request", data);
    const validationResult = validations_1.updateUserSchema.safeParse(data);
    if (!validationResult.success) {
        functions.logger.error("User create request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", "", validationResult.error);
    }
    const body = validationResult.data;
    const firestore = admin.firestore(functions.config().firebase);
    try {
        const user = firestore.collection(process.env.USERS_TABLE).doc(auth.uid);
        if (!user) {
            functions.logger.info("user not found(updateUser)", auth.uid);
        }
        await user.update(body);
        functions.logger.info("update user sucessfully(updateUser)", body);
        return (await user.get()).data();
    }
    catch (error) {
        functions.logger.error("update user error", error);
        throw new functions.https.HttpsError("internal", "");
    }
});
exports.authenticate = functions.https.onCall(async (data) => {
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
    const userPassword = userData === null || userData === void 0 ? void 0 : userData.data().password;
    if (await (0, bcrypt_1.compare)(password, userPassword)) {
        const firebaseToken = await admin.auth().createCustomToken(userData === null || userData === void 0 ? void 0 : userData.id);
        functions.logger.info("User login request validation success", {
            id: userData === null || userData === void 0 ? void 0 : userData.id,
            email: userData === null || userData === void 0 ? void 0 : userData.email,
        });
        return {
            token: firebaseToken,
        };
    }
    functions.logger.error("incorrect email or password", validationResult.data.email);
    throw new functions.https.HttpsError("permission-denied", "Email or password is invalid");
});
exports.getMe = functions.https.onCall(async (data, context) => {
    const auth = context.auth;
    if (!auth) {
        functions.logger.error("unauthenticated user getMe", context);
        throw new functions.https.HttpsError("unauthenticated", "");
    }
    const usersRef = firestore.collection(process.env.USERS_TABLE);
    const userDoc = await usersRef.doc(auth.uid).get();
    if (!userDoc.data()) {
        functions.logger.error("user not found", auth.uid);
        throw new functions.https.HttpsError("not-found", "");
    }
    return userDoc.data();
});
exports.getUserInfos = functions.https.onCall(async (data, context) => {
    const auth = context.auth;
    if (!auth) {
        functions.logger.error("unauthenticated user getUserInfos", context);
        throw new functions.https.HttpsError("unauthenticated", "");
    }
    const getUserInfosSchema = zod_1.z.object({
        os_type: zod_1.z.string(),
        os_version: zod_1.z.string(),
        token: zod_1.z.string().optional(),
    });
    functions.logger.info("get user infos request", data);
    const validationResult = getUserInfosSchema.safeParse(data);
    functions.logger.info("validation result get user infos", validationResult);
    if (!validationResult.success) {
        functions.logger.error("get user infos request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", "", validationResult.error);
    }
    const usersRef = firestore.collection(process.env.USERS_TABLE);
    const userDoc = usersRef.doc(auth.uid);
    const userData = (await userDoc.get()).data();
    try {
        await userDoc.update(Object.assign(Object.assign({}, userData), validationResult.data));
    }
    catch (error) {
        functions.logger.error("get user infos request internal error", error);
        throw new functions.https.HttpsError("internal", "");
    }
});
exports.getUserData = functions.https.onCall(async (data, context) => {
    (0, helpers_1.validateUserAuth)(context.auth);
    functions.logger.info("get user data request", data);
    const validationResult = validations_1.getUserSchema.safeParse(data);
    functions.logger.info("validation result get user data", validationResult);
    if (!validationResult.success) {
        functions.logger.error("get user data request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", "", validationResult.error);
    }
    const user = await firestore
        .collection(process.env.USERS_TABLE)
        .doc(validationResult.data.user_id)
        .get();
    if (user.exists) {
        functions.logger.debug("get user success", user);
        return Object.assign({ id: user.id }, user.data());
    }
    functions.logger.debug("user not found", validationResult);
    throw new functions.https.HttpsError("not-found", "");
});
exports.getAllUserPosts = functions.https.onCall(async (data, context) => {
    (0, helpers_1.validateUserAuth)(context.auth);
    functions.logger.info("getAllUserPosts request", data);
    const validationResult = validations_1.getUserSchema.safeParse(data);
    functions.logger.info("validation result getAllUserPosts", validationResult);
    if (!validationResult.success) {
        functions.logger.error("getAllUserPosts request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", validationResult.error.message);
    }
    const userRef = firestore
        .collection(process.env.USERS_TABLE)
        .doc(validationResult.data.user_id);
    const userData = (await userRef.get()).data();
    if (!userData) {
        functions.logger.debug("user not found", validationResult);
        throw new functions.https.HttpsError("not-found", "");
    }
    functions.logger.debug("user found", userData);
    const posts = await firestore
        .collection(process.env.POSTS_TABLE)
        .where("userRef", "==", userRef)
        // .orderBy("createdAt")
        .get();
    if (!posts.empty) {
        const postsWithUser = posts.docs.map((post) => {
            const postData = post.data();
            return Object.assign(Object.assign({ id: post.id }, postData), { user: Object.assign({ id: userData === null || userData === void 0 ? void 0 : userData.id }, userData) });
        });
        functions.logger.debug("get user success", postsWithUser);
        return postsWithUser;
    }
    return [];
});
exports.onUpdateUser = functions.firestore
    .document("posts/{token}")
    .onUpdate(async (change, context) => {
    try {
        const oldData = change.before.data();
        const newValue = change.after.data();
        if (!newValue.token) {
            return;
        }
        functions.logger.info("A user was updated", newValue.email);
        const getUserNotifications = await firestore
            .collection(process.env.POST_NOTIFICATIONS_TABLE)
            .where("users", "array-contains", oldData.token)
            .get();
        if (!getUserNotifications.empty) {
            functions.logger.info("found a user token");
            for (const doc of getUserNotifications.docs) {
                await firestore
                    .collection(process.env.POST_NOTIFICATIONS_TABLE)
                    .doc(doc.id)
                    .update({
                    users: admin.firestore.FieldValue.arrayUnion(newValue.token),
                });
                await firestore
                    .collection(process.env.POST_NOTIFICATIONS_TABLE)
                    .doc(doc.id)
                    .update({
                    users: admin.firestore.FieldValue.arrayRemove(oldData.token),
                });
            }
            functions.logger.info("removed old token and added new token sucessfully");
        }
    }
    catch (error) {
        functions.logger.error("failed on user update trigger", error);
    }
});
//# sourceMappingURL=index.js.map