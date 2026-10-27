import { z } from 'zod'
export const profileSchema = z.object({ nickname: z.string().trim().min(1).max(24) })
