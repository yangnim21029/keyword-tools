import { MEDIASITE_DATA } from "@/app/global-config";
import { SiteFavicon } from "@/components/ui/site-favicon";

export default function MatchingSiteBar({ region }: { region: string }) {
  // --- Find Matching Media Sites (Case-insensitive Region) ---
  const matchingSites = region
    ? MEDIASITE_DATA.filter(
        (site) => site.region?.toLowerCase() === region?.toLowerCase(),
      )
    : [];
  return (
    <div>
      {matchingSites.length > 0 && (
        <div className="flex items-center gap-1.5 p-1 rounded-md bg-muted/60">
          {matchingSites.map((site) => (
            <SiteFavicon
              key={site.name}
              siteName={site.name}
              siteUrl={site.url}
            />
          ))}
        </div>
      )}
    </div>
  );
}
