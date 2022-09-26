import * as functions from "firebase-functions";
import { AuthData } from "firebase-functions/lib/common/providers/tasks";

const validateUserAuth = (context: AuthData | undefined) => {
  if (!context) {
    functions.logger.error("unauthenticated user getUserInfos", context);
    throw new functions.https.HttpsError("unauthenticated", "");
  }
  return context;
};
export { validateUserAuth };
