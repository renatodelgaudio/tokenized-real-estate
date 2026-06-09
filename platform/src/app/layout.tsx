import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Tokenized Real Estate — ERC-3643 Platform PoC",
  description:
    "A learning proof-of-concept of a multi-tenant ERC-3643 (T-REX) tokenization platform: Admin, KYC service, Issuer and Explorer roles.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
