import CreatorProcessor from "@/components/feature/creator-processor";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap, ArrowRight } from "lucide-react";

export default function CreatorPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold mb-4">Social Media Content Processor</h1>
              <p className="text-muted-foreground text-lg">
                Extract and process content from TikTok and Instagram profiles
              </p>
              
              {/* Automated Pipeline CTA */}
              <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                <h2 className="text-lg font-semibold text-purple-900 mb-2">
                  🚀 New: Fully Automated Pipeline
                </h2>
                <p className="text-sm text-purple-700 mb-3">
                  Complete end-to-end automation from profile link to fine-tuning ready data
                </p>
                <Link href="/automated-pipeline">
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                    <Zap className="h-4 w-4 mr-2" />
                    Try Automated Pipeline
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
            <CreatorProcessor />
          </div>
        </div>
      </div>
    </div>
  );
} 