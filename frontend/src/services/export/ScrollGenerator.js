import db, { AppState } from '../db/db';

/**
 * ScrollGenerator — compiles the entire journey into a self-contained, exportable HTML document.
 * All images are embedded as base64 data URIs. No external dependencies required.
 */
export class ScrollGenerator {
  /**
   * Generates the full HTML document string.
   * @param {Object} options - { includePhotos, includeAiComments, includeStats, dateRange }
   * @returns {string} Full HTML document
   */
  static async generate(options = {}) {
    const {
      includePhotos = true,
      includeAiComments = true,
      includeStats = true,
      dateFrom = null,
      dateTo = null,
    } = options;

    // Gather all data
    const [profile, journalEntries, gazeSessions, mandates, photos] = await Promise.all([
      AppState.getAll(),
      db.journal_entries.orderBy('createdAt').toArray(),
      db.gaze_sessions.orderBy('createdAt').toArray(),
      db.mandates.orderBy('createdAt').toArray(),
      includePhotos ? db.photos.toArray() : Promise.resolve([]),
    ]);

    // Filter by date range if provided
    const filterDate = (items) => {
      if (!dateFrom && !dateTo) return items;
      return items.filter(item => {
        const d = new Date(item.createdAt);
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo)) return false;
        return true;
      });
    };

    const filteredJournal = filterDate(journalEntries);
    const filteredGaze = filterDate(gazeSessions);
    const filteredMandates = filterDate(mandates);

    const subjectName = profile.submissiveName || 'Subject';
    const tier = profile.possessionLevel ? JSON.parse(profile.possessionLevel || '{}').name || 'Toy' : 'Toy';
    const lockStart = profile.lockStartDate ? new Date(profile.lockStartDate) : new Date();
    const daysLocked = Math.floor((new Date() - lockStart) / (1000 * 60 * 60 * 24));
    const completedMandates = mandates.filter(m => m.status === 'completed').length;
    const passedGaze = gazeSessions.filter(g => g.result === 'passed').length;
    const integrityFactor = mandates.length > 0
      ? ((completedMandates / mandates.length * 0.6) + (gazeSessions.length > 0 ? passedGaze / gazeSessions.length * 0.4 : 0.4)).toFixed(2)
      : '1.00';

    // Build photo lookup
    const photosByJournal = {};
    photos.forEach(p => {
      if (p.journalEntryId) {
        if (!photosByJournal[p.journalEntryId]) photosByJournal[p.journalEntryId] = [];
        photosByJournal[p.journalEntryId].push(p.dataUrl);
      }
    });

    const gazePhotos = {};
    photos.forEach(p => {
      if (p.gazeSessionId) gazePhotos[p.gazeSessionId] = p.dataUrl;
    });

    // MOOD color map
    const MOOD_COLORS = {
      Obedient: '#22c55e', Struggling: '#eab308', Craving: '#ec4899',
      Broken: '#ef4444', Grateful: '#3b82f6', Defiant: '#f97316', Neutral: '#6b7280',
    };

    const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit'
    });

    // Build journal entry HTML blocks
    const journalBlocks = filteredJournal.map(entry => {
      const moodColor = MOOD_COLORS[entry.mood] || '#6b7280';
      const entryPhotos = (photosByJournal[entry.id] || []);
      const photoHtml = includePhotos && entryPhotos.length > 0
        ? `<div class="photo-grid">${entryPhotos.map(src => `<img src="${src}" class="entry-photo" alt="Journal photo" />`).join('')}</div>`
        : '';
      const aiHtml = includeAiComments && entry.aiComment
        ? `<div class="ai-comment"><span class="ai-label">⚡ ARCHITECT'S NOTE</span><p>${entry.aiComment}</p></div>`
        : '';

      return `
        <div class="entry-card">
          <div class="entry-header">
            <span class="mood-tag" style="background: ${moodColor}22; color: ${moodColor}; border: 1px solid ${moodColor}44;">${entry.mood}</span>
            <span class="entry-date">${formatDate(entry.createdAt)} · ${formatTime(entry.createdAt)}</span>
          </div>
          <div class="entry-body">${entry.text.replace(/\n/g, '<br/>')}</div>
          ${photoHtml}
          ${aiHtml}
        </div>`;
    }).join('\n');

    // Build gaze sessions blocks
    const gazeBlocks = filteredGaze.map(session => {
      const photoHtml = includePhotos && gazePhotos[session.id]
        ? `<img src="${gazePhotos[session.id]}" class="gaze-photo" alt="Inspection" />`
        : '';
      const resultColor = session.result === 'passed' ? '#22c55e' : '#ef4444';
      return `
        <div class="gaze-card" style="border-color: ${resultColor}22;">
          <div class="gaze-header">
            <span class="gaze-verdict" style="background: ${resultColor}22; color: ${resultColor};">${session.result === 'passed' ? '✓ PASSED' : '✗ FAILED'}</span>
            <span class="gaze-tier">[${session.tierAtTime || '—'}]</span>
            <span class="entry-date">${formatDate(session.createdAt)} · ${formatTime(session.createdAt)}</span>
          </div>
          ${photoHtml}
          ${session.aiComment ? `<p class="gaze-comment">${session.aiComment}</p>` : ''}
        </div>`;
    }).join('\n');

    // Stats block
    const statsHtml = includeStats ? `
      <section class="stats-grid">
        <div class="stat-card"><div class="stat-value">${daysLocked}</div><div class="stat-label">Days Under Lock</div></div>
        <div class="stat-card"><div class="stat-value">${filteredJournal.length}</div><div class="stat-label">Journal Entries</div></div>
        <div class="stat-card"><div class="stat-value">${completedMandates}/${mandates.length}</div><div class="stat-label">Mandates Completed</div></div>
        <div class="stat-card"><div class="stat-value">${passedGaze}/${gazeSessions.length}</div><div class="stat-label">Inspections Passed</div></div>
        <div class="stat-card"><div class="stat-value">${integrityFactor}</div><div class="stat-label">Final Integrity Score</div></div>
        <div class="stat-card"><div class="stat-value">${tier}</div><div class="stat-label">Highest Possession Level</div></div>
      </section>` : '';

    const generatedAt = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>The Scroll — ${subjectName}'s Chastity Chronicle</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;700&family=JetBrains+Mono:wght@400;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0a0a0a; --surface: #111111; --border: #1f1f1f;
      --primary: #7c3aed; --text: #e5e5e5; --muted: #6b7280;
      --accent: #c026d3;
    }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; line-height: 1.6; padding: 0; }
    .page { max-width: 800px; margin: 0 auto; padding: 60px 40px; }

    /* Cover */
    .cover { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; border-bottom: 1px solid var(--border); padding: 80px 40px; }
    .cover-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3em; color: var(--primary); margin-bottom: 32px; }
    .cover-title { font-size: 64px; font-weight: 700; line-height: 1.1; letter-spacing: -2px; color: #fff; margin-bottom: 16px; }
    .cover-subtitle { font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--muted); margin-bottom: 60px; }
    .cover-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .cover-meta-item { }
    .cover-meta-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.2em; color: var(--muted); margin-bottom: 4px; }
    .cover-meta-value { font-size: 20px; font-weight: 700; color: var(--primary); }

    /* Section headers */
    .section-header { padding: 60px 0 32px; border-bottom: 1px solid var(--border); }
    .section-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3em; color: var(--primary); margin-bottom: 8px; }
    .section-title { font-size: 36px; font-weight: 700; letter-spacing: -1px; color: #fff; }
    .section-count { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--muted); margin-top: 4px; }

    /* Stats */
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 40px 0; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
    .stat-value { font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 700; color: var(--primary); }
    .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.15em; color: var(--muted); margin-top: 4px; }

    /* Journal entries */
    .entries-list { margin-top: 40px; display: flex; flex-direction: column; gap: 24px; }
    .entry-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; page-break-inside: avoid; }
    .entry-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .mood-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.2em; padding: 3px 10px; border-radius: 100px; font-weight: 700; }
    .entry-date { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted); margin-left: auto; }
    .entry-body { font-size: 15px; line-height: 1.8; color: #d4d4d4; white-space: pre-wrap; }
    .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-top: 16px; }
    .entry-photo { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); }
    .ai-comment { margin-top: 16px; padding: 12px 16px; background: rgba(124, 58, 237, 0.05); border: 1px solid rgba(124, 58, 237, 0.2); border-radius: 8px; }
    .ai-label { font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.2em; color: var(--primary); display: block; margin-bottom: 6px; }
    .ai-comment p { font-size: 13px; color: rgba(124, 58, 237, 0.8); font-style: italic; line-height: 1.6; }

    /* Gaze sessions */
    .gaze-list { margin-top: 40px; display: flex; flex-direction: column; gap: 16px; }
    .gaze-card { background: var(--surface); border: 1px solid; border-radius: 12px; padding: 20px; page-break-inside: avoid; }
    .gaze-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
    .gaze-verdict { font-family: 'JetBrains Mono', monospace; font-size: 9px; text-transform: uppercase; letter-spacing: 0.2em; padding: 3px 10px; border-radius: 100px; font-weight: 700; }
    .gaze-tier { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted); }
    .gaze-photo { width: 200px; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 12px; }
    .gaze-comment { font-size: 13px; color: var(--muted); font-family: 'JetBrains Mono', monospace; line-height: 1.6; }

    /* Empty state */
    .empty-state { padding: 40px; text-align: center; color: var(--muted); font-family: 'JetBrains Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; }

    /* Footer */
    .footer { margin-top: 80px; padding-top: 32px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
    .footer-brand { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: var(--primary); }
    .footer-date { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--muted); }

    @media print {
      .cover { page-break-after: always; }
      .entry-card, .gaze-card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <!-- COVER PAGE -->
  <div class="cover page">
    <p class="cover-label">LockedIn Pro · Chastity Chronicle</p>
    <h1 class="cover-title">The Scroll.</h1>
    <p class="cover-subtitle">${subjectName}'s journey of submission and discipline under The Architect.</p>
    <div class="cover-meta">
      <div class="cover-meta-item">
        <div class="cover-meta-label">Subject Name</div>
        <div class="cover-meta-value">${subjectName}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Possession Level</div>
        <div class="cover-meta-value">${tier}</div>
      </div>
      <div class="cover-meta-item">
        <div class="cover-meta-label">Lock Started</div>
        <div class="cover-meta-value">${lockStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      </div>
    </div>
  </div>

  <div class="page">
    <!-- STATISTICS -->
    ${includeStats ? `
    <div class="section-header">
      <p class="section-label">01 / Overview</p>
      <h2 class="section-title">Your Record.</h2>
      <p class="section-count">A full accounting of your submission.</p>
    </div>
    ${statsHtml}` : ''}

    <!-- JOURNAL ENTRIES -->
    <div class="section-header">
      <p class="section-label">${includeStats ? '02' : '01'} / The Confessional</p>
      <h2 class="section-title">Journal Entries.</h2>
      <p class="section-count">${filteredJournal.length} ${filteredJournal.length === 1 ? 'entry' : 'entries'} on record.</p>
    </div>
    <div class="entries-list">
      ${filteredJournal.length > 0 ? journalBlocks : '<div class="empty-state">No journal entries recorded.</div>'}
    </div>

    <!-- GAZE SESSIONS -->
    <div class="section-header">
      <p class="section-label">${includeStats ? '03' : '02'} / Inspection Log</p>
      <h2 class="section-title">The Gaze Record.</h2>
      <p class="section-count">${filteredGaze.length} inspection${filteredGaze.length !== 1 ? 's' : ''} on file — ${passedGaze} passed, ${filteredGaze.length - passedGaze} failed.</p>
    </div>
    <div class="gaze-list">
      ${filteredGaze.length > 0 ? gazeBlocks : '<div class="empty-state">No inspections recorded.</div>'}
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <span class="footer-brand">The Architect · LockedIn Pro</span>
      <span class="footer-date">Generated ${generatedAt}</span>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Triggers a download of the generated HTML document.
   */
  static async downloadHTML(options = {}) {
    const html = await this.generate(options);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `the-scroll-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
