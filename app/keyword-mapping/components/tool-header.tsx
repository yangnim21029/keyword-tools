import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';

interface ToolHeaderProps {
  title: string;
  description: string;
  region?: string;
  language?: string;
  icon?: React.ReactNode;
  showBackButton?: boolean;
}

export function ToolHeader({
  title,
  description,
  region,
  language,
  icon,
  showBackButton = true
}: ToolHeaderProps) {
  return (
    <Card className="mb-4 sm:mb-6">
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex items-start gap-4 mb-4">
          {showBackButton && (
            <Link href="/keyword-mapping" className="mt-1">
              <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0" />
            </Link>
          )}
          <div className="flex-grow">
            <div className="flex items-center gap-2 mb-1">
              {icon}
              <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
            </div>
            {(description || region || language) && (
              <div>
                {description && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {region && <Badge variant="outline">地區: {region}</Badge>}
                  {language && (
                    <Badge variant="outline">語言: {language}</Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
