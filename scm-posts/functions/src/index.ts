import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  createCommentSchema,
  createPostSchema,
  getAllPostCommentSchema,
  getAllPostsSchema,
  getUserNotifySchema,
  likePostSchema,
} from "./validations";
import { validateUserAuth } from "./helpers";
import { Comments, UserNotification } from "./interfaces";

admin.initializeApp();

const firestore = admin.firestore();

export const createPost = functions.https.onCall(async (data, context) => {
  functions.logger.info("User create request", data?.email);
  const auth = validateUserAuth(context.auth);

  const validationResult = createPostSchema.safeParse(data);

  if (!validationResult.success) {
    functions.logger.error(
      "createPost request validation failed",
      validationResult.error
    );
    throw new functions.https.HttpsError(
      "invalid-argument",
      "",
      validationResult.error
    );
  }

  try {
    const userRef = firestore
      .collection(process.env.USERS_TABLE!)
      .doc(auth.uid);

    const createdPost = await firestore
      .collection(process.env.POSTS_TABLE!)
      .add({
        ...validationResult.data,
        likes: [],
        comments: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        userRef,
      });

    const postData = (await createdPost.get()).data();

    functions.logger.info("create post successfully", postData);
    const userData = (await userRef.get()).data();

    return {
      id: createdPost.id,
      ...postData,
      loaded: true,
      user: {
        id: userRef.id,
        ...userData,
      },
    };
  } catch (error) {
    functions.logger.info("failed create post");

    throw new functions.https.HttpsError("internal", "");
  }
});

export const getAllPosts = functions.https.onCall(async (data, context) => {
  functions.logger.info("getAll posts request");

  const validationResult = getAllPostsSchema.safeParse(data);

  if (!validationResult.success) {
    functions.logger.error(
      "getAllPosts request validation failed",
      validationResult.error
    );
    throw new functions.https.HttpsError(
      "invalid-argument",
      "",
      validationResult.error
    );
  }

  try {
    if (validationResult.data?.post_id) {
      functions.logger.info(
        "getAllPosts post id",
        validationResult.data?.post_id
      );
      const post = await firestore
        .collection(process.env.POSTS_TABLE!)
        .doc(validationResult.data.post_id)
        .get();
      functions.logger.info("getAllPosts post object", post);
      const postData = post.data();
      functions.logger.info("getAllPosts post data", post.data());
      const user = await postData?.userRef;

      const getUser = await firestore
        .collection(process.env.USERS_TABLE!)
        .doc(user.id)
        .get();

      const userData = getUser.data();
      const postWithUser = {
        ...postData,
        user: {
          name: userData?.name,
          email: userData?.email,
          image_url: userData?.image_url,
          id: getUser.id,
        },
      };

      return [postWithUser];
    }
    const allPosts = await firestore
      .collection(process.env.POSTS_TABLE!)
      .orderBy("createdAt", "desc")
      .get();
    functions.logger.info("get posts successfully");
    const posts = allPosts.docs;
    const postsWithUser: {
      id: string;
      description: string;
      image_url: string;
      image_preview: string;
      user?: {
        id: string;
        name: string;
        image_url: string;
        email: string;
      };
    }[] = [];

    for (const post of posts) {
      const postData = post.data();

      const user = await postData.userRef.get();

      functions.logger.info("user found(user)", postData.userRef?.id);

      postsWithUser.push({
        id: post.id,
        ...postData,
        user: {
          name: user.data()?.name,
          email: user.data()?.email,
          image_url: user.data()?.image_url,
          id: postData.userRef?.id,
        },
      } as {
        id: string;
        description: string;
        image_url: string;
        image_preview: string;
        user?: {
          id: string;
          name: string;
          image_url: string;
          email: string;
        };
      });
    }
    functions.logger.info("get all posts sucessfully", postsWithUser);
    return postsWithUser;
  } catch (error) {
    functions.logger.error("failed on getAll posts", error);

    throw new functions.https.HttpsError("internal", "", error);
  }
});

