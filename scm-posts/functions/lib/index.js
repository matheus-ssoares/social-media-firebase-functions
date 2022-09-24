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
exports.createUserPostNotfy = exports.verifyUserNotify = exports.onCreatePost = exports.getAllPostComment = exports.createPostComment = exports.removePostLike = exports.likePost = exports.getAllPosts = exports.createPost = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const uuid_1 = require("uuid");
const zod_1 = require("zod");
const validations_1 = require("./validations");
admin.initializeApp();
const firestore = admin.firestore(functions.config().firebase);
exports.createPost = functions.https.onCall(async (data, context) => {
    functions.logger.info("User create request", data === null || data === void 0 ? void 0 : data.email);
    const auth = context.auth;
    if (!auth) {
        functions.logger.error("unauthenticated user createPost", context);
        throw new functions.https.HttpsError("unauthenticated", "");
    }
    const createPostSchema = zod_1.z.object({
        description: zod_1.z.string().max(240),
        image_url: zod_1.z.string(),
        image_preview: zod_1.z.string(),
    });
    const validationResult = createPostSchema.safeParse(data);
    if (!validationResult.success) {
        functions.logger.error("createPost request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", "", validationResult.error);
    }
    try {
        const userRef = firestore
            .collection(process.env.USERS_TABLE)
            .doc(auth.uid);
        const createdPost = await firestore
            .collection(process.env.POSTS_TABLE)
            .add(Object.assign(Object.assign({}, validationResult.data), { likes: [], comments: [], createdAt: admin.firestore.FieldValue.serverTimestamp(), userRef }));
        const postData = (await createdPost.get()).data();
        functions.logger.info("create post successfully", postData);
        const userData = (await userRef.get()).data();
        return Object.assign(Object.assign({ id: createdPost.id }, postData), { loaded: true, user: userData });
    }
    catch (error) {
        functions.logger.info("failed create post");
        throw new functions.https.HttpsError("internal", "");
    }
});
exports.getAllPosts = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e;
    functions.logger.info("getAll posts request");
    try {
        const createdPost = await firestore
            .collection(process.env.POSTS_TABLE)
            .orderBy("createdAt", "desc")
            .get();
        const posts = createdPost.docs;
        const postsWithUser = [];
        for (const post of posts) {
            const postData = post.data();
            const user = await postData.userRef.get();
            postsWithUser.push(Object.assign(Object.assign({ id: post.id }, postData), { user: {
                    name: (_a = user.data()) === null || _a === void 0 ? void 0 : _a.name,
                    email: (_b = user.data()) === null || _b === void 0 ? void 0 : _b.email,
                    image_url: (_c = user.data()) === null || _c === void 0 ? void 0 : _c.image_url,
                    id: ((_d = user.data()) === null || _d === void 0 ? void 0 : _d.id) || ((_e = user.data()) === null || _e === void 0 ? void 0 : _e.uid),
                } }));
        }
        return postsWithUser;
    }
    catch (error) {
        functions.logger.error("failed on getAll posts", error);
        throw new functions.https.HttpsError("internal", "", error);
    }
});
exports.likePost = functions.https.onCall(async (data, context) => {
    functions.logger.info("likePost request", context);
    const auth = context.auth;
    if (!auth) {
        functions.logger.error("unauthenticated user likePost", context);
        throw new functions.https.HttpsError("unauthenticated", "");
    }
    const likePostSchema = zod_1.z.object({
        post_id: zod_1.z.string(),
    });
    const validationResult = likePostSchema.safeParse(data);
    if (!validationResult.success) {
        functions.logger.error("like post request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", "", validationResult.error);
    }
    try {
        const postRef = firestore
            .collection(process.env.POSTS_TABLE)
            .doc(validationResult.data.post_id);
        const postsData = (await postRef.get()).data();
        if (postsData === null || postsData === void 0 ? void 0 : postsData.likes.find((like) => like === auth.uid)) {
            return {
                code: 200,
                message: "like already exists",
            };
        }
        await postRef.update({
            likes: admin.firestore.FieldValue.arrayUnion(auth.uid),
        });
        return {
            statusCode: 204,
        };
    }
    catch (error) {
        functions.logger.error("like post request error", error);
        throw new functions.https.HttpsError("internal", "");
    }
});
exports.removePostLike = functions.https.onCall(async (data, context) => {
    functions.logger.info("removePostLike request", context);
    const auth = context.auth;
    if (!auth) {
        functions.logger.error("unauthenticated user createPost", context);
        throw new functions.https.HttpsError("unauthenticated", "");
    }
    const likePostSchema = zod_1.z.object({
        post_id: zod_1.z.string(),
    });
    const validationResult = likePostSchema.safeParse(data);
    if (!validationResult.success) {
        functions.logger.error("removePostLike request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", "", validationResult.error);
    }
    try {
        const postRef = firestore
            .collection(process.env.POSTS_TABLE)
            .doc(validationResult.data.post_id);
        await postRef.update({
            likes: admin.firestore.FieldValue.arrayRemove(auth.uid),
        });
        functions.logger.info("like removed", validationResult.data.post_id);
        return {
            statusCode: 200,
        };
    }
    catch (error) {
        functions.logger.error("removePostLike request error", error);
        throw new functions.https.HttpsError("internal", "");
    }
});
exports.createPostComment = functions.https.onCall(async (data, context) => {
    functions.logger.info("createPostComment request", context);
    const auth = context.auth;
    if (!auth) {
        functions.logger.error("unauthenticated user createPostComment", context);
        throw new functions.https.HttpsError("unauthenticated", "");
    }
    const createCommentSchema = zod_1.z.object({
        post_id: zod_1.z.string(),
        content: zod_1.z.string(),
    });
    const validationResult = createCommentSchema.safeParse(data);
    if (!validationResult.success) {
        functions.logger.error("createPostComment request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", "", validationResult.error);
    }
    try {
        const { post_id, content } = validationResult.data;
        const userRef = firestore
            .collection(process.env.USERS_TABLE)
            .doc(auth.uid);
        const postRef = firestore
            .collection(process.env.POSTS_TABLE)
            .doc(post_id);
        const postCommentsRef = firestore.collection(process.env.POST_COMMENTS_TABLE);
        const postQuery = await postCommentsRef
            .where("post_id", "==", post_id)
            .get();
        let postUserComment;
        postQuery.forEach((doc) => {
            postUserComment = doc;
        });
        if (!postUserComment) {
            const commentId = (0, uuid_1.v4)();
            await postCommentsRef.add({
                postRef: postRef,
                comments: admin.firestore.FieldValue.arrayUnion({
                    id: commentId,
                    content,
                    userRef,
                }),
            });
            functions.logger.info("createPostComment created", validationResult.data, userRef);
            return {
                id: commentId,
            };
        }
        const commentId = (0, uuid_1.v4)();
        await postCommentsRef.doc(postUserComment.id).update({
            comments: admin.firestore.FieldValue.arrayUnion({
                id: commentId,
                userRef,
                content,
            }),
        });
        functions.logger.info("createPostComment updated", validationResult.data);
        return {
            id: commentId,
        };
    }
    catch (error) {
        functions.logger.error("createPostComment request error", error);
        throw new functions.https.HttpsError("internal", "");
    }
});
exports.getAllPostComment = functions.https.onCall(async (data, context) => {
    var _a;
    functions.logger.info("getAllPostComment request", context);
    const auth = context.auth;
    if (!auth) {
        functions.logger.error("unauthenticated user getAllPostComment", context);
        throw new functions.https.HttpsError("unauthenticated", "");
    }
    const getAllPostCommentSchema = zod_1.z.object({
        post_id: zod_1.z.string(),
    });
    const validationResult = getAllPostCommentSchema.safeParse(data);
    if (!validationResult.success) {
        functions.logger.error("getAllPostComment request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", "", validationResult.error);
    }
    try {
        const getPostRef = firestore
            .collection(process.env.POSTS_TABLE)
            .doc(validationResult.data.post_id);
        const getPostCommentsRef = await firestore
            .collection(process.env.POST_COMMENTS_TABLE)
            .where("postRef", "==", getPostRef)
            .get();
        if (getPostCommentsRef.empty) {
            functions.logger.debug("not found post", getPostRef, validationResult.data.post_id);
            throw new functions.https.HttpsError("not-found", "");
        }
        functions.logger.debug("found post", getPostCommentsRef.docs);
        const comments = getPostCommentsRef.docs;
        const commentsWithUser = [];
        for (const commentDoc of comments) {
            const commentData = commentDoc.data();
            for (const comment of commentData.comments) {
                const user = await comment.userRef.get();
                commentsWithUser.push(Object.assign(Object.assign({ id: commentDoc.id }, comment), { user: {
                        id: user.id,
                        name: (_a = user.data()) === null || _a === void 0 ? void 0 : _a.name,
                    } }));
            }
        }
        return commentsWithUser;
    }
    catch (error) {
        functions.logger.error("failed on getAll posts comments", error);
        throw new functions.https.HttpsError("internal", "", error);
    }
});
exports.onCreatePost = functions.firestore
    .document("posts/{userRef}")
    .onCreate(async (snap, context) => {
    try {
        functions.logger.info("A new post was created", snap.data().userRef);
        const getUserPost = firestore
            .collection(process.env.USERS_TABLE)
            .doc(snap.data().userRef)
            .get();
        if (!(await getUserPost).exists)
            throw new functions.https.HttpsError("internal", "user does not exists", getUserPost);
        const userData = (await getUserPost).data();
        const getPostNotificationsRef = await firestore
            .collection(process.env.POST_NOTIFICATIONS_TABLE)
            .where("userRef", "==", snap.data().userRef)
            .get();
        let postInfos;
        getPostNotificationsRef.docs.forEach((doc) => {
            postInfos = doc;
        });
        functions.logger.info("post infos", postInfos === null || postInfos === void 0 ? void 0 : postInfos.data());
        if (postInfos) {
            functions.logger.info("get user post registered notification tokens", postInfos.data());
            const tokens = postInfos
                .data()
                .users.map((item) => item.token);
            functions.logger.info("sending notifications", tokens);
            const result = await admin.messaging().sendMulticast({
                tokens,
                notification: {
                    title: `There's a new post from ${userData === null || userData === void 0 ? void 0 : userData.name}`,
                    body: "Check it out!",
                },
                data: { hello: "world!", type: "SignedIn.Posts.PostScreen" },
            });
            functions.logger.info("push notification results", result);
            return;
        }
        functions.logger.info("not found user post notifications");
    }
    catch (error) {
        functions.logger.error("failed on send push notification for a new post", error, snap.data());
    }
});
exports.verifyUserNotify = functions.https.onCall(async (data, context) => {
    functions.logger.info("verifyUserNotify request", context);
    const auth = context.auth;
    if (!auth) {
        functions.logger.error("unauthenticated user verifyUserNotify", context);
        throw new functions.https.HttpsError("unauthenticated", "");
    }
    const validationResult = validations_1.getUserNotifySchema.safeParse(data);
    if (!validationResult.success) {
        functions.logger.error("verifyUserNotify request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", "", validationResult.error);
    }
    const postUserRef = firestore
        .collection(process.env.USERS_TABLE)
        .doc(auth.uid);
    const notificatedUserRef = await firestore
        .collection(process.env.USERS_TABLE)
        .doc(validationResult.data.user_id)
        .get();
    const notificatedUserData = notificatedUserRef.data();
    const notificationExists = await firestore
        .collection(process.env.POST_NOTIFICATIONS_TABLE)
        .where("userRef", "==", postUserRef)
        .where("users", "array-contains", [
        { token: notificatedUserData === null || notificatedUserData === void 0 ? void 0 : notificatedUserData.token, userRef: notificatedUserRef },
    ])
        .get();
    if (notificationExists.empty) {
        return {
            notify: false,
        };
    }
    return {
        notify: true,
    };
});
exports.createUserPostNotfy = functions.https.onCall(async (data, context) => {
    functions.logger.info("verifyUserNotify request", context);
    const auth = context.auth;
    if (!auth) {
        functions.logger.error("unauthenticated user verifyUserNotify", context);
        throw new functions.https.HttpsError("unauthenticated", "");
    }
    const validationResult = validations_1.getUserNotifySchema.safeParse(data);
    if (!validationResult.success) {
        functions.logger.error("verifyUserNotify request validation failed", validationResult.error);
        throw new functions.https.HttpsError("invalid-argument", "", validationResult.error);
    }
    const postUserRef = firestore
        .collection(process.env.USERS_TABLE)
        .doc(auth.uid);
    const notificatedUserRef = await firestore
        .collection(process.env.USERS_TABLE)
        .doc(validationResult.data.user_id)
        .get();
    const notificatedUserData = notificatedUserRef.data();
    if (!(notificatedUserData === null || notificatedUserData === void 0 ? void 0 : notificatedUserData.token)) {
        functions.logger.error("user has no device token", notificatedUserData);
        throw new functions.https.HttpsError("not-found", "user has no device token");
    }
    const notificationExistsRef = await firestore
        .collection(process.env.POST_NOTIFICATIONS_TABLE)
        .where("userRef", "==", postUserRef)
        .get();
    if (notificationExistsRef.empty) {
        functions.logger.error("there is not notification", notificationExistsRef);
        await firestore.collection(process.env.POST_NOTIFICATIONS_TABLE).add({
            userRef: postUserRef,
            users: [
                { token: notificatedUserData === null || notificatedUserData === void 0 ? void 0 : notificatedUserData.token, userRef: notificatedUserRef },
            ],
        });
        functions.logger.error("notification created sucessfully", notificationExistsRef);
        return {
            created: true,
        };
    }
    functions.logger.error("there is a notification", notificationExistsRef);
    let notificationExistsData;
    notificationExistsRef.docs.forEach((doc) => {
        notificationExistsData = doc;
    });
    await firestore
        .collection(process.env.POST_NOTIFICATIONS_TABLE)
        .doc(notificationExistsData.ref.id)
        .update({
        users: admin.firestore.FieldValue.arrayUnion({
            userRef: notificationExistsRef,
            token: notificatedUserData.token,
        }),
    });
    functions.logger.error("notification updated sucessfully", notificationExistsRef);
    return {
        created: true,
    };
});
//# sourceMappingURL=index.js.map