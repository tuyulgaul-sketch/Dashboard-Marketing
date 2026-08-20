import React from 'react';
import { AppHeader } from './AppHeader';
import { AppSidebar } from './AppSidebar';

export const AppLayout: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-900">
      <AppHeader />

      <div className="flex flex-1 min-w-0">
        <AppSidebar />

        <main
          className="flex-1 p-6 max-w-7xl mx-auto w-full min-w-0"
          style={{
            // IMPORTANT:
            // overflow-x:hidden creates a scroll container and can prevent
            // descendants with position: sticky from sticking to viewport.
            // overflow-x:clip clips horizontal overflow WITHOUT becoming
            // a scrolling ancestor, so Dashboard sticky controls can work.
            overflowX: 'clip',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
