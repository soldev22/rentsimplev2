import "./globals.css";

import Link from "next/link";
import { ClerkProvider, Show, UserButton } from "@clerk/nextjs";

import AppChrome from "@/components/layout/AppChrome";
import { hasClerkPublishableKey } from "@/lib/clerk-env";

export const metadata = {
  title: "RentSimple",
  description: "Property management made simple",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isClerkAvailable = hasClerkPublishableKey()
  const authControls = isClerkAvailable ? (
    <>
      <Show when="signed-out">
        <div className="flex items-center gap-3">
          <Link href="/login?mode=register" className="rounded border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white">
            Register
          </Link>
          <Link href="/login" className="rounded bg-white px-4 py-2 text-sm font-medium text-slate-900">
            Login
          </Link>
        </div>
      </Show>
      <Show when="signed-in">
        <div className="flex items-center gap-3">
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "h-10 w-10",
              },
            }}
          />
        </div>
      </Show>
    </>
  ) : null

  const appContent = <AppChrome authControls={authControls}>{children}</AppChrome>

  return (
    <html lang="en">
      <body>
        {isClerkAvailable ? <ClerkProvider>{appContent}</ClerkProvider> : appContent}
      </body>
    </html>
  );
}


