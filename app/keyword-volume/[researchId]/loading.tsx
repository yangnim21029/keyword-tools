import { Skeleton } from "@/components/ui/skeleton"; // Assuming shadcn/ui Skeleton is available

export default function KeywordMappingLoading() {
  return (
    <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">
      {" "}
      {/* Consistent container */}
      <div className="space-y-6">
        {/* Header Section Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Skeleton className="h-8 w-3/4 sm:w-1/2 rounded-md" />{" "}
          {/* Title Placeholder */}
          <div className="flex space-x-2">
            <Skeleton className="h-9 w-20 rounded-md" />{" "}
            {/* Button Placeholder */}
            <Skeleton className="h-9 w-20 rounded-md" />{" "}
            {/* Button Placeholder */}
          </div>
        </div>

        {/* Metadata or Tabs Skeleton */}
        <div className="flex space-x-4 border-b pb-2">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
        </div>

        {/* Main Content Area Skeleton */}
        <div className="space-y-4">
          {/* Simulate a table or list header */}
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-1/4 rounded-md" />
            <Skeleton className="h-5 w-1/6 rounded-md" />
            <Skeleton className="h-5 w-1/6 rounded-md" />
          </div>
          {/* Simulate rows of data */}
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="flex justify-between items-center space-x-4"
            >
              <Skeleton className="h-5 w-1/4 rounded-md" />
              <Skeleton className="h-5 w-1/6 rounded-md" />
              <Skeleton className="h-5 w-1/6 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
