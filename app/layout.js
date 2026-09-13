import { Quicksand } from "next/font/google";
import "./globals.css";
import BattleRouteGuard from "./BattleRouteGuard";

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-quicksand",
});

export const metadata = {
  title: "MobDuel",
  description: "A turn-based Minecraft card game inspired by Solar Cards",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={quicksand.variable}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,600,1,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <BattleRouteGuard />
      </body>
    </html>
  );
}
