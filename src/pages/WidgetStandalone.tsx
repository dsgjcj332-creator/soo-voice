import React from 'react';
import { VoiceWidget } from '../components/widget/VoiceWidget';

export function WidgetStandalone() {
  return (
    <div className="w-screen h-screen bg-transparent select-none overflow-hidden relative">
      <VoiceWidget />
    </div>
  );
}
