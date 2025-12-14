import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import prisma from './prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email dan password harus diisi');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            tenants: {
              where: { isDefault: true },
              include: { tenant: true },
            },
          },
        });

        if (!user) {
          throw new Error('Email atau password salah');
        }

        const isPasswordValid = await compare(credentials.password, user.password);

        if (!isPasswordValid) {
          throw new Error('Email atau password salah');
        }

        const defaultTenant = user.tenants[0];

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: defaultTenant?.tenantId || null,
          tenantName: defaultTenant?.tenant.name || null,
          role: defaultTenant?.role || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.tenantName = user.tenantName;
        token.role = user.role;
      }

      if (trigger === 'update' && session?.tenantId) {
        const userTenant = await prisma.userTenant.findFirst({
          where: {
            userId: token.id as string,
            tenantId: session.tenantId,
          },
          include: { tenant: true },
        });

        if (userTenant) {
          token.tenantId = userTenant.tenantId;
          token.tenantName = userTenant.tenant.name;
          token.role = userTenant.role;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string | null;
        session.user.tenantName = token.tenantName as string | null;
        session.user.role = token.role as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
