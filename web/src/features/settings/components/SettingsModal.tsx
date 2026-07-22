'use client';

import React, { useState, useEffect } from 'react';
import { X, Settings, Moon, Sun, Globe, Clock, Check } from 'lucide-react';
import { useTranslation } from '@/shared/lib/i18n-context';
import { SupportedLanguage } from '@/shared/lib/i18n';
import { apiClient } from '@/shared/api/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { language, setLanguage, t } = useTranslation();
  const [theme, setTheme] = useState<'system' | 'dark' | 'light'>('system');
  const [timezone, setTimezone] = useState('UTC');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      apiClient.get<any>('/api/user/preferences')
        .then((pref) => {
          if (pref) {
            if (pref.theme) setTheme(pref.theme);
            if (pref.timezone) setTimezone(pref.timezone);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiClient.put('/api/user/preferences', {
        theme,
        language,
        timezone,
      });
      toast.success('Settings saved successfully');
      onClose();
    } catch (e) {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-label="User Settings"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{t('settings.title', 'User Preferences')}</h3>
              <p className="text-xs text-muted-foreground">Customize theme, language, and notification alerts</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Theme selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Moon className="h-4 w-4 text-primary" /> {t('settings.theme', 'Appearance Theme')}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['system', 'dark', 'light'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTheme(mode)}
                  className={`p-3 rounded-xl border text-xs font-medium capitalize flex items-center justify-center space-x-2 transition ${
                    theme === mode
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  {mode === 'dark' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                  <span>{mode}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Language selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-primary" /> {t('settings.language', 'Application Language')}
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="en">English (US)</option>
              <option value="es">Español (Spanish)</option>
              <option value="fr">Français (French)</option>
            </select>
          </div>

          {/* Timezone selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" /> {t('settings.timezone', 'Timezone')}
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="America/New_York">America/New_York (EST)</option>
              <option value="Europe/London">Europe/London (GMT)</option>
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-border flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2 text-xs font-semibold shadow-xs flex items-center space-x-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Save Settings</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
