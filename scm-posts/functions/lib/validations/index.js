"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPostsSchema = exports.getUserNotifySchema = void 0;
const zod_1 = require("zod");
const getAllPostsSchema = zod_1.z.object({
    post_id: zod_1.z.string().optional(),
});
exports.getAllPostsSchema = getAllPostsSchema;
const getUserNotifySchema = zod_1.z.object({
    user_id: zod_1.z.string(),
});
exports.getUserNotifySchema = getUserNotifySchema;
//# sourceMappingURL=index.js.map