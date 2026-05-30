import "./globals.css";

export const metadata = {
  title: "RentSimple",
  description: "Property management made simple",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


