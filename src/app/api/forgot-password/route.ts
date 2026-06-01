import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { forgotPasswordSchema } from "@/lib/validations/auth";

async function sendResetEmail(toEmail: string, userName: string, resetUrl: string): Promise<boolean> {
  try {
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !publicKey) {
      console.error("EmailJS configuration missing");
      return false;
    }

    const templateParams = {
      to_email: toEmail,
      user_name: userName || toEmail,
      reset_url: resetUrl,
      from_name: "Feedly App",
      reply_to: process.env.FROM_EMAIL || "noreply@feedly-app.com",
    };

    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: templateParams,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("EmailJS API error:", errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send reset email:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validationResult = forgotPasswordSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { email } = validationResult.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ message: "Jika email terdaftar, instruksi reset password telah dikirim" }, { status: 200 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

    await prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    const emailSent = await sendResetEmail(user.email, user.name || user.email, resetUrl);

    if (!emailSent) {
      console.error("Failed to send reset email to:", email);
    }

    return NextResponse.json({ message: "Instruksi reset password telah dikirim ke email Anda" }, { status: 200 });
  } catch (error) {
    console.error("Error processing forgot password request:", error);
    return NextResponse.json({ error: "Terjadi kesalahan saat memproses permintaan" }, { status: 500 });
  }
}
