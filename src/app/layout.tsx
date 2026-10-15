import type { Metadata } from "next";
import { Caveat, PT_Sans, PT_Sans_Narrow, PT_Serif } from "next/font/google";
import "./globals.css";

// Шрифты лежат на самом сайте: страница не ждёт ответа от Google и не прыгает при загрузке.
const sans = PT_Sans({ subsets: ["latin", "cyrillic"], weight: ["400", "700"], variable: "--font-sans" });
const narrow = PT_Sans_Narrow({ subsets: ["latin", "cyrillic"], weight: "700", variable: "--font-narrow" });
const serif = PT_Serif({ subsets: ["latin", "cyrillic"], weight: ["400", "700"], variable: "--font-serif" });
const hand = Caveat({ subsets: ["latin", "cyrillic"], weight: ["500", "700"], variable: "--font-hand" });

export const metadata: Metadata = {
  title: "Тетрадь с пометками",
  description: "Задания, проверка работ и темы для повторения",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${sans.variable} ${narrow.variable} ${serif.variable} ${hand.variable}`}>
      <body>
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
