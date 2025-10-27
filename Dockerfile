# --- TAHAP 1: BUILD ---
# Gunakan image Node.js yang stabil untuk membangun aplikasi
FROM node:20-alpine AS build

# Tentukan direktori kerja di dalam container
WORKDIR /app

# Salin package.json dan package-lock.json (atau yarn.lock)
# untuk menginstal dependensi
COPY package*.json ./
# Jika menggunakan Yarn, ganti baris di atas dengan:
# COPY package.json yarn.lock ./

# Instal dependensi
RUN npm install
# Jika menggunakan Yarn, ganti baris di atas dengan:
# RUN yarn install

# Salin sisa kode sumber
COPY . .

# Jalankan proses build NestJS (mengkompilasi TypeScript ke JavaScript)
# Pastikan skrip 'build' ada di package.json Anda
RUN npm run build
# Jika menggunakan Yarn:
# RUN yarn build

# --- TAHAP 2: PRODUCTION/RUNTIME ---
# Gunakan image Node.js yang lebih kecil (misalnya alpine) untuk produksi
FROM node:20-alpine AS production

# Tentukan direktori kerja
WORKDIR /usr/src/app

# Salin hanya node_modules produksi dan folder dist dari tahap 'build'
# Perhatikan bahwa 'node_modules' di tahap 'build' berisi dependensi pengembangan,
# jadi kita perlu menginstal ulang dependensi produksi di tahap ini.

# Salin package.json untuk menginstal dependensi produksi
COPY package*.json ./

# Instal hanya dependensi produksi
RUN npm install --omit=dev
# Jika menggunakan Yarn:
# RUN yarn install --production

# Salin kode aplikasi yang sudah terkompilasi dari tahap 'build'
COPY --from=build /app/dist ./dist

# Ekspos port yang digunakan aplikasi NestJS (default adalah 3000)
EXPOSE 3000

# Perintah untuk menjalankan aplikasi
# Pastikan skrip 'start:prod' ada di package.json Anda
CMD [ "node", "dist/main" ]