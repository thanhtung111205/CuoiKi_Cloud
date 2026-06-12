# ====================================================
# CKI CLOUD G12 - Dockerfile
# Hệ sinh thái Học ngoại ngữ và Thi đấu Flashcard
# Deploy target: Google Cloud Run
# ====================================================

# --- Stage 1: Base image ---
# Sử dụng Node.js 20 Alpine (nhẹ, bảo mật, phù hợp production)
FROM node:20-alpine

# Cài đặt OpenSSL và tương thích libc cho Prisma Engine
RUN apk add --no-cache openssl libc6-compat

# Đặt thư mục làm việc trong container
WORKDIR /app

# --- Stage 2: Cài đặt dependencies ---
# Copy package.json và package-lock.json trước (tận dụng Docker cache layer)
# Nếu dependencies không đổi, Docker sẽ dùng cache → build nhanh hơn
COPY package*.json ./

# Cài đặt chỉ production dependencies (không cài devDependencies như nodemon)
RUN npm ci --only=production

# --- Stage 3: Copy source code ---
# Copy toàn bộ mã nguồn vào container
COPY . .

# Khởi tạo Prisma Client trong container
RUN npx prisma generate

# --- Stage 4: Cấu hình runtime ---
# Mở cổng 8080 (Google Cloud Run mặc định sử dụng cổng này)
EXPOSE 8080

# Đặt biến môi trường mặc định
ENV NODE_ENV=production
ENV PORT=8080

# --- Stage 5: Khởi chạy server ---
# Sử dụng CMD thay vì ENTRYPOINT để dễ override khi debug
CMD ["node", "src/index.js"]
