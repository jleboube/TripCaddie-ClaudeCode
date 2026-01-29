"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Send, Search, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface InquiryActionsProps {
  inquiryId: string;
  currentStatus: string;
  hasSearchResults: boolean;
}

export function InquiryActions({
  inquiryId,
  currentStatus,
  hasSearchResults,
}: InquiryActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const triggerAgent = async (agentType: "REQUEST" | "SEARCH" | "BOOKING") => {
    setLoading(agentType);

    try {
      const response = await fetch(`/api/inquiries/${inquiryId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentType }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to trigger agent");
      }

      toast({
        title: "Agent Triggered",
        description: `${agentType} agent has been started`,
      });

      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const canRetryRequest = ["PENDING", "FAILED"].includes(currentStatus);
  const canRetrySearch = [
    "REQUEST_ACCEPTED",
    "SEARCH_COMPLETED",
    "FAILED",
  ].includes(currentStatus);
  const canTriggerBooking =
    hasSearchResults &&
    ["SEARCH_COMPLETED", "FAILED"].includes(currentStatus);

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="outline"
        onClick={() => triggerAgent("REQUEST")}
        disabled={loading !== null || !canRetryRequest}
      >
        {loading === "REQUEST" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileCheck className="mr-2 h-4 w-4" />
        )}
        Re-run Request Agent
      </Button>

      <Button
        variant="outline"
        onClick={() => triggerAgent("SEARCH")}
        disabled={loading !== null || !canRetrySearch}
      >
        {loading === "SEARCH" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Search className="mr-2 h-4 w-4" />
        )}
        Re-run Search Agent
      </Button>

      <Button
        variant="default"
        onClick={() => triggerAgent("BOOKING")}
        disabled={loading !== null || !canTriggerBooking}
      >
        {loading === "BOOKING" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        Send Booking Requests
      </Button>
    </div>
  );
}
