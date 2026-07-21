"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { SearchBar } from "@/components/search-bar"
import { GraduationCap, Smartphone } from "lucide-react"

export default function Home() {
  const [query, setQuery] = useState("")
  const router = useRouter()
  const { isSignedIn, isLoaded } = useAuth()

  const handleSearch = (overrideQuery?: string) => {
    const q = overrideQuery || query.trim()
    if (!q || !isLoaded) return

    const chatUrl = `/chat?prompt=${encodeURIComponent(q)}`

    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(chatUrl)}`)
    } else {
      router.push(chatUrl)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            Chai Code Expo Mobile Dev Support
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center">
        {/* Initial State */}
        <div className="w-full max-w-2xl mt-20 flex flex-col items-center justify-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Ask anything about the Chai Code Expo Mobile Dev Course.</h1>
            <p className="text-muted-foreground text-lg">Get instant, verified answers based on course lectures and materials.</p>
          </div>
          
          <div className="w-full">
            <SearchBar 
              value={query} 
              onChange={setQuery} 
              onSubmit={handleSearch}
            />
          </div>

          <div className="flex flex-wrap justify-center gap-3 w-full mt-8">
            {[
              "How does Expo Router work?",
              "What are the limitations of Expo Go?",
              "How do I use expo-camera?",
              "Setting up push notifications in Expo",
              "How to cook a perfect steak?"
            ].map(example => (
              <button
                key={example}
                className="px-4 py-2.5 rounded-full border border-muted bg-card/50 text-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setQuery(example)
                  handleSearch(example)
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
