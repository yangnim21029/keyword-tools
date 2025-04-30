"use server";

import React, { useState, useTransition } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateQuestionsFromReference } from './use-scrape-ai'; // Import the server action
import { Loader2 } from 'lucide-react';
import { getOnPageResultList, getTotalOnPageResultCount } from '../services/firebase/data-onpage-result';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Info, Link2 } from 'lucide-react';
import CreateNewScrapeForm from './create-new-scrape-form';

export default async function ScrapeResultListPage() {
    const totalScrapedCount = await getTotalOnPageResultCount();
    const scrapeResultList = await getOnPageResultList();

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
            <h1 className="text-2xl font-bold mb-6">On-Page Scrape History</h1>

            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Total Scrapes</AlertTitle>
                <AlertDescription>
                    You have scraped a total of{' '}
                    <strong>{totalScrapedCount.toLocaleString()}</strong> pages.
                </AlertDescription>
            </Alert>

            <div className="max-w-md">
                <CreateNewScrapeForm />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Scrape Records</CardTitle>
                    <CardDescription>
                        List of previously scraped web pages.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>URL</TableHead>
                                <TableHead className="text-right">Scraped At</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {scrapeResultList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        No scrape records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                scrapeResultList.map(scrape => (
                                    <TableRow key={scrape.id}>
                                        <TableCell className="font-medium">
                                            <Link
                                                href={`/on-page-result/${scrape.id}`}
                                                className="hover:underline text-blue-600"
                                            >
                                                {scrape.title || scrape.url || 'N/A'}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <a
                                                href={scrape.url || '#'}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-gray-500 hover:text-blue-600 inline-flex items-center"
                                                title={scrape.url || 'Invalid URL'}
                                            >
                                                <Link2 className="h-3 w-3 mr-1 flex-shrink-0" />
                                                <span className="truncate max-w-[300px] md:max-w-[400px]">
                                                    {scrape.url ? scrape.url.replace(/^https?:\/\//, '') : 'N/A'}
                                                </span>
                                            </a>
                                        </TableCell>
                                        <TableCell className="text-right text-sm text-gray-500">
                                            {scrape.timestamp &&
                                                typeof scrape.timestamp.toDate === 'function'
                                                ? scrape.timestamp.toDate().toLocaleDateString()
                                                : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        {scrapeResultList.length > 0 && (
                            <TableCaption>A list of your recent page scrapes.</TableCaption>
                        )}
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
