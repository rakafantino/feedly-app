import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password - Feedly",
  description: "Reset password untuk akun Feedly",
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
} 