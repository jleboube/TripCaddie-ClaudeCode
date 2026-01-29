import { ResortForm } from "@/components/forms/resort-form";

export const metadata = {
  title: "Add Resort - TripCaddie Admin",
};

export default function NewResortPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Resort</h1>
        <p className="text-muted-foreground">
          Configure a new golf resort to receive bookings
        </p>
      </div>
      <ResortForm />
    </div>
  );
}
