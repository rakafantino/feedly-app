import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Lupa Password | Feedly',
  description: 'Reset password akun Feedly Anda',
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
} 