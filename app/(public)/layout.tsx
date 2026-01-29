import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-green-700">
              TripCaddie
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/quote"
                className="text-sm font-medium text-gray-600 hover:text-green-700"
              >
                Request Quote
              </Link>
            </div>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-8 text-center text-gray-500">
          <p>&copy; {new Date().getFullYear()} TripCaddie. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
