import type { Metadata } from "next";

import { CommandPalette } from "@/components/CommandPalette";
import { RuntimeProvider } from "@/engine/runtime/RuntimeProvider";
import { TransitionProvider } from "@/engine/transition/TransitionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "David Uchenna Agodi — Frontend Engineer",
  description:
    "I build production interfaces for AI products. I came to them through control systems — which is why nothing on this page eases. It settles.",
};

/**
 * Runs before first paint, so a returning visitor never sees a frame of a boot
 * sequence that is about to remove itself. React cannot do this — by the time
 * hydration runs the flash has already happened — which is why it is a raw script
 * stamping an attribute the stylesheet reacts to.
 */
const BOOT_FLAG = `try{if(sessionStorage.getItem("boot")==="1")document.documentElement.dataset.booted="1"}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_FLAG }} />
      </head>
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only font-mono text-[11px] tracking-[0.14em] uppercase focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-60 focus:border focus:border-response focus:bg-void focus:px-3 focus:py-2 focus:text-response"
        >
          Skip to content
        </a>
        {/* One runtime for the whole application — one rAF, one clock, one place where
            the simulation advances. Nesting a second provider would silently double it. */}
        <RuntimeProvider>
          <TransitionProvider>
            {children}
            <CommandPalette />
          </TransitionProvider>
        </RuntimeProvider>
      </body>
    </html>
  );
}
