import type { Metadata } from "next";
import { Inter, Cinzel } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getBaseUrl, getBaseUrlObject } from "@/lib/site-url";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: getBaseUrlObject(),
  title: {
    default: "Remind - Free Secure Online Markdown Editor & Private Notebook",
    template: "%s | Remind",
  },
  description:
    "Remind is a free and secure browser-based online Markdown reading and editing website, built as an online private notebook. Encrypted notes, local-first storage, and privacy by design.",
  applicationName: "Remind",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  keywords: [
    "Remind",
    "free markdown editor",
    "online markdown editor",
    "markdown reader online",
    "browser markdown editor",
    "secure online notes",
    "private online notebook",
    "online privacy notebook",
    "encrypted markdown notes",
    "Markdown",
    "Local-first",
    "Encrypted notes",
    "Reflection",
    "Repentance",
    "Private notes",
    "Offline notes",
    "Local storage",
    "End-to-end encryption",
  ],
  openGraph: {
    type: "website",
    url: getBaseUrl(),
    title: "Remind - Free Secure Online Markdown Editor & Private Notebook",
    description:
      "Free secure browser-based online Markdown reading and editing with encrypted private notes.",
    siteName: "Remind",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Remind - Free secure online Markdown editor and private notebook",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Remind - Free Secure Online Markdown Editor",
    description:
      "Free secure browser-based Markdown reading and editing for private notes.",
    images: ["/twitter-image"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Remind",
  url: getBaseUrl(),
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  browserRequirements: "Requires a modern browser with Web Crypto support.",
  description:
    "A free and secure browser-based online Markdown editor and private notebook with local-first encrypted storage.",
  featureList: [
    "Free online Markdown reader and editor",
    "Private encrypted notes",
    "Browser-based access",
    "Local-first storage",
    "No account required for local usage",
  ],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${cinzel.variable} antialiased bg-ink text-silk font-sans`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
