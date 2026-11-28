import { z } from 'zod'
const announcementSchema = z
  .object({
    title: z.string().trim().min(1, 'Nhập tiêu đề.').max(160),
    content: z.string().trim().min(1, 'Nhập nội dung.').max(4000),
  })
  .strict()
const supportMessageSchema = z
  .object({ content: z.string().trim().min(1, 'Nhập tin nhắn.').max(4000) })
  .strict()
const adminCategorySchema = z
  .object({ name: z.string().trim().min(1, 'Nhập tên danh mục.') })
  .strict()
export { announcementSchema, supportMessageSchema, adminCategorySchema }
