/**
 * Email service menggunakan EmailJS
 * File ini dirancang untuk penggunaan di server-side
 */

// Konfigurasi EmailJS
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;

// Alamat email pengirim
const fromEmail = process.env.FROM_EMAIL || 'noreply@feedly-app.com';

// Memeriksa konfigurasi EmailJS
const isEmailJSConfigured = EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY;

/**
 * Mengirim email reset password menggunakan EmailJS API
 * 
 * Implementasi untuk server-side yang menggunakan REST API
 * dari EmailJS untuk mengirim email tanpa memerlukan browser
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  userName: string
) {
  try {
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    console.log(`Mengirim email reset password ke ${email} menggunakan EmailJS`);
    
    if (!isEmailJSConfigured) {
      console.warn('EmailJS belum dikonfigurasi dengan benar. Pastikan Anda telah mengatur EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, dan EMAILJS_PUBLIC_KEY');
      console.log('URL reset password (untuk debug):', resetUrl);
      
      return {
        success: false,
        error: 'EmailJS belum dikonfigurasi dengan benar'
      };
    }
    
    // Menyiapkan parameter untuk template
    const templateParams = {
      to_email: email,
      user_name: userName,
      reset_url: resetUrl,
      from_name: 'Feedly App',
      reply_to: fromEmail
    };
    
    // Menggunakan EmailJS REST API untuk server-side (tidak memerlukan browser)
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: templateParams,
      }),
    });
    
    if (response.ok) {
      console.log('Email reset password berhasil dikirim ke:', email);
      return { 
        success: true, 
        data: {
          id: 'emailjs-' + Date.now(),
          from: 'EmailJS Service',
          to: email
        }
      };
    } else {
      const errorText = await response.text();
      console.error('Error sending email with EmailJS:', errorText);
      return { 
        success: false, 
        error: `Failed to send email: ${errorText}` 
      };
    }
  } catch (error: any) {
    console.error('Failed to send reset email with EmailJS:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send reset email' 
    };
  }
} 