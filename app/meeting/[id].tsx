import React, { useEffect, useState } from 'react';
import { MeetingDetailScreen } from '../../src/features/meetings/MeetingDetailScreen.tsx';
import { SQLiteService } from '../../src/services/database/sqliteService.ts';
import { MeetingRecord } from '../../src/services/types/database.ts';

export default function MeetingDetailRoute({ id, onBack }: { id?: string; onBack?: () => void }) {
  const [meeting, setMeeting] = useState<MeetingRecord | null>(null);

  useEffect(() => {
    if (id) {
      const db = SQLiteService.getInstance();
      db.meetingRepository.getById(id).then(setMeeting);
    }
  }, [id]);

  if (!meeting) return null;

  return <MeetingDetailScreen meeting={meeting} onBack={onBack || (() => {})} />;
}
