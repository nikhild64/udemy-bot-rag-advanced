"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { SearchBar } from "@/components/search-bar"
import { AnswerCard } from "@/components/answer-card"
import { LearningTimeline } from "@/components/learning-timeline"
import { StatisticsCard } from "@/components/statistics-card"
import { RetrievedContextPanel } from "@/components/retrieved-context-panel"
import { PipelineProgress } from "@/components/pipeline-progress"
import { ConfidenceBadge } from "@/components/confidence-badge"
import { streamChatQuery, ChatStreamEvent } from "@/lib/api"
import { ChatResponse } from "@/types/api"
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

function ChatExperience() {
  const searchParams = useSearchParams()
  const initialPrompt = searchParams.get("prompt")
  
  const [query, setQuery] = useState(initialPrompt || "")
  const [activeCitation, setActiveCitation] = useState<string | null>(null)
  const [activeStageIndex, setActiveStageIndex] = useState(0)
  
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<ChatResponse | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const hasExecutedRef = useRef(false)

  useEffect(() => {
    if (initialPrompt && !hasExecutedRef.current) {
      hasExecutedRef.current = true
      handleSearch(initialPrompt)
    }
  }, [initialPrompt])

  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery || query.trim()
    if (!q) return

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setIsStreaming(true)
    setError(null)
    setResponse({
      answer: "",
      citations: [],
      retrievedChunks: [],
      metadata: {}
    })
    setActiveCitation(null)
    setActiveStageIndex(0)

    const interval = setInterval(() => {
      setActiveStageIndex(prev => {
        if (prev >= PIPELINE_STAGES.length - 2) { 
          clearInterval(interval)
          return prev
        }
        return prev + 1
      })
    }, 400)

    try {
      await streamChatQuery(
        { query: q }, 
        (event: ChatStreamEvent) => {
          if (event.type === 'start') {
            clearInterval(interval)
            setActiveStageIndex(PIPELINE_STAGES.length - 2)
          } else if (event.type === 'citation') {
            setResponse(prev => {
              if (!prev) return prev;
              const newCitations = [...(prev.citations || []), event.data];
              const newChunks = [...(prev.retrievedChunks || []), { 
                chunkId: event.data.chunkId || String(Math.random()), 
                text: '...', 
                score: event.data.similarityScore || 0,
                metadata: {},
                sourceReference: {
                  courseName: event.data.courseName || '',
                  moduleTitle: event.data.moduleTitle || '',
                  lessonTitle: event.data.lessonTitle || '',
                  transcriptFile: event.data.transcriptFile || '',
                  startTime: event.data.startTime || 0,
                  endTime: event.data.endTime || 0
                },
                citation: event.data 
              }];
              return { ...prev, citations: newCitations, retrievedChunks: newChunks };
            })
          } else if (event.type === 'token') {
            setResponse(prev => prev ? {
              ...prev,
              answer: prev.answer + event.data
            } : null)
          } else if (event.type === 'done') {
            setActiveStageIndex(PIPELINE_STAGES.length)
          } else if (event.type === 'error') {
            setError(event.data.message)
            setActiveStageIndex(PIPELINE_STAGES.length)
          }
        },
        abortController.signal
      )
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'An error occurred')
      }
    } finally {
      setIsStreaming(false)
      clearInterval(interval)
    }
  }

  const getPipelineStages = () => {
    return PIPELINE_STAGES.map((stage, index) => {
      let status: 'pending' | 'active' | 'completed' = 'pending'
      if (isStreaming) {
        if (index < activeStageIndex) status = 'completed'
        else if (index === activeStageIndex) status = 'active'
      } else if (response && !error) {
        status = 'completed'
      } else if (error) {
        if (index < activeStageIndex) status = 'completed'
        else if (index === activeStageIndex) status = 'active' 
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
            Chai Code Expo Mobile Dev Support
          </div>
          {/* Add ThemeToggle if necessary */}
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center">
        {!response && !isStreaming && !error ? (
          // Initial State
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
        ) : (
          // Active/Result State
          <div className="w-full max-w-7xl">
            <div className="max-w-3xl mx-auto mb-8">
              <SearchBar 
                value={query} 
                onChange={setQuery} 
                onSubmit={() => handleSearch()}
                isLoading={isStreaming}
              />
            </div>

            {error && (
              <div className="max-w-3xl mx-auto p-6 rounded-xl border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-4 mb-8">
                <ServerCrash className="w-6 h-6 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-lg">Unable to generate response</h3>
                  <p className="mt-1 opacity-90">{error}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col lg:flex-row gap-8 items-start">
              {/* Left Column: Answer & Context */}
              <div className="w-full lg:w-7/12 xl:w-2/3 flex flex-col gap-6">
                {isStreaming && !response?.answer && !response?.citations?.length && (
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

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse">Loading...</div></div>}>
      <ChatExperience />
    </Suspense>
  )
}
