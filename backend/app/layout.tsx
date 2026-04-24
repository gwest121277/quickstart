export const metadata = {
  title: "Quickstart.life",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#1C1C2E",
          color: "#EDEDED",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
