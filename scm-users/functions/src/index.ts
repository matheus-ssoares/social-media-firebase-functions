import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as validaton from "@stone-ton/validaton";
import { z } from "zod";

admin.initializeApp();

export const create = functions.https.onCall(async (data) => {
  functions.logger.info("User create request", data?.email);
  const createUserSchema = z.object({
    email: z.string().email(),
    name: z.string().superRefine((val, ctx) => {
      const validationResult = validaton.validateName(val);

      if (validationResult) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: String(validationResult),
        });
        return;
      }
    }),
    password: z.string().min(6),
  });
  const validationResult = createUserSchema.safeParse(data);

  if (!validationResult.success) {
    functions.logger.error(
      "User create request validation failed",
      validationResult.error
    );
    throw new functions.https.HttpsError(
      "invalid-argument",
      "",
      validationResult.error
    );
  }
  const userData = validationResult.data;

  const firestore = admin.firestore(functions.config().firebase);

  try {
    const createdUser = await firestore
      .collection(process.env.USERS_TABLE!)
      .add(userData);
    const firebaseToken = await admin.auth().createCustomToken(createdUser.id);

    functions.logger.info("create user successfully", createdUser.id);

    return {
      id: createdUser.id,
      token: firebaseToken,
    };
  } catch (error) {
    functions.logger.error("create user error", error);
    throw new functions.https.HttpsError("internal", "");
  }
});

export const authenticate = functions.https.onCall(async (data) => {
  const authenticateSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
  });
  functions.logger.info("User login request", data?.email);
  const validationResult = authenticateSchema.safeParse(data);

  functions.logger.info("validation result", validationResult);
  if (!validationResult.success) {
    functions.logger.error(
      "User login request validation failed",
      validationResult.error
    );
    throw new functions.https.HttpsError(
      "invalid-argument",
      "",
      validationResult.error
    );
  }

  const { email, password } = validationResult.data;

  const firestore = admin.firestore();

  const usersRef = firestore.collection(process.env.USERS_TABLE!);

  const queryResult = await usersRef.where("email", "==", email).get();

  if (queryResult.empty) {
    functions.logger.error("User login not found", {
      queryResult,
    });

    throw new functions.https.HttpsError("not-found", "");
  }

  let userData: admin.firestore.DocumentData | undefined;
  queryResult.forEach((user) => {
    userData = user;
  });
  functions.logger.info("get user query success", userData?.data());

  if (userData?.data()?.password !== password)
    throw new functions.https.HttpsError(
      "permission-denied",
      "Email or password is invalid"
    );

  const firebaseToken = await admin.auth().createCustomToken(userData.id);
  functions.logger.info("User login request validation success", {
    id: userData.id,
    email: userData.email,
  });

  return {
    token: firebaseToken,
  };
});

export const getMe = functions.https.onCall(async (data, context) => {
  const auth = context.auth;

  if (!auth) {
    functions.logger.error("unauthenticated user getMe", context);
    throw new functions.https.HttpsError("unauthenticated", "");
  }

  const firestore = admin.firestore();

  const usersRef = firestore.collection(process.env.USERS_TABLE!);

  const userDoc = await usersRef.doc(auth.uid).get();

  if (!userDoc.data()) {
    functions.logger.error("user not found", auth.uid);
    throw new functions.https.HttpsError("not-found", "");
  }
  return userDoc.data();
});
