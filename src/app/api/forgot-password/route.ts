import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email diperlukan' },
        { status: 400 }
      );
    }
    
    // Cari user berdasarkan email
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    // Jika user tidak ditemukan, tetap berikan respons sukses 
    // untuk menghindari user enumeration attack
    if (!user) {
      console.log(`Alamat email ${email} tidak ditemukan, mengembalikan sukses palsu`);
      return NextResponse.json(
        { message: 'Jika email terdaftar, instruksi reset password telah dikirim' },
        { status: 200 }
      );
    }
    
    // Generate token reset password (random token)
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 jam
    
    // Hapus token lama jika ada
    await prisma.passwordReset.deleteMany({
      where: { userId: user.id }
    });
    
    // Simpan token ke database
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });
    
    // Siapkan email config untuk client-side
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    
    // Siapkan template params untuk EmailJS
    const templateParams = {
      to_email: user.email,
      user_name: user.name || user.email,
      reset_url: resetUrl,
      from_name: 'Feedly App',
      reply_to: process.env.FROM_EMAIL || 'noreply@feedly-app.com'
    };
    
    // Log untuk debugging
    console.log("Reset URL:", resetUrl);
    
    // Kembalikan respons sukses
    return NextResponse.json(
      {
        message: 'Instruksi reset password telah dikirim ke email Anda',
        // Tambahkan data untuk EmailJS client-side
        emailConfig: {
          serviceId: process.env.EMAILJS_SERVICE_ID,
          templateId: process.env.EMAILJS_TEMPLATE_ID,
          templateParams: templateParams
        },
        // Flag untuk frontend bahwa email perlu dikirim
        needToSendEmail: true
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error mengirim email reset password:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses permintaan' },
      { status: 500 }
    );
  }
} 