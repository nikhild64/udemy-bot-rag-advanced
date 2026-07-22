"use client"

import { AppLayout } from "@/shared/components/layout/AppLayout";
import { ChatContainer } from "@/features/chat/components/ChatContainer";

export default function Home() {
  return (
    <AppLayout>
      <ChatContainer />
    </AppLayout>
  );
}