export const likePost = functions.https.onCall(async (data, context) => {
  functions.logger.info("likePost request", context);

  const auth = validateUserAuth(context.auth);

  const likePostSchema = z.object({
    post_id: z.string(),
  });

  const validationResult = likePostSchema.safeParse(data);

  if (!validationResult.success) {
    functions.logger.error(
      "like post request validation failed",
      validationResult.error
    );
    throw new functions.https.HttpsError(
      "invalid-argument",
      "",
      validationResult.error
    );
  }
  try {
    const postRef = firestore
      .collection(process.env.POSTS_TABLE!)
      .doc(validationResult.data.post_id);

    const userLike = await firestore
      .collection(process.env.USERS_TABLE!)
      .doc(auth.uid)
      .get();

    const postsData = (await postRef.get()).data();

    if (postsData?.likes.find((like: string) => like === auth.uid)) {
      return {
        code: 200,
        message: "like already exists",
      };
    }
    await postRef.update({
      likes: admin.firestore.FieldValue.arrayUnion(auth.uid),
    });
    await firestore.collection(process.env.USER_NOTIFICATIONS_TABLE!).add({
      title: `${userLike?.data()?.name} like your post!`,
      body: "Check it out!",
      action: "SignedIn.Posts.PostScreen",
      deepLink: `socialmedia://socialmedia/SignedIn.Posts.PostsScreen/${validationResult.data.post_id}`,
      userRefs: admin.firestore.FieldValue.arrayUnion(auth.uid),
    });

    const token = userLike?.data()?.token;

    functions.logger.info("sending notifications", token);
    await admin.messaging().sendMulticast({
      tokens: [token],
      notification: {
        title: `${userLike?.data()?.name} like your post!`,
        body: "Check it out!",
      },
      data: {
        action: "SignedIn.Posts.PostScreen",
        deepLink: `socialmedia://socialmedia/SignedIn.Posts.PostsScreen/${validationResult.data.post_id}`,
      },
    });
    return {
      statusCode: 204,
    };
  } catch (error) {
    functions.logger.error("like post request error", error);
    throw new functions.https.HttpsError("internal", "");
  }
});

export const removePostLike = functions.https.onCall(async (data, context) => {
  functions.logger.info("removePostLike request", context);

  const auth = validateUserAuth(context.auth);

  const validationResult = likePostSchema.safeParse(data);

  if (!validationResult.success) {
    functions.logger.error(
      "removePostLike request validation failed",
      validationResult.error
    );
    throw new functions.https.HttpsError(
      "invalid-argument",
      "",
      validationResult.error
    );
  }
  try {
    const postRef = firestore
      .collection(process.env.POSTS_TABLE!)
      .doc(validationResult.data.post_id);

    await postRef.update({
      likes: admin.firestore.FieldValue.arrayRemove(auth.uid),
    });
    functions.logger.info("like removed", validationResult.data.post_id);

    return {
      statusCode: 200,
    };
  } catch (error) {
    functions.logger.error("removePostLike request error", error);
    throw new functions.https.HttpsError("internal", "");
  }
});

export const createPostComment = functions.https.onCall(
  async (data, context) => {
    functions.logger.info("createPostComment request", context);

    const auth = validateUserAuth(context.auth);

    const validationResult = createCommentSchema.safeParse(data);

    if (!validationResult.success) {
      functions.logger.error(
        "createPostComment request validation failed",
        validationResult.error
      );
      throw new functions.https.HttpsError(
        "invalid-argument",
        "",
        validationResult.error
      );
    }
    try {
      const { post_id, content } = validationResult.data;
      const userRef = firestore
        .collection(process.env.USERS_TABLE!)
        .doc(auth.uid);

      const postRef = firestore
        .collection(process.env.POSTS_TABLE!)
        .doc(post_id);

      const postCommentsRef = firestore.collection(
        process.env.POST_COMMENTS_TABLE!
      );

      const postQuery = await postCommentsRef
        .where("post_id", "==", post_id)
        .get();

      let postUserComment:
        | admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>
        | undefined;

      postQuery.forEach((doc) => {
        postUserComment = doc;
      });

      if (!postUserComment) {
        const commentId = uuidv4();
        await postCommentsRef.add({
          postRef: postRef,
          comments: admin.firestore.FieldValue.arrayUnion({
            id: commentId,
            content,
            userRef,
          }),
        });
        functions.logger.info(
          "createPostComment created",
          validationResult.data,
          userRef
        );

        return {
          id: commentId,
        };
      }
      const commentId = uuidv4();
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
    } catch (error) {
      functions.logger.error("createPostComment request error", error);
      throw new functions.https.HttpsError("internal", "");
    }
  }
);

