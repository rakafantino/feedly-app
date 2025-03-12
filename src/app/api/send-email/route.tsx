import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token, userName, type = "reset-password" } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email diperlukan" },
        { status: 400 }
      );
    }

    // Setup untuk base URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin || "http://localhost:3000";
    
    // Menyiapkan parameter berdasarkan tipe email
    let templateParams = {};
    let successMessage = "";
    
    if (type === "reset-password") {
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      
      templateParams = {
        to_email: email,
        user_name: userName || email,
        reset_url: resetUrl,
        from_name: "Feedly App",
        reply_to: process.env.FROM_EMAIL || "noreply@feedly-app.com"
      };
      
      successMessage = "Email reset password telah dikirim";
    } else {
      return NextResponse.json(
        { error: "Tipe email tidak didukung" },
        { status: 400 }
      );
    }

    // Return konfigurasi yang akan digunakan oleh client untuk mengirim email
    return NextResponse.json({
      success: true,
      config: {
        serviceId: process.env.EMAILJS_SERVICE_ID,
        templateId: process.env.EMAILJS_TEMPLATE_ID,
        templateParams,
      },
      message: successMessage
    });
  } catch (error: any) {
    console.error("Error menyiapkan konfigurasi email:", error);
    return NextResponse.json(
      { error: error.message || "Terjadi kesalahan saat menyiapkan email" },
      { status: 500 }
    );
  }
} 