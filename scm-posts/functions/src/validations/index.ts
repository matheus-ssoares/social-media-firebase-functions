import { z } from "zod";

const createPostSchema = z.object({
  description: z.string().max(240),
  image_url: z.string(),
  image_preview: z.string(),
});

const getAllPostsSchema = z.object({
  post_id: z.string().optional(),
});

const getUserNotifySchema = z.object({
  user_id: z.string(),
});

const likePostSchema = z.object({
  post_id: z.string(),
});

const createCommentSchema = z.object({
  post_id: z.string(),
  content: z.string(),
});
const getAllPostCommentSchema = z.object({
  post_id: z.string(),
});
export {
  getUserNotifySchema,
  getAllPostsSchema,
  createPostSchema,
  likePostSchema,
  createCommentSchema,
  getAllPostCommentSchema,
};