export const getAllPostComment = functions.https.onCall(
  async (data, context) => {
    functions.logger.info("getAllPostComment request", context);

    validateUserAuth(context.auth);

    const validationResult = getAllPostCommentSchema.safeParse(data);

    if (!validationResult.success) {
      functions.logger.error(
        "getAllPostComment request validation failed",
        validationResult.error
      );
      throw new functions.https.HttpsError(
        "invalid-argument",
        "",
        validationResult.error
      );
    }

    try {
      const getPostRef = firestore
        .collection(process.env.POSTS_TABLE!)
        .doc(validationResult.data.post_id);

      const getPostCommentsRef = await firestore
        .collection(process.env.POST_COMMENTS_TABLE!)
        .where("postRef", "==", getPostRef)
        .get();

      if (getPostCommentsRef.empty) {
        functions.logger.debug(
          "not found post",
          getPostRef,
          validationResult.data.post_id
        );
        throw new functions.https.HttpsError("not-found", "");
      }
      functions.logger.debug("found post", getPostCommentsRef.docs);
      const comments = getPostCommentsRef.docs;

      const commentsWithUser: Comments[] = [];

      for (const commentDoc of comments) {
        const commentData = commentDoc.data();

        for (const comment of commentData.comments) {
          const user = await comment.userRef.get();
          commentsWithUser.push({
            id: commentDoc.id,
            ...comment,
            user: {
              id: user.id,
              name: user.data()?.name,
            },
          } as Comments);
        }
      }

      return commentsWithUser;
    } catch (error) {
      functions.logger.error("failed on getAll posts comments", error);

      throw new functions.https.HttpsError("internal", "", error);
    }
  }
);

export const onCreatePost = functions.firestore
  .document("posts/{userRef}")
  .onCreate(async (snap, context) => {
    try {
      functions.logger.info("A new post was created", snap.data().userRef);

      const getUserPost = firestore
        .collection(process.env.USERS_TABLE!)
        .doc(snap.data().userRef.id)
        .get();

      if (!(await getUserPost).exists)
        throw new functions.https.HttpsError(
          "internal",
          "user does not exists",
          getUserPost
        );

      const userData = (await getUserPost).data();

      const getPostNotificationsRef = await firestore
        .collection(process.env.POST_NOTIFICATIONS_TABLE!)
        .where("userRef", "==", snap.data().userRef)
        .get();

      let postInfos:
        | admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>
        | undefined;

      getPostNotificationsRef.docs.forEach((doc) => {
        postInfos = doc;
      });
      functions.logger.info("post infos", postInfos?.data());
      const postId = snap.id;

      if (postInfos) {
        const userIds = postInfos.data().userRefs;
        functions.logger.info("users ids", userIds);

        await firestore.collection(process.env.USER_NOTIFICATIONS_TABLE!).add({
          title: `There's a new post from ${userData?.name}`,
          body: "Check it out!",
          action: "SignedIn.Posts.PostScreen",
          deepLink: `socialmedia://socialmedia/SignedIn.Posts.PostsScreen/${postId}`,
          userRefs: userIds,
        });
        functions.logger.info(
          "get user post registered notification tokens",
          postInfos.data()
        );

        const tokens = postInfos.data().users;

        functions.logger.info("sending notifications", tokens);
        const result = await admin.messaging().sendMulticast({
          tokens,
          notification: {
            title: `There's a new post from ${userData?.name}`,
            body: "Check it out!",
          },
          data: {
            action: "SignedIn.Posts.PostScreen",
            deepLink: `socialmedia://socialmedia/SignedIn.Posts.PostsScreen/${postId}`,
          },
        });

        functions.logger.info("push notification results", result);
        return;
      }
      functions.logger.info("not found user post notifications");
    } catch (error) {
      functions.logger.error(
        "failed on send push notification for a new post",
        error,
        snap.data()
      );
    }
  });
export const verifyUserNotify = functions.https.onCall(
  async (data, context) => {
    functions.logger.info("verifyUserNotify request", context);

    const auth = validateUserAuth(context.auth);

    const validationResult = getUserNotifySchema.safeParse(data);

    if (!validationResult.success) {
      functions.logger.error(
        "verifyUserNotify request validation failed",
        validationResult.error
      );
      throw new functions.https.HttpsError(
        "invalid-argument",
        "",
        validationResult.error
      );
    }
    const postUserRef = firestore
      .collection(process.env.USERS_TABLE!)
      .doc(validationResult.data.user_id);
    const notificatedUserRef = await firestore
      .collection(process.env.USERS_TABLE!)
      .doc(auth.uid)
      .get();
    const notificatedUserData = notificatedUserRef.data();
    const notificationExists = await firestore
      .collection(process.env.POST_NOTIFICATIONS_TABLE!)
      .where("userRef", "==", postUserRef)
      .where("users", "array-contains", notificatedUserData?.token)
      .get();

    if (notificationExists.empty) {
      functions.logger.info(
        "user is not in list to be notificated",
        validationResult.data.user_id
      );

      return {
        notify: false,
      };
    }
    functions.logger.info(
      "user is in list to be notificated",
      validationResult.data.user_id
    );
    return {
      notify: true,
    };
  }
);

