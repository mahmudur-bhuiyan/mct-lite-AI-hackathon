import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopNav } from "./TopNav";
import OnboardingWizard from "@/components/OnboardingWizard";
import { useOnboarding } from "@/hooks/useOnboarding";
import { AppSidebarProvider, useAppSidebar } from "@/contexts/AppSidebarContext";
import { cn } from "@/lib/utils";

function isChatRoute(pathname: string) {
  return pathname === "/ai" || pathname === "/ai/chat" || /^\/ai\/agents\/[^/]+\/chat$/.test(pathname);
}

function DashboardLayoutContent() {
  const { showOnboarding, loading, completeOnboarding, skipOnboarding } =
    useOnboarding();
  const sidebar = useAppSidebar();
  const collapsed = sidebar?.collapsed ?? false;
  const location = useLocation();
  const noRightPadding = isChatRoute(location.pathname);

  return (
    <div
      className={cn(
        "bg-background",
        isChatRoute(location.pathname) ? "h-screen overflow-hidden" : "min-h-screen"
      )}
    >
      <AppSidebar />
      <TopNav />
      <main
        className={cn(
          "mt-16 min-h-[calc(100vh-4rem)] p-6 lg:p-8 transition-[margin-left] duration-200 ease-in-out",
          collapsed ? "ml-16" : "ml-64",
          noRightPadding &&
            "pr-0 lg:pr-0 h-[calc(100vh-4rem)] overflow-hidden"
        )}
      >
        <Outlet />
      </main>

      {/* Onboarding Wizard */}
      {!loading && showOnboarding && (
        <OnboardingWizard
          open={showOnboarding}
          onClose={skipOnboarding}
          onComplete={completeOnboarding}
        />
      )}
    </div>
  );
}

export function DashboardLayout() {
  return (
    <AppSidebarProvider>
      <DashboardLayoutContent />
    </AppSidebarProvider>
  );
}
