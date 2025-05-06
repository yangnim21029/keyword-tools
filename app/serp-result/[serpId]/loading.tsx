import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      {/* Placeholder for Page Title */}
      <Skeleton className="h-8 w-1/2 mb-6" />

      {/* Placeholder for Total Analyzed Count Alert */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-4 w-3/4 mt-1" />
        </CardHeader>
      </Card>

      {/* Placeholder for Inputs and Fetch Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/3" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-2/3 mt-1" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/4" /> {/* Label */}
              <Skeleton className="h-10 w-full" /> {/* Input */}
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/4" /> {/* Label */}
              <Skeleton className="h-10 w-full" /> {/* Select */}
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/4" /> {/* Label */}
              <Skeleton className="h-10 w-full" /> {/* Select */}
            </div>
          </div>
          <Skeleton className="h-10 w-40" /> {/* Button */}
        </CardContent>
      </Card>

      {/* Placeholder for Display SERP Data Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/3" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-1/4 mt-1" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Raw Data */}
          <div>
            <Skeleton className="h-5 w-1/5 mb-2" />
            <Skeleton className="h-40 w-full" />
          </div>
          {/* Formatted Organic Results */}
          <div>
            <Skeleton className="h-5 w-2/5 mb-2" />
            <Skeleton className="h-40 w-full" />
          </div>
          {/* Formatted Related Keywords */}
          <div>
            <Skeleton className="h-5 w-2/5 mb-2" />
            <Skeleton className="h-20 w-full" />
          </div>
          {/* Formatted PAA */}
          <div>
            <Skeleton className="h-5 w-1/4 mb-2" />
            <Skeleton className="h-20 w-full" />
          </div>
          {/* Formatted AI Overview */}
          <div>
            <Skeleton className="h-5 w-1/4 mb-2" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>

      {/* Placeholder for Analysis Triggers Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-1/3" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-3/4 mt-1" />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
