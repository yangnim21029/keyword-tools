"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AnalyzeParagraphsButton,
  RephraseButton,
} from "@/app/actions/actions-buttons";
import { Plus, Trash2 } from "lucide-react";

export default function ParagraphRephrasePage() {
  const [aSections, setASections] = useState<string[]>([""]);
  const [bSection, setBSection] = useState("");
  const [step1Result, setStep1Result] = useState("");
  const [step2Result, setStep2Result] = useState("");

  const addASection = () => {
    setASections([...aSections, ""]);
  };

  const removeASection = (index: number) => {
    setASections(aSections.filter((_, i) => i !== index));
  };

  const updateASection = (index: number, value: string) => {
    const newSections = [...aSections];
    newSections[index] = value;
    setASections(newSections);
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold mb-8">Paragraph Rephrase</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Input Sections</CardTitle>
            <CardDescription>
              Enter reference paragraphs and target paragraph
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              {aSections.map((section, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">
                      Reference Section {index + 1}
                    </label>
                    {index > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeASection(index)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Textarea
                    value={section}
                    onChange={(e) => updateASection(index, e.target.value)}
                    placeholder="Enter reference paragraph..."
                    className="min-h-[200px]"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addASection}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Reference Section
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Target Section</label>
              <Textarea
                value={bSection}
                onChange={(e) => setBSection(e.target.value)}
                placeholder="Enter target paragraph..."
                className="min-h-[200px]"
              />
            </div>

            <div className="flex gap-4">
              <AnalyzeParagraphsButton
                aSections={aSections}
                bSection={bSection}
                onResult={setStep1Result}
              />
              <RephraseButton
                step1Result={step1Result}
                aSections={aSections}
                bSection={bSection}
                onResult={setStep2Result}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          {step1Result && (
            <Card>
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
                <CardDescription>
                  Graph knowledge visualization and differences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap">{step1Result}</div>
              </CardContent>
            </Card>
          )}

          {step2Result && (
            <Card>
              <CardHeader>
                <CardTitle>Rephrased Content</CardTitle>
                <CardDescription>
                  Target section rephrased based on reference sections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap">{step2Result}</div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
