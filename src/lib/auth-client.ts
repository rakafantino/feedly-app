/**
 * File ini berisi fungsi client-side untuk autentikasi
 * Pisahkan dari auth.ts untuk menghindari masalah headers
 */

/**
 * Simulates a form-based login submission
 * This is more reliable than direct API calls to next-auth endpoints
 */
export const loginUser = async (email: string, password: string) => {
  try {
    // Pertama, dapatkan CSRF token dengan mengunjungi halaman signin
    const signinResponse = await fetch('/api/auth/csrf');
    
    if (!signinResponse.ok) {
      console.error('Failed to fetch CSRF token:', await signinResponse.text());
      return {
        success: false,
        error: 'MissingCSRF'
      };
    }
    
    const { csrfToken } = await signinResponse.json();
    
    if (!csrfToken) {
      return {
        success: false,
        error: 'MissingCSRF'
      };
    }
    
    // Buat form data untuk login
    const formData = new URLSearchParams();
    formData.append('email', email);
    formData.append('password', password);
    formData.append('csrfToken', csrfToken);
    formData.append('callbackUrl', '/dashboard');
    formData.append('json', 'true');
    
    // Submit form login
    const loginResponse = await fetch('/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
      redirect: 'follow',
    });
    
    // Check if there's an error
    if (!loginResponse.ok) {
      const errorData = await loginResponse.text();
      console.error('Login response error:', errorData);
      
      // Specific error handling for status codes
      if (loginResponse.status === 401) {
        return {
          success: false,
          error: 'CredentialsSignin'
        };
      }
      
      return {
        success: false,
        error: 'Login failed with status: ' + loginResponse.status
      };
    }
    
    // Handle redirection response
    const responseUrl = loginResponse.url;
    
    // Check if redirected to error page
    if (responseUrl.includes('error=')) {
      const urlObj = new URL(responseUrl);
      const errorCode = urlObj.searchParams.get('error');
      
      console.error('Login failed with error code:', errorCode);
      
      return {
        success: false,
        error: errorCode || 'Authentication failed'
      };
    }
    
    // Successful login
    return {
      success: true,
      data: { url: responseUrl }
    };
  } catch (error: any) {
    console.error('Login error:', error);
    return {
      success: false,
      error: error.message || 'Login failed due to an unexpected error'
    };
  }
};

/**
 * Simulates a form-based logout
 */
export const logoutUser = async () => {
  try {
    // Get CSRF token for logout
    const csrfResponse = await fetch('/api/auth/csrf');
    const { csrfToken } = await csrfResponse.json();
    
    if (!csrfToken) {
      throw new Error('CSRF token not available');
    }
    
    // Create form data for logout
    const formData = new URLSearchParams();
    formData.append('csrfToken', csrfToken);
    formData.append('callbackUrl', '/login?signout=success');
    formData.append('json', 'true');
    
    // Submit form logout
    const logoutResponse = await fetch('/api/auth/signout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
      redirect: 'follow',
    });
    
    if (!logoutResponse.ok) {
      throw new Error('Logout failed');
    }
    
    return {
      success: true
    };
  } catch (error: any) {
    console.error('Logout error:', error);
    return {
      success: false,
      error: error.message || 'Logout failed'
    };
  }
}; 