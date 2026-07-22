"use client"

import { useUIStore } from '@/shared/lib/store';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sliders, Cpu, Moon, Sun, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function SettingsModal() {
  const isOpen = useUIStore((s) => s.settingsModalOpen);
  const setOpen = useUIStore((s) => s.setSettingsModalOpen);

  const [topK, setTopK] = useState(5);
  const [model, setModel] = useState('gemini-2.5-flash');

  const handleSave = () => {
    toast.success('Settings saved');
    setOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-primary" />
          <span>Notebook Settings</span>
        </DialogTitle>
        <DialogDescription>
          Configure AI retrieval, LLM model defaults, and workspace behavior.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 my-2 text-sm">
        <div className="space-y-1.5">
          <label className="font-medium text-foreground flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-primary" />
            <span>AI Model</span>
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast & Recommended)</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning)</option>
            <option value="gpt-4o">GPT-4o (High Precision)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="font-medium text-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Retrieval Top-K Chunks ({topK})</span>
          </label>
          <input
            type="range"
            min={1}
            max={20}
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            className="w-full accent-primary"
          />
          <p className="text-[11px] text-muted-foreground">
            Number of context chunks retrieved per question for synthesis.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button onClick={handleSave}>Save Preferences</Button>
      </DialogFooter>
    </Dialog>
  );
}
