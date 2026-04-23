import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinguaBot – AI English Speaking Assistant",
  description: "Practice and improve your English speaking skills with AI-powered conversation, real-time feedback, and pronunciation guidance.",
  keywords: "English learning, AI chatbot, speaking practice, pronunciation, language learning",
  openGraph: {
    title: "LinguaBot – AI English Speaking Assistant",
    description: "Practice English with an AI tutor that listens, corrects, and guides you.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
