"use client";

import React, { useState } from "react";
import { GenerateGraphFromTextButton } from "../actions/actions-buttons";
import { Textarea } from "../../components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

export default function GraphPage() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");

  return (
    <div className="container mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Text to Graph Generator</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Input Text</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter your text here..."
              className="min-h-[300px] mb-4"
            />
            <GenerateGraphFromTextButton
              inputText={inputText}
              onResult={setOutputText}
              className="w-full"
            />
          </CardContent>
        </Card>

        {/* Output Section */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Graph</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="min-h-[300px] p-4 bg-muted rounded-md whitespace-pre-wrap">
              {outputText || "Generated graph will appear here..."}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
