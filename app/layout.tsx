import type { Metadata } from "next";
import "./globals.css";
import NavTabs from "@/components/nav-tabs";

export const metadata: Metadata = {
  title: "MorphBoard + Unplayed",
  description: "Generative-UI dashboard composer & AI game inventor. Built on CopilotKit + AG-UI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavTabs />
        {children}
      </body>
    </html>
  );
}
