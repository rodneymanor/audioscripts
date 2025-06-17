import CreatorProcessor from "@/components/feature/creator-processor";

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
            </div>
            <CreatorProcessor />
          </div>
        </div>
      </div>
    </div>
  );
} 