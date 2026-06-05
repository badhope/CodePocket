"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BackendStatusDot } from "@/components/system/backend-status-banner";

export default function Loading() {
  return (
    <div className="container mx-auto max-w-7xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-1/3" />
        <BackendStatusDot />
      </div>
      <Card>
        <CardContent className="space-y-3 p-6">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    </div>
  );
}
