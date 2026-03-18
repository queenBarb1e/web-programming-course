//  читать .env файл (DATABASE_URL, JWT_SECRET и т.д.)
import "dotenv/config"    
// Prisma использует эту функцию, чтобы понять конфигурацию        
import { defineConfig, env } from "prisma/config"
// Это основной конфиг Prisma
export default defineConfig({
  // Путь к файлу с чертежом базы данных
  schema: "prisma/schema.prisma",
// где лежит база данных
  datasource: {
    url: env("DATABASE_URL"),          
  },
})