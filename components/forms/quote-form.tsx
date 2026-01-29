"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { quoteFormSchema, type QuoteFormInput, DESTINATIONS } from "@/lib/validation";
import { cn } from "@/lib/utils";

export function QuoteForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<QuoteFormInput>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      numberOfGolfers: 4,
      roundsPerGolfer: 3,
      numberOfRooms: 2,
      roomType: "double",
    },
  });

  const arrivalDate = watch("arrivalDate");
  const departureDate = watch("departureDate");

  const onSubmit = async (data: QuoteFormInput) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit quote request");
      }

      toast({
        title: "Quote Request Submitted!",
        description: `Your inquiry number is ${result.inquiryNumber}`,
      });

      router.push(`/quote/confirmation/${result.inquiryId}`);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>
            How can we reach you about your trip?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contactName">Full Name *</Label>
              <Input
                id="contactName"
                placeholder="John Smith"
                {...register("contactName")}
                className={errors.contactName ? "border-red-500" : ""}
              />
              {errors.contactName && (
                <p className="text-sm text-red-500">
                  {errors.contactName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email *</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="john@example.com"
                {...register("contactEmail")}
                className={errors.contactEmail ? "border-red-500" : ""}
              />
              {errors.contactEmail && (
                <p className="text-sm text-red-500">
                  {errors.contactEmail.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Phone *</Label>
            <Input
              id="contactPhone"
              type="tel"
              placeholder="(555) 123-4567"
              {...register("contactPhone")}
              className={errors.contactPhone ? "border-red-500" : ""}
            />
            {errors.contactPhone && (
              <p className="text-sm text-red-500">
                {errors.contactPhone.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trip Details</CardTitle>
          <CardDescription>Tell us about your golf trip</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="destination">Destination *</Label>
            <Select onValueChange={(value) => setValue("destination", value)}>
              <SelectTrigger className={errors.destination ? "border-red-500" : ""}>
                <SelectValue placeholder="Select your destination" />
              </SelectTrigger>
              <SelectContent>
                {DESTINATIONS.map((dest) => (
                  <SelectItem key={dest.value} value={dest.value}>
                    {dest.label}{dest.state ? `, ${dest.state}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.destination && (
              <p className="text-sm text-red-500">
                {errors.destination.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Arrival Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !arrivalDate && "text-muted-foreground",
                      errors.arrivalDate && "border-red-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {arrivalDate ? format(arrivalDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={arrivalDate}
                    onSelect={(date) => date && setValue("arrivalDate", date)}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.arrivalDate && (
                <p className="text-sm text-red-500">
                  {errors.arrivalDate.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Departure Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !departureDate && "text-muted-foreground",
                      errors.departureDate && "border-red-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {departureDate
                      ? format(departureDate, "PPP")
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={departureDate}
                    onSelect={(date) => date && setValue("departureDate", date)}
                    disabled={(date) =>
                      date < new Date() || (arrivalDate && date <= arrivalDate)
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.departureDate && (
                <p className="text-sm text-red-500">
                  {errors.departureDate.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="numberOfGolfers">Number of Golfers *</Label>
              <Input
                id="numberOfGolfers"
                type="number"
                min={1}
                max={100}
                {...register("numberOfGolfers", { valueAsNumber: true })}
                className={errors.numberOfGolfers ? "border-red-500" : ""}
              />
              {errors.numberOfGolfers && (
                <p className="text-sm text-red-500">
                  {errors.numberOfGolfers.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="roundsPerGolfer">Rounds per Golfer *</Label>
              <Input
                id="roundsPerGolfer"
                type="number"
                min={1}
                max={10}
                {...register("roundsPerGolfer", { valueAsNumber: true })}
                className={errors.roundsPerGolfer ? "border-red-500" : ""}
              />
              {errors.roundsPerGolfer && (
                <p className="text-sm text-red-500">
                  {errors.roundsPerGolfer.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="numberOfRooms">Number of Rooms *</Label>
              <Input
                id="numberOfRooms"
                type="number"
                min={1}
                max={50}
                {...register("numberOfRooms", { valueAsNumber: true })}
                className={errors.numberOfRooms ? "border-red-500" : ""}
              />
              {errors.numberOfRooms && (
                <p className="text-sm text-red-500">
                  {errors.numberOfRooms.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="roomType">Room Type *</Label>
            <Select
              defaultValue="double"
              onValueChange={(value) => setValue("roomType", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select room type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single Occupancy (1 per room)</SelectItem>
                <SelectItem value="double">Double Occupancy (2 per room)</SelectItem>
                <SelectItem value="triple">Triple Occupancy (3 per room)</SelectItem>
                <SelectItem value="quad">Quad Occupancy (4 per room)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budget & Preferences</CardTitle>
          <CardDescription>Help us find the best match for you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="budgetMin">Minimum Budget ($)</Label>
              <Input
                id="budgetMin"
                type="number"
                min={0}
                placeholder="1000"
                {...register("budgetMin", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budgetMax">Maximum Budget ($)</Label>
              <Input
                id="budgetMax"
                type="number"
                min={0}
                placeholder="5000"
                {...register("budgetMax", { valueAsNumber: true })}
              />
              {errors.budgetMax && (
                <p className="text-sm text-red-500">
                  {errors.budgetMax.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialRequests">Special Requests</Label>
            <Textarea
              id="specialRequests"
              placeholder="Any special requirements, dietary restrictions, accessibility needs, etc."
              rows={4}
              {...register("specialRequests")}
            />
            {errors.specialRequests && (
              <p className="text-sm text-red-500">
                {errors.specialRequests.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit Quote Request"
        )}
      </Button>
    </form>
  );
}
