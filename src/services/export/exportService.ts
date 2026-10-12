import { MeetingRecord, ActionItemRecord, DecisionRecord, ParticipantRecord, MeetingArtifactRecord } from '../types/database.ts';
import { TranscriptSegment } from '../types/stt.ts';
import { MOMStructuredOutput } from '../types/llm.ts';
import { SQLiteService } from '../database/sqliteService.ts';
import { formatDuration, formatDate, formatTimestamp } from '../../utils/formatters.ts';

export class ExportService {
  /**
   * Generates formatted Markdown Minutes of Meeting document
   */
  public static generateMarkdown(
    meeting: MeetingRecord,
    mom: MOMStructuredOutput,
    segments: TranscriptSegment[],
    actions: ActionItemRecord[],
    decisions: DecisionRecord[],
    participants: ParticipantRecord[]
  ): string {
    const lines: string[] = [];

    lines.push(`# ${mom.meetingTitle || meeting.title}`);
    lines.push(`**Date:** ${formatDate(meeting.recordedAt)} | **Duration:** ${formatDuration(meeting.durationSeconds)} | **Status:** ${meeting.approvalStatus.toUpperCase()}`);
    lines.push('');

    // Participants
    if (participants.length > 0) {
      lines.push('## Attendees');
      participants.forEach((p) => {
        lines.push(`- **${p.name}** ${p.role ? `(${p.role})` : ''} ${p.email ? `<${p.email}>` : ''}`);
      });
      lines.push('');
    }

    // Executive Summary
    lines.push('## Executive Summary');
    lines.push(mom.executiveSummary);
    lines.push('');

    // Agenda & Discussion Topics
    if (mom.agendaTopics && mom.agendaTopics.length > 0) {
      lines.push('## Agenda & Topics');
      mom.agendaTopics.forEach((t) => lines.push(`- ${t}`));
      lines.push('');
    }

    // Key Decisions
    lines.push('## Key Decisions');
    if (decisions.length > 0) {
      decisions.forEach((d, i) => {
        lines.push(`${i + 1}. **${d.title}** (Consensus: *${d.consensusLevel || 'agreed'}*)`);
        if (d.rationale) lines.push(`   *Rationale:* ${d.rationale}`);
      });
    } else {
      lines.push('*No formal decisions recorded.*');
    }
    lines.push('');

    // Action Items
    lines.push('## Action Items & Deliverables');
    if (actions.length > 0) {
      lines.push('| Status | Task | Owner | Due Date | Priority |');
      lines.push('|---|---|---|---|---|');
      actions.forEach((a) => {
        const check = a.status === 'completed' ? '[x]' : '[ ]';
        lines.push(`| ${check} | ${a.title} | ${a.owner || 'Unassigned'} | ${a.dueDate || 'TBD'} | ${a.priority.toUpperCase()} |`);
      });
    } else {
      lines.push('*No action items assigned.*');
    }
    lines.push('');

    // Risks & Next Steps
    if (mom.risksAndBlockers && mom.risksAndBlockers.length > 0) {
      lines.push('## Risks & Blockers');
      mom.risksAndBlockers.forEach((r) => {
        lines.push(`- **${r.title}** (Severity: ${r.severity})`);
        if (r.mitigation) lines.push(`  *Mitigation:* ${r.mitigation}`);
      });
      lines.push('');
    }

    if (mom.nextSteps && mom.nextSteps.length > 0) {
      lines.push('## Next Steps');
      mom.nextSteps.forEach((s) => lines.push(`- ${s}`));
      lines.push('');
    }

    // Appendix: Timestamped Transcript
    lines.push('---');
    lines.push('## Appendix: Timestamped Transcript');
    segments.forEach((seg) => {
      lines.push(`- **[${formatTimestamp(seg.startMs)} - ${formatTimestamp(seg.endMs)}]** *${seg.speakerId || 'Speaker'}:* ${seg.text}`);
    });
    lines.push('');
    lines.push('*Generated offline by AID3 — 100% Air-gapped privacy.*');

    return lines.join('\n');
  }

  /**
   * Generates machine-readable JSON export
   */
  public static generateJson(
    meeting: MeetingRecord,
    mom: MOMStructuredOutput,
    segments: TranscriptSegment[],
    actions: ActionItemRecord[],
    decisions: DecisionRecord[],
    participants: ParticipantRecord[]
  ): string {
    const data = {
      metadata: {
        id: meeting.id,
        title: meeting.title,
        recordedAt: meeting.recordedAt,
        durationSeconds: meeting.durationSeconds,
        approvalStatus: meeting.approvalStatus,
        exportedAt: new Date().toISOString(),
        offlineGuarantee: true,
      },
      participants,
      minutesOfMeeting: mom,
      actionItems: actions,
      decisions,
      transcriptSegments: segments,
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Generates printable HTML for PDF generation
   */
  public static generatePrintableHtml(
    meeting: MeetingRecord,
    mom: MOMStructuredOutput,
    actions: ActionItemRecord[],
    decisions: DecisionRecord[],
    participants: ParticipantRecord[]
  ): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${mom.meetingTitle || meeting.title} - Minutes</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
    h1 { color: #ea580c; border-bottom: 2px solid #fdba74; padding-bottom: 8px; margin-bottom: 4px; font-size: 24px; }
    h2 { color: #0f172a; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-weight: 600; }
    td { border: 1px solid #cbd5e1; padding: 8px 12px; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .tag-urgent { background: #fee2e2; color: #dc2626; }
    .tag-high { background: #fef3c7; color: #d97706; }
    .tag-agreed { background: #dcfce7; color: #16a34a; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <h1>${mom.meetingTitle || meeting.title}</h1>
  <div class="meta">
    Recorded on ${formatDate(meeting.recordedAt)} &bull; Duration: ${formatDuration(meeting.durationSeconds)} &bull; Status: ${meeting.approvalStatus.toUpperCase()}
  </div>

  <h2>Executive Summary</h2>
  <p>${mom.executiveSummary}</p>

  <h2>Key Decisions</h2>
  ${decisions.map((d) => `<div><strong>&bull; ${d.title}</strong> <span class="tag tag-agreed">${d.consensusLevel || 'Agreed'}</span><p style="margin:2px 0 8px 16px; font-size:13px; color:#475569">${d.rationale || ''}</p></div>`).join('')}

  <h2>Action Items</h2>
  <table>
    <thead><tr><th>Task</th><th>Owner</th><th>Due Date</th><th>Priority</th></tr></thead>
    <tbody>
      ${actions.map((a) => `<tr><td><strong>${a.title}</strong></td><td>${a.owner || 'Unassigned'}</td><td>${a.dueDate || 'TBD'}</td><td><span class="tag tag-${a.priority}">${a.priority.toUpperCase()}</span></td></tr>`).join('')}
    </tbody>
  </table>

  <div class="footer">
    Generated offline by AID3 &bull; On-device private processing
  </div>
</body>
</html>`;
  }

  /**
   * Triggers browser / device file download and saves to SQLite meeting_artifacts
   */
  public static async exportAndDownload(
    meetingId: string,
    filename: string,
    content: string,
    type: 'mom_markdown' | 'mom_json' | 'mom_pdf' | 'mom_docx',
    mimeType: string
  ): Promise<MeetingArtifactRecord> {
    // 1. Save artifact to SQLite
    const db = SQLiteService.getInstance();
    const artifact = await db.meetingArtifactRepository.saveArtifact(meetingId, type, content);

    // 2. Trigger instant local download
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    return artifact;
  }
}
