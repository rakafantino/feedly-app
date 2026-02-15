'use client';

import React from 'react';
import { StoreProvider } from './store-provider';
import { SessionProvider } from 'next-auth/react';
import { CookiesProvider } from 'react-cookie';
import { ThemeProvider } from 'next-themes';
import QueryProvider from './query-provider';

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <SessionProvider 
        refetchOnWindowFocus={false} 
        refetchInterval={0} // Disable polling
      >
        <QueryProvider>
          <StoreProvider>
            <CookiesProvider>
              {children}
            </CookiesProvider>
          </StoreProvider>
        </QueryProvider>
      </SessionProvider>
    </ThemeProvider>
  );
};
