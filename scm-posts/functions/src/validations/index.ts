import { z } from "zod";

const getUserNotifySchema = z.object({
  user_id: z.string(),
});

export { getUserNotifySchema };
