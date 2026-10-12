import React from 'react';
import { RecorderScreen } from '../../src/features/recorder/RecorderScreen.tsx';

export default function RecordRoute() {
  return (
    <RecorderScreen
      onRecordingFinished={() => {}}
      onCancel={() => {}}
    />
  );
}
