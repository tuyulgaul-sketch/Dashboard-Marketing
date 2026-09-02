import React, { useState } from "react";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";

export const AppLayout: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-gray-900">
      <AppHeader
        onMenuClick={() => setMobileMenuOpen(true)}
      />

      <div className="flex min-w-0 flex-1">
        <AppSidebar />

        <Sheet
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
        >
          <SheetContent
            side="left"
            className="w-[86vw] max-w-[320px] border-slate-800 bg-slate-950 p-0 [&>button]:text-slate-300"
          >
            <SheetTitle className="sr-only">
              Menu Dashboard Marketing
            </SheetTitle>

            <AppSidebar
              mobile
              onNavigate={() => setMobileMenuOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <main
          className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-3 py-4 sm:px-5 sm:py-5 lg:p-6"
          style={{
            overflowX: "clip",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
