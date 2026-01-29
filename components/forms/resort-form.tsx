"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

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
import { useToast } from "@/hooks/use-toast";
import { resortSchema, type ResortInput } from "@/lib/validation";

interface ResortFormProps {
  resort?: ResortInput & { id: string };
}

export function ResortForm({ resort }: ResortFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!resort;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ResortInput>({
    resolver: zodResolver(resortSchema),
    defaultValues: resort || {
      country: "USA",
      numberOfCourses: 1,
      minimumNights: 1,
      minimumGolfers: 4,
      advanceBookingDays: 7,
      isActive: true,
    },
  });

  const onSubmit = async (data: ResortInput) => {
    setIsSubmitting(true);

    try {
      const url = isEditing ? `/api/resorts/${resort.id}` : "/api/resorts";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save resort");
      }

      toast({
        title: isEditing ? "Resort Updated" : "Resort Created",
        description: `${data.name} has been ${isEditing ? "updated" : "added"} successfully`,
      });

      router.push("/resorts");
      router.refresh();
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Resort name and location details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Resort Name *</Label>
              <Input
                id="name"
                placeholder="Pebble Beach Golf Links"
                {...register("name")}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug *</Label>
              <Input
                id="slug"
                placeholder="pebble-beach"
                {...register("slug")}
                className={errors.slug ? "border-red-500" : ""}
              />
              {errors.slug && (
                <p className="text-sm text-red-500">{errors.slug.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="A world-renowned golf destination..."
              rows={3}
              {...register("description")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="Pebble Beach"
                {...register("city")}
                className={errors.city ? "border-red-500" : ""}
              />
              {errors.city && (
                <p className="text-sm text-red-500">{errors.city.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                placeholder="California"
                {...register("state")}
                className={errors.state ? "border-red-500" : ""}
              />
              {errors.state && (
                <p className="text-sm text-red-500">{errors.state.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="1700 17 Mile Drive"
              {...register("address")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capacity & Requirements</CardTitle>
          <CardDescription>Set limits and minimum requirements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="maxGolfers">Max Golfers *</Label>
              <Input
                id="maxGolfers"
                type="number"
                min={1}
                {...register("maxGolfers", { valueAsNumber: true })}
                className={errors.maxGolfers ? "border-red-500" : ""}
              />
              {errors.maxGolfers && (
                <p className="text-sm text-red-500">
                  {errors.maxGolfers.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxRooms">Max Rooms *</Label>
              <Input
                id="maxRooms"
                type="number"
                min={1}
                {...register("maxRooms", { valueAsNumber: true })}
                className={errors.maxRooms ? "border-red-500" : ""}
              />
              {errors.maxRooms && (
                <p className="text-sm text-red-500">
                  {errors.maxRooms.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="numberOfCourses">Courses</Label>
              <Input
                id="numberOfCourses"
                type="number"
                min={1}
                {...register("numberOfCourses", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="minimumNights">Min Nights</Label>
              <Input
                id="minimumNights"
                type="number"
                min={1}
                {...register("minimumNights", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimumGolfers">Min Golfers</Label>
              <Input
                id="minimumGolfers"
                type="number"
                min={1}
                {...register("minimumGolfers", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="advanceBookingDays">Advance Booking (days)</Label>
              <Input
                id="advanceBookingDays"
                type="number"
                min={0}
                {...register("advanceBookingDays", { valueAsNumber: true })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Base pricing for quotes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="basePricePerGolfer">Base Price per Golfer ($)</Label>
              <Input
                id="basePricePerGolfer"
                type="number"
                min={0}
                step="0.01"
                placeholder="250.00"
                {...register("basePricePerGolfer", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="basePricePerRoom">Base Price per Room/Night ($)</Label>
              <Input
                id="basePricePerRoom"
                type="number"
                min={0}
                step="0.01"
                placeholder="350.00"
                {...register("basePricePerRoom", { valueAsNumber: true })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact & Notifications</CardTitle>
          <CardDescription>
            Where to send booking requests
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="primaryEmail">Primary Email *</Label>
            <Input
              id="primaryEmail"
              type="email"
              placeholder="bookings@resort.com"
              {...register("primaryEmail")}
              className={errors.primaryEmail ? "border-red-500" : ""}
            />
            {errors.primaryEmail && (
              <p className="text-sm text-red-500">
                {errors.primaryEmail.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : isEditing ? (
            "Update Resort"
          ) : (
            "Create Resort"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
