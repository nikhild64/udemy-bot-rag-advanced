'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-border rounded-2xl bg-card/40 backdrop-blur-xs animate-in fade-in duration-300">
      <div className="p-4 rounded-2xl bg-primary/10 text-primary mb-4 ring-1 ring-primary/20">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="inline-flex items-center px-4 py-2 text-sm font-semibold transition active:scale-95 shadow-xs"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
