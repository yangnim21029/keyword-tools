"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Globe, Languages as LanguagesIcon } from "lucide-react";
import { useState } from "react";
import { CreateNewSerpButton } from "../actions/actions-buttons";
import { LANGUAGES, REGIONS } from "../global-config";

export default function CreateNewSerpForm() {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState(Object.values(REGIONS)[0]);
  const [language, setLanguage] = useState("en");
  const [regionDialogOpen, setRegionDialogOpen] = useState(false);
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false);

  // Helper functions to get display names (optional, could display codes directly)
  const getRegionName = (code: string) =>
    Object.entries(REGIONS).find(([_, c]) => c === code)?.[0] || code;
  const getLanguageName = (code: string) =>
    LANGUAGES[code as keyof typeof LANGUAGES] || code;

  const handleRegionChange = (value: string) => {
    setRegion(value);
    setRegionDialogOpen(false); // Close dialog on selection
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    setLanguageDialogOpen(false); // Close dialog on selection
  };

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-xl px-4">
      <div
        className={cn(
          "w-full bg-white p-3 rounded-2xl border border-gray-300 space-y-3",
          "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 transition-shadow duration-200",
        )}
      >
        <div className="relative w-full flex items-center">
          <Input
            type="text"
            placeholder="Enter your search query for SERP analysis"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 text-lg pl-5 pr-5 w-full border-none ring-offset-0 focus:ring-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 bg-transparent shadow-none"
          />
        </div>

        <div className={cn("flex items-center justify-between pt-2 px-2")}>
          <div className="flex flex-wrap gap-2">
            {/* Region Selection Dialog */}
            <Dialog open={regionDialogOpen} onOpenChange={setRegionDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="rounded-full h-8 px-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-normal"
                >
                  <Globe size={14} className="mr-1.5" />
                  {getRegionName(region)} ({region})
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Select Region</DialogTitle>
                </DialogHeader>
                <Select value={region} onValueChange={handleRegionChange}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a region" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REGIONS).map(([name, code]) => (
                      <SelectItem key={code} value={code}>
                        {name} ({code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DialogContent>
            </Dialog>

            {/* Language Selection Dialog */}
            <Dialog
              open={languageDialogOpen}
              onOpenChange={setLanguageDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="rounded-full h-8 px-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-normal"
                >
                  <LanguagesIcon size={14} className="mr-1.5" />
                  {getLanguageName(language)} ({language})
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Select Language</DialogTitle>
                </DialogHeader>
                <Select value={language} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LANGUAGES).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name} ({code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DialogContent>
            </Dialog>
          </div>

          {/* Submit Button */}
          <div>
            <CreateNewSerpButton
              query={query}
              region={region}
              language={language}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
