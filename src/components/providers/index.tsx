'use client';

import React from 'react';
import { StoreProvider } from './store-provider';
import { SessionProvider } from 'next-auth/react';
import { CookiesProvider } from 'react-cookie';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <Toaster />
      <SessionProvider>
        <StoreProvider>
          <CookiesProvider>
            {children}
          </CookiesProvider>
        </StoreProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}; 