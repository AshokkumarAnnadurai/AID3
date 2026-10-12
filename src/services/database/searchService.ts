import { SQLiteService } from './sqliteService.ts';
import { MeetingRecord, ActionItemRecord, DecisionRecord } from '../types/database.ts';
import { TranscriptSegment } from '../types/stt.ts';

export interface SearchResultItem {
  id: string;
  type: 'meeting' | 'transcript' | 'action_item' | 'decision';
  meetingId: string;
  meetingTitle: string;
  matchedText: string;
  subText?: string;
  timestampMs?: number;
  score: number;
}

export class SearchService {
  /**
   * Fast offline full-text search across meetings, transcripts, action items, and decisions
   */
  public static async searchAll(query: string): Promise<SearchResultItem[]> {
    if (!query || query.trim().length === 0) return [];

    const db = SQLiteService.getInstance();
    const q = query.trim().toLowerCase();
    const results: SearchResultItem[] = [];

    // 1. Search Meetings
    const allMeetings = await db.meetingRepository.getAll();
    const meetingMap = new Map<string, MeetingRecord>();
    allMeetings.forEach((m) => meetingMap.set(m.id, m));

    allMeetings.forEach((m) => {
      let score = 0;
      if (m.title.toLowerCase().includes(q)) score += 10;
      if (m.description && m.description.toLowerCase().includes(q)) score += 5;

      if (score > 0) {
        results.push({
          id: `sr_mtg_${m.id}`,
          type: 'meeting',
          meetingId: m.id,
          meetingTitle: m.title,
          matchedText: m.title,
          subText: m.description || `Meeting recorded on ${new Date(m.recordedAt).toLocaleDateString()}`,
          score,
        });
      }
    });

    // 2. Search Transcript Segments
    for (const m of allMeetings) {
      const segs = await db.transcriptRepository.getByMeetingId(m.id);
      segs.forEach((seg) => {
        if (seg.text.toLowerCase().includes(q)) {
          results.push({
            id: `sr_seg_${seg.id}`,
            type: 'transcript',
            meetingId: m.id,
            meetingTitle: m.title,
            matchedText: seg.text,
            subText: `Timestamp [${Math.floor(seg.startMs / 1000)}s - ${Math.floor(seg.endMs / 1000)}s]`,
            timestampMs: seg.startMs,
            score: 7,
          });
        }
      });
    }

    // 3. Search Action Items
    const actions = await db.actionItemRepository.getAll();
    actions.forEach((act) => {
      let score = 0;
      if (act.title.toLowerCase().includes(q)) score += 8;
      if (act.owner && act.owner.toLowerCase().includes(q)) score += 6;
      if (act.description && act.description.toLowerCase().includes(q)) score += 4;

      if (score > 0) {
        const m = meetingMap.get(act.meetingId);
        results.push({
          id: `sr_act_${act.id}`,
          type: 'action_item',
          meetingId: act.meetingId,
          meetingTitle: m ? m.title : 'Meeting',
          matchedText: act.title,
          subText: `Owner: ${act.owner || 'Unassigned'} • Priority: ${act.priority.toUpperCase()} • Status: ${act.status}`,
          score,
        });
      }
    });

    // 4. Search Decisions
    for (const m of allMeetings) {
      const decs = await db.decisionRepository.getByMeetingId(m.id);
      decs.forEach((dec) => {
        let score = 0;
        if (dec.title.toLowerCase().includes(q)) score += 8;
        if (dec.rationale && dec.rationale.toLowerCase().includes(q)) score += 5;

        if (score > 0) {
          results.push({
            id: `sr_dec_${dec.id}`,
            type: 'decision',
            meetingId: m.id,
            meetingTitle: m.title,
            matchedText: dec.title,
            subText: `Consensus: ${dec.consensusLevel || 'agreed'} • ${dec.rationale || ''}`,
            score,
          });
        }
      });
    }

    // Sort by relevance score descending
    return results.sort((a, b) => b.score - a.score);
  }
}
