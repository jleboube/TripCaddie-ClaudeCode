import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Users, MapPin } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="text-2xl font-bold text-green-700">TripCaddie</div>
          <Link href="/admin/login">
            <Button variant="outline">Admin Login</Button>
          </Link>
        </nav>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Plan Your Perfect Golf Trip
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Get instant quotes from top golf resorts. Our intelligent booking
            engine matches your group with the perfect destination.
          </p>
          <Link href="/quote">
            <Button size="lg" className="gap-2">
              Request a Quote <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-20 max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <Calendar className="w-10 h-10 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Flexible Dates</h3>
            <p className="text-gray-600">
              Tell us when you want to play and we&apos;ll find availability
              that works for your group.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <Users className="w-10 h-10 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Any Group Size</h3>
            <p className="text-gray-600">
              From foursomes to corporate outings, we handle groups of all
              sizes.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <MapPin className="w-10 h-10 text-green-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Top Destinations</h3>
            <p className="text-gray-600">
              Access premier golf resorts across the country with exclusive
              packages.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-gray-500">
          <p>&copy; {new Date().getFullYear()} TripCaddie. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
