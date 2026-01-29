import { QuoteForm } from "@/components/forms/quote-form";

export const metadata = {
  title: "Request a Quote - TripCaddie",
  description: "Get a personalized quote for your golf trip",
};

export default function QuotePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Request a Golf Trip Quote
          </h1>
          <p className="text-gray-600">
            Fill out the form below and we&apos;ll match you with the perfect resort
            for your group.
          </p>
        </div>
        <QuoteForm />
      </div>
    </div>
  );
}
