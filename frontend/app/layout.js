import './globals.css';

export const metadata = {
  title: 'Mini-Shop',
  description: 'nginx + microservices learning project',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
