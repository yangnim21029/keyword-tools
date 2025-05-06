'use client'; // Use client component for potential future interactivity if needed

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'; // Using Shadcn UI for consistency
import { ArrowRight } from 'lucide-react';

export default function DemoIndexPage() {
  const demoLinks = [
    {
      href: '/demo/product-team-function',
      title: 'Product Team Function Demo',
      description: 'Simulates an SEO fitness check with mock data.',
    },
    {
      href: '/demo/paragraph-rephrase',
      title: 'Paragraph Rephrase Demo',
      description: 'Demonstrates AI-powered paragraph analysis and rephrasing.',
    },
    // Add more demo links here as needed
  ];

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Demo Pages</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {demoLinks.map((link) => (
          <Link href={link.href} key={link.href} className="block hover:shadow-lg transition-shadow rounded-lg">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  {link.title}
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  {link.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
