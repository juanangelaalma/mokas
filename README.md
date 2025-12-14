# Mokas - Accounting untuk UMKM

Aplikasi akuntansi sederhana untuk UMKM Indonesia. Dibangun dengan Next.js, Prisma, dan PostgreSQL.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Backend**: Next.js Route Handlers, Server Actions
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Auth**: NextAuth.js
- **Validation**: Zod

## Quick Start

### Development dengan Docker

```bash
# 1. Clone & masuk ke direktori
cd mokas-ai-assisted-v2

# 2. Jalankan PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# 3. Install dependencies
npm install

# 4. Generate Prisma Client
npm run db:generate

# 5. Jalankan migrasi database
npm run db:push

# 6. Seed data demo
npm run db:seed

# 7. Jalankan aplikasi
npm run dev
```

Buka http://localhost:3000

### Demo Login

- Email: `demo@mokas.id`
- Password: `demo123`

## Fitur

- [x] Multi-tenant (multi UMKM)
- [x] Chart of Accounts standar UMKM
- [x] Input transaksi (pemasukan/pengeluaran)
- [x] Auto-generate jurnal (double-entry)
- [x] Laporan:
  - [x] Jurnal Umum
  - [x] Buku Besar
  - [x] Neraca Saldo
  - [x] Laba Rugi
  - [x] Neraca

## Struktur Folder

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages (login, register)
│   ├── (dashboard)/       # Protected dashboard pages
│   └── api/               # API Routes
├── components/            # React components
├── domain/                # Business logic (accounting)
├── services/              # Application services
├── schemas/               # Zod validation schemas
├── lib/                   # Utilities & config
└── types/                 # TypeScript types
```

## License

MIT
