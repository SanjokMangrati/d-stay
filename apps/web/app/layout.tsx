import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ApiProvider } from "@/lib/api/api-provider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: t("name"), description: t("tagline") };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="bg-background text-foreground min-h-dvh antialiased">
        <NextIntlClientProvider>
          <ApiProvider>{children}</ApiProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
