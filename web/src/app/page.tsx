"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { SearchBar } from "@/components/search-bar"
import { AnswerCard } from "@/components/answer-card"
import { LearningTimeline } from "@/components/learning-timeline"
import { StatisticsCard } from "@/components/statistics-card"
import { RetrievedContextPanel } from "@/components/retrieved-context-panel"
import { PipelineProgress } from "@/components/pipeline-progress"
import { ConfidenceBadge } from "@/components/confidence-badge"
import { submitChatQuery } from "@/lib/api"
import { GraduationCap, Smartphone, ServerCrash } from "lucide-react"

const PIPELINE_STAGES = [
  { id: 'guardrails-in', label: 'Input Guardrails' },
  { id: 'query', label: 'Query Transformation' },
  { id: 'embed', label: 'Embedding' },
  { id: 'retrieve', label: 'Retrieval' },
  { id: 'rerank', label: 'Reranking' },
  { id: 'prompt', label: 'Prompt Generation' },
  { id: 'generate', label: 'AI Response' },
  { id: 'guardrails-out', label: 'Output Guardrails' },
]

export default function Home() {
  const [query, setQuery] = useState("")
  const [activeCitation, setActiveCitation] = useState<string | null>(null)
  const [activeStageIndex, setActiveStageIndex] = useState(0)

  const chatMutation = useMutation({
    mutationFn: (q: string) => submitChatQuery({ query: q }),
    onMutate: () => {
      setActiveCitation(null)
      // Simulate pipeline progress for UI UX since actual streaming isn't in Phase 18
      setActiveStageIndex(0)
      const interval = setInterval(() => {
        setActiveStageIndex(prev => {
          if (prev >= PIPELINE_STAGES.length - 1) {
            clearInterval(interval)
            return prev
          }
          return prev + 1
        })
      }, 400) // Advance a stage every 400ms for demo
      return { interval }
    },
    onSettled: (data, error, variables, context) => {
      if (context?.interval) {
        clearInterval(context.interval)
      }
      setActiveStageIndex(PIPELINE_STAGES.length)
    }
  })

  const handleSearch = () => {
    if (!query.trim()) return
    chatMutation.mutate(query.trim())
  }

  const response = chatMutation.data

  const getPipelineStages = () => {
    return PIPELINE_STAGES.map((stage, index) => {
      let status: 'pending' | 'active' | 'completed' = 'pending'
      if (chatMutation.isPending) {
        if (index < activeStageIndex) status = 'completed'
        else if (index === activeStageIndex) status = 'active'
      } else if (chatMutation.isSuccess) {
        status = 'completed'
      } else if (chatMutation.isError) {
        if (index < activeStageIndex) status = 'completed'
        else if (index === activeStageIndex) status = 'active' // stalled
      }
      return { ...stage, status }
    })
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
            Chai Code Mobile Dev Support
          </div>
          {/* Add ThemeToggle if necessary */}
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center">
        {!chatMutation.data && !chatMutation.isPending && !chatMutation.isError ? (
          // Initial State
          <div className="w-full max-w-2xl mt-20 flex flex-col items-center justify-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Ask anything about the Chai Code Mobile Dev Course.</h1>
              <p className="text-muted-foreground text-lg">Get instant, verified answers based on course lectures and materials.</p>
            </div>
            
            <div className="w-full">
              <SearchBar 
                value={query} 
                onChange={setQuery} 
                onSubmit={handleSearch}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-8">
              {[
                "How do I manage state in React Native?",
                "What's the difference between Flutter and React Native?",
                "Explain the iOS App Lifecycle.",
                "How to handle permissions in Android?"
              ].map(example => (
                <button
                  key={example}
                  className="px-4 py-3 rounded-lg border border-muted bg-card/50 text-sm text-left hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setQuery(example)
                    chatMutation.mutate(example)
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Active/Result State
          <div className="w-full max-w-7xl">
            <div className="max-w-3xl mx-auto mb-8">
              <SearchBar 
                value={query} 
                onChange={setQuery} 
                onSubmit={handleSearch}
                isLoading={chatMutation.isPending}
              />
            </div>

            {chatMutation.isError && (
              <div className="max-w-3xl mx-auto p-6 rounded-xl border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-4 mb-8">
                <ServerCrash className="w-6 h-6 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-lg">Unable to generate response</h3>
                  <p className="mt-1 opacity-90">{chatMutation.error.message}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Left Column: Answer & Context */}
              <div className="w-full lg:w-7/12 xl:w-2/3 flex flex-col gap-6">
                {chatMutation.isPending && !chatMutation.data && (
                  <div className="border rounded-xl bg-card shadow-sm p-4">
                    <PipelineProgress stages={getPipelineStages()} />
                  </div>
                )}
                
                {response && (
                  <>
                    {(() => {
                      const noAnswerFound = response.answer.includes("I couldn't find this information") || response.answer.includes("I do not have sufficient information")
                      
                      return (
                        <>
                          <div className="flex items-center justify-between px-2">
                            {!noAnswerFound && (
                              <ConfidenceBadge score={(response.metadata as Record<string, unknown>)?.highestScore as number || 0.9} />
                            )}
                          </div>
                          
                          <AnswerCard 
                            content={response.answer}
                            activeCitation={activeCitation}
                            onCitationClick={setActiveCitation}
                          />
                          
                          {!noAnswerFound && (
                            <>
                              <StatisticsCard 
                                totalResults={response.retrievedChunks?.length}
                                elapsedTime={response.metadata?.elapsedTime}
                                uniqueSources={new Set(response.citations?.map((c) => c.lessonId)).size}
                                highestScore={(response.metadata as Record<string, unknown>)?.highestScore as number || 0.93}
                              />

                              {response.retrievedChunks && (
                                <RetrievedContextPanel chunks={response.retrievedChunks} />
                              )}
                            </>
                          )}
                        </>
                      )
                    })()}
                  </>
                )}
              </div>

              {/* Right Column: Learning Timeline */}
              <div className="w-full lg:w-5/12 xl:w-1/3 lg:sticky lg:top-24 h-auto lg:h-[calc(100vh-8rem)] overflow-y-auto pb-8 scrollbar-thin">
                {response?.retrievedChunks && !response.answer.includes("I couldn't find this information") && !response.answer.includes("I do not have sufficient information") && (
                  <LearningTimeline 
                    chunks={response.retrievedChunks}
                    activeCitation={activeCitation}
                    onCitationClick={setActiveCitation}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
