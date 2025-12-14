import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name: string;
    tenantId: string | null;
    tenantName: string | null;
    role: string | null;
  }

  interface Session {
    user: User;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    tenantId: string | null;
    tenantName: string | null;
    role: string | null;
  }
}
