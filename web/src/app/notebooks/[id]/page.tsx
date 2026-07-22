"use client"

import { useEffect, use } from "react";
import { AppLayout } from "@/shared/components/layout/AppLayout";
import { ChatContainer } from "@/features/chat/components/ChatContainer";
import { useUIStore } from "@/shared/lib/store";

export default function NotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const setActiveNotebookId = useUIStore((s) => s.setActiveNotebookId);

  useEffect(() => {
    if (id) {
      setActiveNotebookId(id);
    }
  }, [id, setActiveNotebookId]);

  return (
    <AppLayout>
      <ChatContainer />
    </AppLayout>
  );
}