export const createUserPostNotify = functions.https.onCall(
  async (data, context) => {
    functions.logger.info("verifyUserNotify request", context);

    const auth = validateUserAuth(context.auth);

    const validationResult = getUserNotifySchema.safeParse(data);

    if (!validationResult.success) {
      functions.logger.error(
        "verifyUserNotify request validation failed",
        validationResult.error
      );
      throw new functions.https.HttpsError(
        "invalid-argument",
        "",
        validationResult.error
      );
    }
    const postUserRef = firestore
      .collection(process.env.USERS_TABLE!)
      .doc(validationResult.data.user_id);
    const notificatedUserRef = firestore
      .collection(process.env.USERS_TABLE!)
      .doc(auth.uid);

    const notificatedUserData = (await notificatedUserRef.get()).data();

    if (!notificatedUserData?.token) {
      functions.logger.error("user has no device token", notificatedUserData);
      throw new functions.https.HttpsError(
        "not-found",
        "user has no device token"
      );
    }

    const notificationExistsRef = await firestore
      .collection(process.env.POST_NOTIFICATIONS_TABLE!)
      .where("userRef", "==", postUserRef)
      .get();

    if (notificationExistsRef.empty) {
      functions.logger.error(
        "there is not notification",
        notificationExistsRef
      );
      await firestore.collection(process.env.POST_NOTIFICATIONS_TABLE!).add({
        userRef: postUserRef,
        users: admin.firestore.FieldValue.arrayUnion(
          notificatedUserData?.token
        ),
        userRefs: admin.firestore.FieldValue.arrayUnion(auth.uid),
      });
      functions.logger.error(
        "notification created sucessfully",
        notificationExistsRef
      );
      return {
        created: true,
      };
    }
    functions.logger.error("there is a notification", notificationExistsRef);
    let notificationExistsData:
      | admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>
      | undefined;

    notificationExistsRef.docs.forEach((doc) => {
      notificationExistsData = doc;
    });
    await firestore
      .collection(process.env.POST_NOTIFICATIONS_TABLE!)
      .doc(notificationExistsData!.ref!.id)
      .update({
        users: admin.firestore.FieldValue.arrayUnion(notificatedUserData.token),
        userRefs: admin.firestore.FieldValue.arrayUnion(auth.uid),
      });
    functions.logger.error(
      "notification updated sucessfully",
      notificationExistsRef
    );
    return {
      created: true,
    };
  }
);
export const deleteUserNotify = functions.https.onCall(
  async (data, context) => {
    functions.logger.info("deleteUserNotify request", data);

    const auth = validateUserAuth(context.auth);

    const validationResult = getUserNotifySchema.safeParse(data);

    if (!validationResult.success) {
      functions.logger.error(
        "deleteUserNotify request validation failed",
        validationResult.error
      );
      throw new functions.https.HttpsError(
        "invalid-argument",
        "",
        validationResult.error
      );
    }
    const postUserRef = firestore
      .collection(process.env.USERS_TABLE!)
      .doc(validationResult.data.user_id);
    const notificatedUserRef = await firestore
      .collection(process.env.USERS_TABLE!)
      .doc(auth.uid)
      .get();

    const notificationExists = await firestore
      .collection(process.env.POST_NOTIFICATIONS_TABLE!)
      .where("userRef", "==", postUserRef)
      .where("users", "array-contains", notificatedUserRef.data()!.token)
      .get();

    let userNotifications:
      | admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>
      | undefined;

    notificationExists.docs.forEach((doc) => {
      userNotifications = doc;
    });

    if (!notificationExists.empty) {
      await firestore
        .collection(process.env.POST_NOTIFICATIONS_TABLE!)
        .doc(userNotifications?.id!)
        .update({
          users: admin.firestore.FieldValue.arrayRemove(
            notificatedUserRef.data()!.token
          ),
          userRefs: admin.firestore.FieldValue.arrayRemove(auth.uid),
        });
    }
    functions.logger.error("updateUserNotify successfully");
  }
);

export const getUserNotifications = functions.https.onCall(
  async (data, context) => {
    functions.logger.info("verifyUserNotify request", context);

    const auth = validateUserAuth(context.auth);

    const notifications = await firestore
      .collection(process.env.USER_NOTIFICATIONS_TABLE!)
      .where("userRefs", "array-contains", auth.uid)
      .get();

    let notificationsResult: Array<UserNotification> = [];
    notifications.docs.forEach((doc) => {
      notificationsResult.push(doc.data() as UserNotification);
    });

    return notificationsResult;
  }
);
